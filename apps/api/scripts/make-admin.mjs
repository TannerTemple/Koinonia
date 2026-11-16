#!/usr/bin/env node
// Makes an existing account an admin, by email. Safe to run twice.
//
//   pnpm make-admin you@example.com                              (your own computer's database)
//   pnpm make-admin you@example.com --db "postgresql://..."      (a hosted database, e.g. Neon)
//   pnpm make-admin you@example.com --remove                     (back to a regular account)
//
// It changes one column of one row and nothing else. The account must already exist:
// sign up in the app first.
import { PrismaClient } from "@prisma/client";
import { databaseTarget, explain } from "./db-target.mjs";

const { url, args, label } = databaseTarget(process.argv.slice(2));
const remove = args.includes("--remove");
const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('\nUsage: pnpm make-admin you@example.com [--db "postgresql://..."] [--remove]\n');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
let code = 0;
try {
  console.log(`\nDatabase: ${label}`);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true } });
  if (!user) {
    const total = await prisma.user.count();
    console.error(`\nNo account with the email ${email}.`);
    console.error(total === 0 ? "This database has no accounts yet. Sign up in the app first, then run this again." : `This database has ${total} account${total === 1 ? "" : "s"}, none with that email. Check the spelling, or sign up first.`);
    code = 1;
  } else {
    const wanted = remove ? "USER" : "ADMIN";
    if (user.role === wanted) {
      console.log(`\n${user.name} (${email}) is already ${remove ? "a regular account" : "an admin"}. Nothing changed.`);
    } else {
      await prisma.user.update({ where: { id: user.id }, data: { role: wanted } });
      console.log(`\nDone. ${user.name} (${email}) is now ${remove ? "a regular account" : "an admin"}.`);
      if (!remove) console.log("Reload the web app: Admin appears in the menu.");
    }
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    console.log(`Admins in this database: ${admins}.\n`);
  }
} catch (err) {
  console.error(`\n${explain(err)}\n`);
  code = 1;
} finally {
  await prisma.$disconnect();
}
process.exit(code);
