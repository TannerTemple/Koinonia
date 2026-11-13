#!/usr/bin/env node
// Runs the Prisma CLI with DIRECT_URL filled in.
//
// The schema asks for two addresses: DATABASE_URL (what the API uses; pooled on Neon) and
// DIRECT_URL (what migrations use; must be a direct connection). On a laptop, in tests and on
// hosts with an ordinary Postgres they are the same thing, so when DIRECT_URL is missing this
// script uses DATABASE_URL for it instead of making everyone set both.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.DIRECT_URL) {
  // `prisma generate` runs at install time, before any database is configured; it only
  // needs the variable to exist.
  process.env.DIRECT_URL = process.env.DATABASE_URL || "postgresql://not-configured";
}

const cli = createRequire(import.meta.url).resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
process.exit(result.status ?? 1);
