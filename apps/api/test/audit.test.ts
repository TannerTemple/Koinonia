import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { createMockProviders } from "../src/providers";
import { createTestApp, NOW, prisma, resetDb, signUp, type Api, type TestContext } from "./helpers";

/**
 * Security audit, round two: sweeps every route the API has, so a new endpoint that forgets
 * to check who is asking fails here rather than in production.
 */

/** The only routes anyone may call without signing in, each for a stated reason. */
const PUBLIC = new Set([
  "GET /health", // host health check
  "GET /health/ready", // host readiness check
  "GET /v1/config", // which optional features are on; nothing personal
  "POST /v1/auth/register",
  "POST /v1/auth/login",
  "POST /v1/auth/forgot-password",
  "POST /v1/auth/reset-password", // needs the emailed one-time token
  "POST /v1/auth/verify-email", // needs the emailed one-time token
  "POST /v1/beta/signup", // public invite form; consent required, 5 an hour
  "GET /v1/calendar/:file", // the secret token is the file name
  "POST /v1/jobs/digest", // only exists with CRON_SECRET, and checks it
  "GET /v1/auth/oauth/:provider/start", // outside sign-in: sends the browser to the provider
  "GET /v1/auth/oauth/:provider/callback", // ...and back: needs the attempt's state and browser cookie
  "POST /v1/auth/oauth/:provider/callback", // (Apple posts it)
  "POST /v1/auth/oauth/exchange", // the phone's one-time code from that flow
]);

let ctx: TestContext;
let member: Api;
const routes: { method: string; url: string }[] = [];
const fill = (url: string) => url.replace(/:[a-zA-Z]+/g, "cmh2x9k0a0001abcdxyz12345");

beforeAll(async () => {
  ctx = await createTestApp();
  const app = await buildApp({
    prisma,
    providers: createMockProviders(),
    env: loadEnv({ ...process.env, CRON_SECRET: "a-cron-secret-that-is-long-enough" }),
    rateLimit: false,
    onRoute: (route) => {
      for (const method of Array.isArray(route.method) ? route.method : [route.method]) {
        if (method !== "HEAD" && method !== "OPTIONS") routes.push({ method, url: route.url });
      }
    },
  });
  await app.close();
});
beforeEach(async () => {
  await resetDb();
  member = await signUp(ctx.app);
});
afterAll(async () => {
  await ctx.app.close();
});

describe("who may call what", () => {
  it("finds the whole API", () => {
    expect(routes.length).toBeGreaterThan(50);
  });

  it("refuses every non-public route without a session", async () => {
    const open: string[] = [];
    for (const r of routes) {
      if (PUBLIC.has(`${r.method} ${r.url}`)) continue;
      const res = await ctx.app.inject({ method: r.method as "GET", url: fill(r.url), payload: r.method === "GET" || r.method === "DELETE" ? undefined : {} });
      if (res.statusCode !== 401) open.push(`${r.method} ${r.url} -> ${res.statusCode}`);
    }
    expect(open).toEqual([]);
  });

  it("refuses a forged or expired session the same way", async () => {
    const bad = await ctx.app.inject({ url: "/v1/home", headers: { authorization: "Bearer not-a-real-token" } });
    expect(bad.statusCode).toBe(401);
    await prisma.session.updateMany({ where: { userId: member.userId }, data: { expiresAt: new Date(new Date(NOW).getTime() - 1000) } });
    expect((await member.call("GET", "/home")).status).toBe(401);
  });

  it("refuses every admin route to an ordinary member", async () => {
    const admin = routes.filter((r) => r.url.startsWith("/v1/admin/"));
    expect(admin.length).toBeGreaterThan(5);
    const leaked: string[] = [];
    for (const r of admin) {
      const res = await ctx.app.inject({ method: r.method as "GET", url: fill(r.url), headers: { authorization: `Bearer ${member.token}` }, payload: r.method === "GET" || r.method === "DELETE" ? undefined : {} });
      if (res.statusCode !== 403) leaked.push(`${r.method} ${r.url} -> ${res.statusCode}`);
    }
    expect(leaked).toEqual([]);
  });

  it("ignores the web session cookie unless the web app's header comes with it", async () => {
    const res = await ctx.app.inject({ url: "/v1/home", cookies: { koinonia_session: member.token } });
    expect(res.statusCode).toBe(401);
    const web = await ctx.app.inject({ url: "/v1/home", cookies: { koinonia_session: member.token }, headers: { "x-koinonia-client": "web" } });
    expect(web.statusCode).toBe(200);
  });
});

describe("rate limits per visitor through the web app", () => {
  const secret = "a-long-random-shared-secret-value";
  const build = (extra: Record<string, string> = {}) => buildApp({ prisma, providers: createMockProviders(), env: loadEnv({ ...process.env, ...extra }) });
  // A different email each time, so the per-account lockout (8 wrong passwords) stays out of it.
  let n = 0;
  const login = (app: Awaited<ReturnType<typeof build>>, headers: Record<string, string>) =>
    app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: `nobody${n++}@example.com`, password: "x" }, headers });

  it("gives each visitor their own bucket when the web app vouches for the address", async () => {
    const app = await build({ PROXY_SECRET: secret });
    const a = { "x-koinonia-proxy-secret": secret, "x-koinonia-client-ip": "203.0.113.7" };
    const b = { "x-koinonia-proxy-secret": secret, "x-koinonia-client-ip": "203.0.113.8" };
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await login(app, a)).statusCode);
    const other = (await login(app, b)).statusCode;
    await app.close();
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
    expect(other).toBe(401); // a different visitor is not caught by the first one's limit
  });

  it("ignores a claimed address without the right secret, so nobody can pick their own", async () => {
    const app = await build({ PROXY_SECRET: secret });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      // A new made-up address every time: if it were believed, the limit would never trigger.
      statuses.push((await login(app, { "x-koinonia-proxy-secret": "wrong-secret-of-the-same-size!!!!", "x-koinonia-client-ip": `198.51.100.${i}` })).statusCode);
    }
    await app.close();
    expect(statuses[10]).toBe(429);
  });

  it("ignores a claimed address when no secret is configured", async () => {
    const app = await build();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await login(app, { "x-koinonia-proxy-secret": "", "x-koinonia-client-ip": `198.51.100.${i}` })).statusCode);
    await app.close();
    expect(statuses[10]).toBe(429);
  });

  it("requires a PROXY_SECRET long enough not to be guessed", () => {
    expect(() => loadEnv({ ...process.env, PROXY_SECRET: "short" })).toThrow(/PROXY_SECRET must be at least 24 characters/);
  });
});

describe("account enumeration", () => {
  it("answers forgot-password the same whether or not the account exists", async () => {
    const known = await ctx.app.inject({ method: "POST", url: "/v1/auth/forgot-password", payload: { email: (await prisma.user.findUniqueOrThrow({ where: { id: member.userId } })).email } });
    const unknown = await ctx.app.inject({ method: "POST", url: "/v1/auth/forgot-password", payload: { email: "nobody-here@example.com" } });
    expect(known.statusCode).toBe(unknown.statusCode);
    expect(known.body).toBe(unknown.body);
  });

  it("answers a wrong password and an unknown email with the same message", async () => {
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: member.userId } })).email;
    const wrong = await ctx.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: "definitely wrong" } });
    const nobody = await ctx.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "nobody-here@example.com", password: "definitely wrong" } });
    expect(wrong.statusCode).toBe(nobody.statusCode);
    expect(wrong.json()).toEqual(nobody.json());
  });
});
