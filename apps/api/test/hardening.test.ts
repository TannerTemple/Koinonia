import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { createMockProviders } from "../src/providers";
import { call, createTestApp, prisma, resetDb, signUp, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let api: Api;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  api = await signUp(ctx.app);
});
afterAll(async () => {
  await ctx.app.close();
});

describe("input a client should not be able to set", () => {
  it("can't make itself admin, verified or someone else through the profile", async () => {
    const res = await api.call("PATCH", "/me", { name: "Still Me", role: "ADMIN", emailVerified: true, emailVerifiedAt: "2020-01-01", id: "other", email: "new@example.com" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: "Still Me", role: "USER", emailVerified: false, id: api.userId });
    expect((await api.call("GET", "/admin/stats")).status).toBe(403);
  });

  it("can't create a person or intention under another account", async () => {
    const other = await signUp(ctx.app);
    const created = await api.call("POST", "/contacts", { name: "Mine", userId: other.userId, nextDueDay: "2000-01-01", archivedAt: "2020-01-01" });
    expect(created.status).toBe(201);
    const row = await prisma.contact.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.userId).toBe(api.userId);
    expect(row.nextDueDay).toBeNull();
    expect(row.archivedAt).toBeNull();

    const intention = await api.call("POST", "/intentions", { title: "Mine", userId: other.userId, prayedCount: 99 });
    expect(intention.body.prayedCount).toBe(0);
    expect((await other.call("GET", "/intentions")).body).toEqual([]);
  });
});

describe("error handling", () => {
  it("answers malformed JSON with a 400 in the usual shape", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/v1/contacts",
      payload: "{ not json",
      headers: { "content-type": "application/json", authorization: `Bearer ${api.token}` },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe("BAD_REQUEST");
  });

  it("treats a non-object body as invalid input, not a crash", async () => {
    for (const body of [[], "text", 42, null]) {
      const res = await api.call("POST", "/contacts", body);
      expect([400, 415]).toContain(res.status); // 415: not JSON at all
      expect(res.body.error.code).toBe("BAD_REQUEST");
    }
  });

  it("never counts a prayer twice when two taps race", async () => {
    const id = (await api.call("POST", "/intentions", { title: "Raced" })).body.id;
    const results = await Promise.all(Array.from({ length: 5 }, () => api.call("POST", `/intentions/${id}/pray`)));
    for (const r of results) expect([200, 409]).toContain(r.status);
    expect(results.some((r) => r.status === 200)).toBe(true);
    const after = (await api.call("GET", "/intentions")).body[0];
    expect(after.prayedCount).toBe(1);
    expect(await prisma.prayerLog.count({ where: { intentionId: id } })).toBe(1);
  });

  it("never leaks internals in a 500", async () => {
    const res = await api.call("GET", "/contacts/%00");
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma|postgres|stack|at .*\.ts/i);
  });
});

describe("rate limiting (as configured in production)", () => {
  it("limits sign-in attempts per address, and ignores a spoofed forwarded address", async () => {
    const app = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv({ ...process.env, TRUST_PROXY: "false" }) });
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: `nobody${i}@example.com`, password: "wrong password" },
        headers: { "x-forwarded-for": `10.0.0.${i}` },
      });
      statuses.push(res.statusCode);
    }
    await app.close();
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it("does not let a disabled account keep using an old session", async () => {
    await prisma.user.update({ where: { id: api.userId }, data: { disabledAt: new Date() } });
    expect((await api.call("GET", "/home")).status).toBe(403);
    expect((await call(ctx.app, "GET", "/home")).status).toBe(401);
  });
});

describe("hosting", () => {
  it("reports not ready, without details, when the database is unreachable", async () => {
    const broken = { $queryRaw: async () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.5:5432")) } as unknown as typeof prisma;
    const app = await buildApp({ prisma: broken, providers: createMockProviders(), env: loadEnv(process.env), rateLimit: false });
    const live = await app.inject({ url: "/health" });
    const ready = await app.inject({ url: "/health/ready" });
    await app.close();
    expect(live.statusCode).toBe(200);
    expect(ready.statusCode).toBe(503);
    expect(ready.json()).toEqual({ ok: false, database: "down" });
  });

  it("never rate-limits the health checks", async () => {
    const app = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv(process.env) });
    let last = 0;
    for (let i = 0; i < 320; i++) last = (await app.inject({ url: "/health" })).statusCode;
    await app.close();
    expect(last).toBe(200);
  });

  it("reads TRUST_PROXY as off, a hop count, or everything", () => {
    const read = (v?: string) => loadEnv({ ...process.env, TRUST_PROXY: v }).TRUST_PROXY;
    expect(read(undefined)).toBe(false);
    expect(read("false")).toBe(false);
    expect(read("0")).toBe(false);
    expect(read("1")).toBe(1);
    expect(read("2")).toBe(2);
    expect(read("true")).toBe(true);
    expect(read("nonsense")).toBe(false);
  });

  it("uses the address the trusted proxy reports, not one the client made up", async () => {
    const app = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv({ ...process.env, TRUST_PROXY: "1" }) });
    const statuses: number[] = [];
    // The client lies in the first entry; the host's proxy appends the real address last.
    for (let i = 0; i < 12; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: `hop${i}@example.com`, password: "wrong password" },
        headers: { "x-forwarded-for": `10.9.9.${i}, 203.0.113.7` },
      });
      statuses.push(res.statusCode);
    }
    await app.close();
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it("runs the digest for a scheduler that knows the secret, and hides the endpoint otherwise", async () => {
    const secret = "a-long-random-cron-secret-value";
    expect(() => loadEnv({ ...process.env, CRON_SECRET: "short" })).toThrow(/CRON_SECRET/);

    const off = await ctx.app.inject({ method: "POST", url: "/v1/jobs/digest", headers: { "x-cron-secret": secret } });
    expect(off.statusCode).toBe(404);

    const app = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv({ ...process.env, CRON_SECRET: secret }), rateLimit: false });
    expect((await app.inject({ method: "POST", url: "/v1/jobs/digest" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/v1/jobs/digest", headers: { "x-cron-secret": "wrong" } })).statusCode).toBe(401);
    const ok = await app.inject({ method: "POST", url: "/v1/jobs/digest", headers: { "x-cron-secret": secret } });
    await app.close();
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ considered: 1, sent: 0 });
  });
});
