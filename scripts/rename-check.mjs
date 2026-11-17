#!/usr/bin/env node
// After renaming the app in packages/shared/brand.json, lists every place the OLD name is
// still written out in code people can see. Comments, docs, tests and internal identifiers
// (package names like @koinonia/shared, storage keys, the session cookie) are ignored: they
// are not shown to anyone, and changing some of them would sign everybody out.
//
//   pnpm rename:check Koinonia
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const old = process.argv[2];
if (!old) {
  console.error("Usage: pnpm rename:check <OldName>   (for example: pnpm rename:check Koinonia)");
  process.exit(2);
}
const root = new URL("..", import.meta.url).pathname;
const skipDir = new Set(["node_modules", ".next", "dist", ".expo", ".git", "docs", "test", "migrations", "coverage"]);
const wanted = /\.(ts|tsx|mjs|js|json|yaml|yml)$/;
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!skipDir.has(name)) walk(path);
      continue;
    }
    if (!wanted.test(name) || /\.test\.|pnpm-lock|rename-check|brand\.json$/.test(name)) continue;
    const lines = readFileSync(path, "utf8").split("\n");
    let inBlock = false;
    lines.forEach((line, i) => {
      const t = line.trim();
      if (t.startsWith("/*") || t.startsWith("{/*")) inBlock = !t.includes("*/");
      else if (inBlock) {
        if (t.includes("*/")) inBlock = false;
        return;
      }
      if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*") || t.startsWith("#")) return;
      const code = line.replace(/\/\/ .*$/, "");
      // The header name is part of how the apps talk to the API, not something people see; app.json's name is replaced by app.config.js.
      if (code.includes(`X-${old}-Client`) || (name === "app.json" && /"name":/.test(code))) return;
      if (code.includes(old)) hits.push(`${relative(root, path)}:${i + 1}: ${t.slice(0, 110)}`);
    });
  }
}
walk(root);

if (hits.length === 0) {
  console.log(`No visible "${old}" left in the code. (Docs are not checked; see docs/RENAME.md for the rest.)`);
  process.exit(0);
}
console.log(`"${old}" is still written out in ${hits.length} place${hits.length === 1 ? "" : "s"}:\n`);
for (const h of hits) console.log("  " + h);
console.log("\nEach should read the name from BRAND (packages/shared/src/brand.ts) or brand.json instead.");
process.exit(1);
