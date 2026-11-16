// Shared by the admin and production-seed scripts: decide which database to act on, and
// describe it to the person without ever printing the password.
import { existsSync } from "node:fs";

/**
 * Order: `--db <address>` on the command line, then DATABASE_URL in the environment, then
 * apps/api/.env (your own computer). Returns the remaining arguments too.
 */
export function databaseTarget(argv) {
  const args = [...argv];
  let url;
  const at = args.indexOf("--db");
  if (at !== -1) {
    url = args[at + 1];
    args.splice(at, 2);
  }
  if (!url && !process.env.DATABASE_URL && existsSync(".env")) process.loadEnvFile(".env");
  url = (url ?? process.env.DATABASE_URL ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();

  const stop = (text) => {
    console.error(`\n${text}\n`);
    process.exit(1);
  };
  if (!url) stop('No database address. Pass one with  --db "postgresql://..."  or set DATABASE_URL.');
  if (/^psql\s/.test(url)) stop('The address starts with "psql". Pass only the part inside the quotes, starting with postgresql://');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    stop("That database address is not valid. It should start with postgresql://");
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) stop("That database address is not valid. It should start with postgresql://");

  const local = ["localhost", "127.0.0.1", "::1", "[::1]", "db"].includes(parsed.hostname);
  const name = parsed.pathname.replace(/^\//, "") || "(default)";
  return { url, args, local, label: `${name} on ${parsed.hostname}${local ? " (this computer)" : " (hosted)"}` };
}

/** Prisma's connection errors, in plain words. */
export function explain(err) {
  const text = String(err?.message ?? err);
  const code = err?.code ?? err?.errorCode ?? (/Can't reach database server/.test(text) ? "P1001" : /Authentication failed/.test(text) ? "P1000" : /does not exist on the database server/.test(text) ? "P1003" : undefined);
  if (code === "P1001") return "The database server cannot be reached. Check the address; a free Neon database can also take a few seconds to wake, so try once more.";
  if (code === "P1000") return "The database refused the password. Copy the address again from Neon with \"Show password\" on.";
  if (code === "P1003") return "That database does not exist on the server. Check the name after the last / in the address.";
  if (code === "P2021" || code === "P2022") return "The database has no Koinonia tables yet (or old ones). Apply migrations first: deploy the API once, or run  pnpm db:migrate  with DATABASE_URL set to this database.";
  return `Unexpected error: ${String(err?.message ?? err).split("\n").filter(Boolean).pop()}`;
}
