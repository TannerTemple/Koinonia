import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const DEFAULT_TEST_URL = "postgresql://postgres:postgres@localhost:5432/koinonia_test";

/** Points Prisma at the test database and applies migrations once per run. */
export default function setup() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL;
  process.env.DATABASE_URL = url;
  // Production cost (2^17) would make every sign-up in the suite take a third of a second.
  process.env.SCRYPT_LOG_N = "14";
  execSync("node scripts/prisma.mjs migrate deploy", {
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    stdio: "pipe",
  });
}
