#!/usr/bin/env node
// Post-deploy smoke test. Checks a running Koinonia from the outside, the way the apps use it.
//
//   pnpm smoke https://koinonia-api.onrender.com https://koinonia.vercel.app
//   pnpm smoke http://localhost:4000 http://localhost:3000        (your own computer)
//
// It creates one throwaway account (smoke-...@example.com), uses it, and deletes it again.
// Prints PASS or FAIL per check, with a one-line fix on failure. Exit code 0 = all passed.

const [apiArg, webArg] = process.argv.slice(2);
const clean = (v) => v?.trim().replace(/\/+$/, "");
const api = clean(apiArg);
const web = clean(webArg);

if (!api || !/^https?:\/\//.test(api) || (web && !/^https?:\/\//.test(web))) {
  console.error("Usage: pnpm smoke <api-url> [web-url]\nExample: pnpm smoke https://koinonia-api.onrender.com https://koinonia.vercel.app");
  process.exit(2);
}

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
let failed = 0;
let passed = 0;
let skipped = 0;

/** Runs one check. `fn` returns nothing on success, or throws `fail(reason, fix)`. */
async function check(name, fn) {
  try {
    const note = await fn();
    passed += 1;
    console.log(`${paint(32, "PASS")}  ${name}${note ? paint(2, `  (${note})`) : ""}`);
    return true;
  } catch (err) {
    failed += 1;
    const reason = err?.reason ?? (err?.name === "TimeoutError" ? "no answer within 60 seconds" : err?.cause?.code ?? err?.message ?? String(err));
    console.log(`${paint(31, "FAIL")}  ${name}: ${reason}`);
    const network = !err?.reason;
    console.log(`      Fix: ${err?.fix ?? (network ? "nothing answered at that address. Check it is typed exactly (https://, no typo) and that the service shows as Live / Ready." : "see docs/TONIGHT.md, \"If something goes wrong\".")}`);
    return false;
  }
}
function skip(name, why) {
  skipped += 1;
  console.log(`${paint(33, "SKIP")}  ${name}: ${why}`);
}
const fail = (reason, fix) => Object.assign(new Error(reason), { reason, fix });

async function call(base, path, { method = "GET", body, token, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    // A sleeping free database or instance can take a while to wake.
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text, headers: res.headers };
}
const said = (r) => r.json?.error?.message ?? (r.text ? r.text.slice(0, 80).replace(/\s+/g, " ") : "empty reply");

const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const account = { name: "Smoke Test", email: `smoke-${stamp}@example.com`, password: `Smoke-${stamp}-${Math.random().toString(36).slice(2)}` };
let token = null;
let personId = null;
let created = false;

console.log(`\nKoinonia smoke test\n  API: ${api}\n  Web: ${web ?? "(not given; web checks skipped)"}\n`);

const up = await check("API is up (/health)", async () => {
  const started = Date.now();
  const r = await call(api, "/health");
  if (r.status !== 200) throw fail(`answered ${r.status}`, "Render > koinonia-api > Logs. If the last deploy failed, the log's final lines say which setting is wrong.");
  if (r.json?.status !== "ok" && r.json?.ok !== true) throw fail("something answered, but it is not the Koinonia API", "Check the address: it should be the Render service, like https://koinonia-api.onrender.com");
  return `${Date.now() - started} ms`;
}).catch(() => false);

if (!up) {
  console.log(`\n${paint(31, "The API cannot be reached, so nothing else can be checked.")}`);
  console.log("Fix: open the API address + /health in a browser. On Render, check the service is \"Live\" and read Logs.\n");
  process.exit(1);
}

await check("API can reach its database (/health/ready)", async () => {
  const r = await call(api, "/health/ready");
  if (r.status !== 200) throw fail(`answered ${r.status}`, "DATABASE_URL on Render is wrong or the Neon project is paused. Copy the pooled string from Neon again, Save Changes.");
});

