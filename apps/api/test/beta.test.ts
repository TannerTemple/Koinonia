import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { createMockProviders } from "../src/providers";
import { call, createTestApp, prisma, resetDb, signUp, type TestContext } from "./helpers";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await ctx.app.close();
});

const ask = (body: unknown) => call(ctx.app, "POST", "/beta/signup", body);

describe("asking for a beta invite", () => {
  it("stores the email, the phone and the moment of consent, without an account", async () => {
    const res = await ask({ email: " Ana@Example.com ", name: "Ana", device: "iphone", consent: true });
    expect(res.status).toBe(201);
    const rows = await prisma.betaSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "ana@example.com", name: "Ana", device: "iphone" });
    expect(rows[0]!.consentAt).toBeInstanceOf(Date);
  });

  it("stores nothing without consent or with a bad email", async () => {
    expect((await ask({ email: "ana@example.com", device: "iphone" })).status).toBe(400);
    expect((await ask({ email: "ana@example.com", device: "iphone", consent: false })).status).toBe(400);
    expect((await ask({ email: "not-an-email", consent: true })).status).toBe(400);
    expect((await ask({ email: "ana@example.com", device: "fridge", consent: true })).status).toBe(400);
    expect(await prisma.betaSignup.count()).toBe(0);
  });

  it("answers the same the second time, and keeps one row", async () => {
    const first = await ask({ email: "ana@example.com", device: "iphone", consent: true });
    const second = await ask({ email: "ANA@example.com", device: "android", consent: true });
    expect(second.status).toBe(first.status);
    expect(second.body).toEqual(first.body);
    const rows = await prisma.betaSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.device).toBe("android");
  });

  it("lets only an admin read or remove the list", async () => {
    await ask({ email: "ana@example.com", device: "iphone", consent: true });
    const member = await signUp(ctx.app);
    expect((await member.call("GET", "/admin/beta-signups")).status).toBe(403);
    expect((await ctx.app.inject({ url: "/v1/admin/beta-signups" })).statusCode).toBe(401);

    await prisma.user.update({ where: { id: member.userId }, data: { role: "ADMIN" } });
    const list = await member.call("GET", "/admin/beta-signups");
    expect(list.body).toEqual([expect.objectContaining({ email: "ana@example.com", device: "iphone", name: null })]);
    expect((await member.call("DELETE", `/admin/beta-signups/${list.body[0].id}`)).status).toBe(204);
    expect((await member.call("DELETE", `/admin/beta-signups/${list.body[0].id}`)).status).toBe(404);
    expect(await prisma.betaSignup.count()).toBe(0);
  });

  it("allows five an hour from one address", async () => {
    const app = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv(process.env) });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await app.inject({ method: "POST", url: "/v1/beta/signup", payload: { email: `p${i}@example.com`, device: "iphone", consent: true } })).statusCode);
    await app.close();
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});
