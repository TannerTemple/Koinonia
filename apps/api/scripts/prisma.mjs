#!/usr/bin/env node
// Runs the Prisma CLI with DIRECT_URL filled in.
//
// The schema asks for two addresses: DATABASE_URL (what the API uses; pooled on Neon) and
// DIRECT_URL (what migrations use; must be a direct connection). On a laptop, in tests and on
// hosts with an ordinary Postgres they are the same thing, so when DIRECT_URL is missing this
// script uses DATABASE_URL for it instead of making everyone set both.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

// The app's name, for messages. The file is not there inside the production image or during
// install, and a message is not worth failing over.
let brand = { name: "The API" };
try {
  brand = JSON.parse(readFileSync(new URL("../../../packages/shared/brand.json", import.meta.url), "utf8"));
} catch {
  /* keep the fallback */
}

if (existsSync(".env")) process.loadEnvFile(".env");
if (process.env.DIRECT_URL?.trim()) process.env.DIRECT_URL_WAS_SET = "1";
else {
  // `prisma generate` runs at install time, before any database is configured; it only
  // needs the variable to exist.
  process.env.DIRECT_URL = process.env.DATABASE_URL || "postgresql://not-configured";
}

// Catch the two classic Neon mistakes before Prisma prints something cryptic.
if (process.argv[2] === "migrate") {
  const fail = (text) => {
    console.error(`\n${brand.name} cannot apply database migrations: ${text}\n`);
    process.exit(1);
  };
  const clean = (v) => v?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  for (const name of ["DATABASE_URL", "DIRECT_URL"]) {
    const v = clean(process.env[name]);
    if (!v) fail(`${name} is missing. Paste the connection string from Neon (it starts with postgresql://).`);
    if (/^psql\s/.test(v)) fail(`${name} starts with "psql". Paste only the part inside the quotes, starting with postgresql://`);
    if (!/^postgres(ql)?:\/\/\S+$/.test(v)) fail(`${name} must start with postgresql:// and contain no spaces.`);
    process.env[name] = v;
  }
  if (/-pooler\./.test(process.env.DIRECT_URL)) {
    fail(
      process.env.DIRECT_URL === process.env.DATABASE_URL && !process.env.DIRECT_URL_WAS_SET
        ? `DIRECT_URL is missing. DATABASE_URL is Neon's pooled address (its host contains "-pooler"), and migrations need the direct one: in Neon's Connect box, switch "Connection pooling" off, copy, and add it as DIRECT_URL.`
        : `DIRECT_URL is the pooled address (its host contains "-pooler"). It must be the direct one: in Neon's Connect box, switch "Connection pooling" off and copy again.`,
    );
  }
}

const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const run = () => spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
let result = run();
// Applying migrations is safe to repeat, and a free Neon database takes a few seconds to
// wake up, so a failed first try gets two more before the deploy is called off.
if (process.argv[2] === "migrate" && process.argv[3] === "deploy") {
  for (let attempt = 2; attempt <= 3 && result.status !== 0; attempt++) {
    console.error(`\nMigrations did not apply. Trying again in 5 seconds (attempt ${attempt} of 3)...\n`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    result = run();
  }
  if (result.status !== 0) {
    console.error(
      [
        "",
        `${brand.name} cannot apply database migrations. The usual causes:`,
        "  - P1001 (can't reach the server): the host in DIRECT_URL is wrong, or the address was cut off when pasted.",
        "  - P1000 (authentication failed): the password in DIRECT_URL is wrong. Copy it again from Neon with \"Show password\" on.",
        "  - P1003 (database does not exist): the name after the last / in DIRECT_URL is wrong.",
        "",
      ].join("\n"),
    );
  }
}
process.exit(result.status ?? 1);
