import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { pageOf } from "../src/lib/page";
import { createSentryReporter, parseDsn } from "../src/lib/sentry";
import { createMockProviders } from "../src/providers";
import { createTestApp, prisma, resetDb, signUp, type Api, type TestContext } from "./helpers";

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

describe("rate limits on writes", () => {
  it("gives every endpoint that changes something a limit of its own", async () => {
    const app = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv(process.env) });
    const person = (await api.call("POST", "/contacts", { name: "Mom", cadenceDays: 7 })).body.id;
    const headers = { authorization: `Bearer ${api.token}` };
    const patch = () => app.inject({ method: "PATCH", url: `/v1/contacts/${person}`, payload: { favorite: true }, headers });

    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) statuses.push((await patch()).statusCode);
    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(60)).toEqual([429, 429]);

    // Reading is not caught by the write limit, and another write endpoint has its own budget.
    expect((await app.inject({ url: `/v1/contacts/${person}`, headers })).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: `/v1/contacts/${person}/notes`, payload: { body: "still fine" }, headers })).statusCode).toBe(201);
    const limited = await patch();
    await app.close();
    expect(limited.json().error).toMatchObject({ code: "RATE_LIMITED" });
    expect(limited.headers["retry-after"]).toBeDefined();
  });

  it("covers every write route in the API", async () => {
    const routes: { method: string; url: string; limited: boolean }[] = [];
    const app = await buildApp({
      prisma,
      providers: createMockProviders(),
      env: loadEnv(process.env),
      onRoute: (route) => {
        const methods = Array.isArray(route.method) ? route.method : [route.method];
        for (const method of methods) routes.push({ method, url: route.url, limited: (route.config as { rateLimit?: unknown } | undefined)?.rateLimit !== undefined });
      },
    });
    await app.close();
    const writes = routes.filter((r) => ["POST", "PUT", "PATCH", "DELETE"].includes(r.method));
    expect(writes.length).toBeGreaterThan(25);
    expect(writes.filter((r) => !r.limited).map((r) => `${r.method} ${r.url}`)).toEqual([]);
  });
});

describe("pagination", () => {
  it("reads limit and offset with a default and a ceiling", () => {
    expect(pageOf({}, 50, 100)).toEqual({ limit: 50, offset: 0 });
    expect(pageOf({ limit: "20", offset: "40" }, 50, 100)).toEqual({ limit: 20, offset: 40 });
    expect(pageOf({ limit: "100000" }, 50, 100)).toEqual({ limit: 100, offset: 0 });
    expect(pageOf({ limit: "-5", offset: "abc" }, 50, 100)).toEqual({ limit: 50, offset: 0 });
  });

  it("pages the people list and says how many there are in all", async () => {
    await prisma.contact.createMany({ data: Array.from({ length: 7 }, (_, i) => ({ userId: api.userId, name: `Person ${i}` })) });
    const page = async (qs: string) => {
      const res = await ctx.app.inject({ url: `/v1/contacts${qs}`, headers: { authorization: `Bearer ${api.token}` } });
      return { total: res.headers["x-total-count"], names: res.json().map((c: any) => c.name) };
    };
    expect(await page("")).toMatchObject({ total: "7", names: expect.arrayContaining(["Person 0", "Person 6"]) });
    expect(await page("?limit=3")).toEqual({ total: "7", names: ["Person 0", "Person 1", "Person 2"] });
    expect(await page("?limit=3&offset=6")).toEqual({ total: "7", names: ["Person 6"] });
    expect(await page("?limit=3&offset=3&q=person")).toEqual({ total: "7", names: ["Person 3", "Person 4", "Person 5"] });
  });

  it("pages a person's history, newest first, and only for its owner", async () => {
    const person = (await api.call("POST", "/contacts", { name: "Mom", cadenceDays: 7 })).body.id;
    await prisma.interaction.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({ userId: api.userId, contactId: person, day: `2026-${String(Math.floor(i / 28) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}` })),
    });
    // The person's page carries the latest 50...
    expect((await api.call("GET", `/contacts/${person}`)).body.interactions).toHaveLength(50);
    // ...and the rest can be fetched.
    const res = await ctx.app.inject({ url: `/v1/contacts/${person}/interactions?offset=50`, headers: { authorization: `Bearer ${api.token}` } });
    expect(res.headers["x-total-count"]).toBe("60");
    const older = res.json();
    expect(older).toHaveLength(10);
    expect(older[0].day > older[9].day).toBe(true);
    expect(older[9].day).toBe("2026-01-01");

    const other = await signUp(ctx.app);
    expect((await other.call("GET", `/contacts/${person}/interactions`)).status).toBe(404);
  });

  it("pages the admin user list", async () => {
    await prisma.user.update({ where: { id: api.userId }, data: { role: "ADMIN" } });
    await prisma.user.createMany({ data: Array.from({ length: 5 }, (_, i) => ({ email: `bulk${i}@example.com`, name: `Bulk ${i}`, passwordHash: "x" })) });
    const res = await ctx.app.inject({ url: "/v1/admin/users?limit=2&offset=4", headers: { authorization: `Bearer ${api.token}` } });
    expect(res.headers["x-total-count"]).toBe("6");
    expect(res.json()).toHaveLength(2);
  });
});

