import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { createMockProviders } from "../src/providers";
import { createTestApp, prisma, resetDb, signUp, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let api: Api;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  api = await signUp(ctx.app, { name: "Tess Tester", email: "tess@example.com" });
});
afterAll(async () => {
  await ctx.app.close();
});

const message = { kind: "PROBLEM", message: "The Pray tab showed nothing after I added Mom.", appVersion: "1.0.0", platform: "ios" };

describe("send feedback", () => {
  it("saves the message with the app version, and needs a signed-in person", async () => {
    const res = await api.call("POST", "/feedback", message);
    expect(res.status).toBe(201);
    const rows = await prisma.feedback.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: api.userId, kind: "PROBLEM", message: message.message, appVersion: "1.0.0", platform: "ios" });

    const anonymous = await ctx.app.inject({ method: "POST", url: "/v1/feedback", payload: message });
    expect(anonymous.statusCode).toBe(401);
  });

  it("refuses an empty message, an unknown platform and a missing version", async () => {
    expect((await api.call("POST", "/feedback", { ...message, message: "  " })).status).toBe(400);
    expect((await api.call("POST", "/feedback", { ...message, platform: "toaster" })).status).toBe(400);
    expect((await api.call("POST", "/feedback", { kind: "IDEA", message: "Dark mode please", platform: "web" })).status).toBe(400);
    expect((await api.call("POST", "/feedback", { ...message, message: "x".repeat(4001) })).status).toBe(400);
    expect(await prisma.feedback.count()).toBe(0);
  });

  it("emails nobody unless FEEDBACK_EMAIL is set", async () => {
    await api.call("POST", "/feedback", message);
    await ctx.app.background.idle();
    expect(ctx.providers.email.sent.filter((m) => /feedback/i.test(m.subject))).toEqual([]);
  });

  it("emails a copy to FEEDBACK_EMAIL, and keeps the words out of the log", async () => {
    const lines: string[] = [];
    const logStream = { write: (line: string) => void lines.push(line) };
    const providers = createMockProviders();
    const app = await buildApp({ prisma, providers, env: loadEnv({ ...process.env, FEEDBACK_EMAIL: "owner@example.com" }), rateLimit: false, logger: true, logStream });
    const res = await app.inject({ method: "POST", url: "/v1/feedback", payload: { ...message, kind: "IDEA" }, headers: { authorization: `Bearer ${api.token}` } });
    await app.background.idle();
    await app.close();

    expect(res.statusCode).toBe(201);
    expect(providers.email.sent).toHaveLength(1);
    const mail = providers.email.sent[0]!;
    expect(mail.to).toBe("owner@example.com");
    expect(mail.subject).toBe("Koinonia feedback: An idea (ios 1.0.0)");
    expect(mail.text).toContain(message.message);
    expect(mail.text).toContain("From: Tess Tester <tess@example.com>");

    const log = lines.join("");
    expect(log).toContain("feedback received");
    expect(log).toContain('"appVersion":"1.0.0"');
    expect(log).not.toContain("Pray tab");
    expect(log).not.toContain("tess@example.com");
  });

  it("rejects a FEEDBACK_EMAIL that is not an address", () => {
    expect(() => loadEnv({ ...process.env, FEEDBACK_EMAIL: "the owner" })).toThrow(/FEEDBACK_EMAIL must be an email address/);
  });

  it("lets only an admin read what was sent, newest first", async () => {
    await api.call("POST", "/feedback", message);
    await api.call("POST", "/feedback", { ...message, kind: "IDEA", message: "A widget would be lovely", platform: "web", appVersion: "0.1.0 (abc1234)" });
    expect((await api.call("GET", "/admin/feedback")).status).toBe(403);

    const admin = await signUp(ctx.app, { name: "Owner" });
    await prisma.user.update({ where: { id: admin.userId }, data: { role: "ADMIN" } });
    const res = await admin.call("GET", "/admin/feedback");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((f: { message: string }) => f.message)).toEqual(expect.arrayContaining([message.message, "A widget would be lovely"]));
    expect(res.body[0]).toMatchObject({ userName: "Tess Tester", userEmail: "tess@example.com" });
  });

  it("is removed with the account", async () => {
    await api.call("POST", "/feedback", message);
    const gone = await api.call("DELETE", "/me", { password: "correct horse battery" });
    expect(gone.status).toBe(204);
    expect(await prisma.feedback.count()).toBe(0);
  });

  it("allows ten an hour from one person", async () => {
    const app = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv(process.env) });
    const send = () => app.inject({ method: "POST", url: "/v1/feedback", payload: message, headers: { authorization: `Bearer ${api.token}` } });
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) statuses.push((await send()).statusCode);
    await app.close();
    expect(statuses.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });
});
