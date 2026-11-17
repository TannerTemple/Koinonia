#!/usr/bin/env node
// The production-safe "seed": prepares and checks a real database without inventing anything.
//
//   pnpm db:seed:prod --db "postgresql://..."                       check only
//   pnpm db:seed:prod --db "postgresql://..." --admin you@example.com   also make that account an admin
//   pnpm db:seed:prod --db "postgresql://..." --remove-demo         delete demo accounts if any slipped in
//
// Koinonia needs no starter data: every table starts empty and fills as people use the app.
// So this script creates NO accounts and deletes nothing unless asked. It is safe to run any
// number of times. (The demo seed, `pnpm db:seed`, is for your own computer only and refuses
// to touch a hosted database.)
import { readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { databaseTarget, explain } from "./db-target.mjs";

const { url, args, label } = databaseTarget(process.argv.slice(2));
const adminAt = args.indexOf("--admin");
const adminEmail = adminAt === -1 ? undefined : args[adminAt + 1]?.trim().toLowerCase();
const removeDemo = args.includes("--remove-demo");
if (adminAt !== -1 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail ?? "")) {
  console.error("\n--admin needs an email address after it.\n");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const ok = (text) => console.log(`  ok    ${text}`);
const warn = (text) => console.log(`  WARN  ${text}`);
let code = 0;
try {
  console.log(`\nDatabase: ${label}\n`);

  await prisma.$queryRaw`SELECT 1`;
  ok("the database answers");

  const expected = readdirSync(new URL("../prisma/migrations", import.meta.url), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  let applied = [];
  try {
    applied = (await prisma.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`).map((r) => r.migration_name);
  } catch {
    /* no migrations table: nothing applied */
  }
  const missing = expected.filter((m) => !applied.includes(m));
  if (missing.length) {
    warn(`${missing.length} of ${expected.length} migrations are not applied yet (first: ${missing[0]}).`);
    console.log("        Deploy the API (it applies them at start), or run  pnpm db:migrate  with DATABASE_URL set to this database.");
    code = 1;
  } else {
    ok(`all ${expected.length} migrations are applied`);

    const [users, admins, demo] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { email: { endsWith: "@koinonia.app" } } }),
    ]);
    ok(`${users} account${users === 1 ? "" : "s"}, ${admins} admin${admins === 1 ? "" : "s"}`);

    if (demo > 0 && removeDemo) {
      const gone = await prisma.user.deleteMany({ where: { email: { endsWith: "@koinonia.app" } } });
      ok(`removed ${gone.count} demo account${gone.count === 1 ? "" : "s"} (@koinonia.app) and everything they owned`);
    } else if (demo > 0) {
      warn(`${demo} demo account${demo === 1 ? "" : "s"} (@koinonia.app) with published passwords. Remove with  --remove-demo`);
      code = 1;
    } else {
      ok("no demo accounts");
    }

    if (adminEmail) {
      const user = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true, role: true } });
      if (!user) {
        warn(`no account with the email ${adminEmail} yet. Sign up in the app first, then run this again.`);
        code = 1;
      } else if (user.role === "ADMIN") {
        ok(`${adminEmail} is already an admin`);
      } else {
        await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
        ok(`${adminEmail} is now an admin`);
      }
    } else if (admins === 0 && users > 0) {
      console.log("  note  nobody is an admin yet:  pnpm make-admin you@example.com --db \"...\"");
    }
  }
  console.log(code === 0 ? "\nThis database is ready.\n" : "\nNot ready yet: see the WARN lines above.\n");
} catch (err) {
  console.error(`\n${explain(err)}\n`);
  code = 1;
} finally {
  await prisma.$disconnect();
}
process.exit(code);