describe("optional error reporting (Sentry)", () => {
  const dsn = "https://abc123publickey@o4500000.ingest.us.sentry.io/4500001";

  it("reads a DSN, and ignores a malformed one", () => {
    expect(parseDsn(dsn)).toEqual({ key: "abc123publickey", url: "https://o4500000.ingest.us.sentry.io/api/4500001/envelope/" });
    for (const bad of ["", "not a url", "http://key@host/1", "https://host/1", "https://key@host/project"]) expect(parseDsn(bad)).toBeNull();
  });

  it("sends one envelope with the error type and a scrubbed message, and nothing personal", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    const reporter = createSentryReporter({ dsn, environment: "production", fetch });

    reporter.capture(Object.assign(new Error("\nInvalid invocation:\n\nUnique constraint failed for tanner@example.com"), { name: "PrismaClientKnownRequestError", code: "P2002" }), { method: "POST", path: "/v1/contacts" });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://o4500000.ingest.us.sentry.io/api/4500001/envelope/");
    expect(calls[0]!.init.headers).toMatchObject({ "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": expect.stringContaining("sentry_key=abc123publickey") });
    const [header, item, event] = (calls[0]!.init.body as string).trim().split("\n").map((l) => JSON.parse(l));
    expect(header.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({
      level: "error",
      environment: "production",
      transaction: "POST /v1/contacts",
      exception: { values: [{ type: "PrismaClientKnownRequestError", value: "Unique constraint failed for [email]" }] },
      tags: { code: "P2002" },
    });
    expect(calls[0]!.init.body as string).not.toContain("tanner");
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("request");
  });

  it("stops after 20 reports in a minute, and never throws if Sentry is down", async () => {
    let n = 0;
    const fetch = (async () => {
      n += 1;
      throw new TypeError("network down");
    }) as unknown as typeof globalThis.fetch;
    const reporter = createSentryReporter({ dsn, environment: "production", fetch, now: () => new Date("2026-11-12T12:00:30Z") });
    for (let i = 0; i < 50; i++) expect(() => reporter.capture(new Error("boom"))).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(n).toBe(20);
  });

  it("is told about a 500, with the route pattern rather than the real address", async () => {
    const captured: unknown[][] = [];
    const broken = { session: { findUnique: async () => Promise.reject(new Error("db exploded")) } } as unknown as typeof prisma;
    const app = await buildApp({ prisma: broken, providers: createMockProviders(), env: loadEnv(process.env), rateLimit: false, reporter: { capture: (...args) => void captured.push(args) } });
    const res = await app.inject({ url: "/v1/contacts/secret-person-id?q=secret", headers: { authorization: "Bearer whatever-token" } });
    await app.close();
    expect(res.statusCode).toBe(500);
    expect(captured).toHaveLength(1);
    expect(captured[0]![1]).toEqual({ method: "GET", path: "/v1/contacts/:id" });

    // Ordinary refusals (401, 404, validation) are not errors worth reporting.
    const quiet: unknown[] = [];
    const ok = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv(process.env), rateLimit: false, reporter: { capture: () => void quiet.push(1) } });
    await ok.inject({ url: "/v1/home" });
    await ok.inject({ url: "/v1/nope" });
    await ok.close();
    expect(quiet).toEqual([]);
  });

  it("is off unless SENTRY_DSN is set", () => {
    expect(loadEnv({ ...process.env, DATABASE_URL: "postgresql://x" }).SENTRY_DSN).toBeUndefined();
  });
});