if (web) {
  await check(`API lets browsers at ${web} call it (CORS)`, async () => {
    const r = await call(api, "/v1/auth/login", { method: "OPTIONS", headers: { Origin: new URL(web).origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-koinonia-client" } });
    const allowed = r.headers.get("access-control-allow-origin");
    if (allowed !== new URL(web).origin) throw fail(`the API allows "${allowed ?? "nobody"}"`, `Render > koinonia-api > Environment: set WEB_URL to ${new URL(web).origin} (and remove CORS_ORIGINS if it is set), Save Changes.`);
    if (r.headers.get("access-control-allow-credentials") !== "true") throw fail("credentials are not allowed", "This should not happen; redeploy the API from the latest commit.");
  });
  await check("API refuses browsers from other sites (CORS)", async () => {
    const r = await call(api, "/v1/auth/login", { method: "OPTIONS", headers: { Origin: "https://not-koinonia.example", "Access-Control-Request-Method": "POST" } });
    if (r.headers.get("access-control-allow-origin")) throw fail("it allowed an unknown site", "CORS_ORIGINS on Render must list only your web address, never *.");
  });
  await check("Web app loads", async () => {
    const r = await call(web, "/login");
    if (r.status !== 200) throw fail(`answered ${r.status}`, "Vercel > project > Deployments: open the latest one and read the build log. Root Directory must be apps/web.");
    if (!/koinonia/i.test(r.text)) throw fail("a page loaded, but it is not Koinonia", "Check the web address.");
  });
  await check("Web app forwards /api to the API", async () => {
    const r = await call(web, "/api/health");
    if (r.status !== 200 || (r.json?.status !== "ok" && r.json?.ok !== true)) throw fail(`${web}/api/health answered ${r.status}`, `Vercel > Settings > Environment Variables: API_PROXY_TARGET must be ${api}. Then Deployments > ... > Redeploy.`);
  });
} else {
  skip("CORS, web app, /api forwarding", "no web address given");
}

created = await check("Sign up", async () => {
  const r = await call(api, "/v1/auth/register", { method: "POST", body: { ...account, timezone: "America/Chicago" } });
  if (r.status === 429) throw fail("too many attempts from this network", "Wait a minute and run the smoke test again.");
  if (r.status !== 201 && r.status !== 200) throw fail(`answered ${r.status}: ${said(r)}`, r.status >= 500 ? "Render > Logs. A 500 here usually means migrations did not run: check DIRECT_URL and redeploy." : "Read the message above.");
  if (!r.json?.token) throw fail("no session token came back", "Redeploy the API from the latest commit.");
  token = r.json.token;
});

if (created) {
  await check("Sign in", async () => {
    const r = await call(api, "/v1/auth/login", { method: "POST", body: { email: account.email, password: account.password } });
    if (r.status !== 200 || !r.json?.token) throw fail(`answered ${r.status}: ${said(r)}`, "Render > Logs.");
    token = r.json.token;
  });
  await check("A wrong password is refused", async () => {
    const r = await call(api, "/v1/auth/login", { method: "POST", body: { email: account.email, password: "definitely-wrong" } });
    if (r.status !== 401 && r.status !== 400) throw fail(`answered ${r.status}`, "Redeploy the API from the latest commit.");
  });
  await check("Create a person", async () => {
    const r = await call(api, "/v1/contacts", { method: "POST", token, body: { name: "Smoke Test Person", cadenceDays: 7 } });
    if (r.status !== 201 || !r.json?.id) throw fail(`answered ${r.status}: ${said(r)}`, "Render > Logs.");
    personId = r.json.id;
  });
  if (personId) {
    await check("Read the person back", async () => {
      const r = await call(api, `/v1/contacts/${personId}`, { token });
      if (r.status !== 200 || r.json?.name !== "Smoke Test Person") throw fail(`answered ${r.status}: ${said(r)}`, "Render > Logs.");
      const home = await call(api, "/v1/home", { token });
      if (home.status !== 200) throw fail(`Today answered ${home.status}`, "Render > Logs.");
    });
  }
  await check("Nobody gets in without signing in", async () => {
    const r = await call(api, "/v1/contacts");
    if (r.status !== 401) throw fail(`answered ${r.status}`, "Redeploy the API from the latest commit.");
  });
  if (web) {
    await check("Web sign-in keeps you signed in (cookie through /api)", async () => {
      const r = await call(web, "/api/v1/auth/login", { method: "POST", headers: { "X-Koinonia-Client": "web", Origin: new URL(web).origin }, body: { email: account.email, password: account.password } });
      if (r.status !== 200) throw fail(`answered ${r.status}: ${said(r)}`, `Vercel: API_PROXY_TARGET must be ${api}; redeploy.`);
      const cookie = (r.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("koinonia_session="));
      if (!cookie) throw fail("no session cookie was set", "Vercel: NEXT_PUBLIC_API_URL must be /api or not set at all; redeploy.");
      if (web.startsWith("https://") && !/;\s*secure/i.test(cookie)) throw fail("the cookie is not marked Secure", "Render: NODE_ENV must be production.");
      const me = await call(web, "/api/v1/me", { headers: { "X-Koinonia-Client": "web", Cookie: cookie.split(";")[0] } });
      if (me.status !== 200 || me.json?.email !== account.email) throw fail(`the cookie was not accepted (${me.status})`, "Render > Logs.");
    });
  }
  await check("Delete the test account", async () => {
    const r = await call(api, "/v1/me", { method: "DELETE", token, body: { password: account.password } });
    if (r.status !== 204 && r.status !== 200) throw fail(`answered ${r.status}: ${said(r)}`, `Remove it by hand: in Neon's SQL Editor run  DELETE FROM "User" WHERE email = '${account.email}';`);
    const again = await call(api, "/v1/auth/login", { method: "POST", body: { email: account.email, password: account.password } });
    if (again.status === 200) throw fail("the account can still sign in", `Remove it by hand: in Neon's SQL Editor run  DELETE FROM "User" WHERE email = '${account.email}';`);
  });
} else {
  skip("Sign in, create a person, read it back, delete the account", "sign-up failed");
}

console.log("");
if (failed === 0) {
  console.log(paint(32, `ALL ${passed} CHECKS PASSED.`) + (skipped ? ` (${skipped} skipped)` : "") + " Koinonia is working.\n");
  process.exit(0);
}
console.log(paint(31, `${failed} FAILED`) + `, ${passed} passed. Fix the first failure and run it again.\n`);
process.exit(1);
