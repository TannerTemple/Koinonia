import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createTestApp, NOW, prisma, resetDb, type TestContext } from "./helpers";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  ctx.providers.email.sent.length = 0;
  ctx.setNow(NOW);
});
afterAll(async () => {
  await ctx.app.close();
});

const creds = { name: "Tanner", email: "recover@example.com", password: "correct horse battery" };
const post = (url: string, body?: unknown, token?: string) => call(ctx.app, "POST", url, body, token);

/** Emails go out after the response; wait for the one we expect and pull the token out of it. */
async function emailedToken(subject: RegExp, to = creds.email): Promise<string> {
  for (let i = 0; i < 100; i++) {
    const mail = ctx.providers.email.sent.find((m) => m.to === to && subject.test(m.subject));
    if (mail) {
      ctx.providers.email.sent.splice(ctx.providers.email.sent.indexOf(mail), 1);
      return /token=([\w-]+)/.exec(mail.text)![1]!;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`no email matching ${subject}`);
}
const settle = () => new Promise((r) => setTimeout(r, 150));

describe("email verification", () => {
  it("emails a link on sign-up that verifies once", async () => {
    const reg = await post("/auth/register", creds);
    expect(reg.body.user.emailVerified).toBe(false);
    const token = await emailedToken(/Confirm your email/);

    expect((await post("/auth/verify-email", { token })).status).toBe(204);
    const me = await call(ctx.app, "GET", "/me", undefined, reg.body.token);
    expect(me.body.emailVerified).toBe(true);

    expect((await post("/auth/verify-email", { token })).status).toBe(400);
  });

  it("rejects made-up and expired tokens", async () => {
    await post("/auth/register", creds);
    const token = await emailedToken(/Confirm your email/);
    expect((await post("/auth/verify-email", { token: "x".repeat(43) })).status).toBe(400);
    expect((await post("/auth/verify-email", { token: "short" })).status).toBe(400);
    ctx.setNow("2026-11-16T12:00:00Z");
    expect((await post("/auth/verify-email", { token })).status).toBe(400);
  });

  it("resends on request, replacing the old link, and only while unverified", async () => {
    const reg = await post("/auth/register", creds);
    const first = await emailedToken(/Confirm your email/);
    expect((await post("/auth/resend-verification")).status).toBe(401);
    expect((await post("/auth/resend-verification", undefined, reg.body.token)).status).toBe(204);
    const second = await emailedToken(/Confirm your email/);
    expect(second).not.toBe(first);
    expect((await post("/auth/verify-email", { token: first })).status).toBe(400);
    expect((await post("/auth/verify-email", { token: second })).status).toBe(204);

    await post("/auth/resend-verification", undefined, reg.body.token);
    await settle();
    expect(ctx.providers.email.sent).toHaveLength(0);
  });

  it("can't be used as a password-reset token", async () => {
    await post("/auth/register", creds);
    const token = await emailedToken(/Confirm your email/);
    expect((await post("/auth/reset-password", { token, password: "another long password" })).status).toBe(400);
  });
});

describe("password reset", () => {
  it("answers the same whether or not the email has an account", async () => {
    await post("/auth/register", creds);
    await emailedToken(/Confirm your email/);
    const known = await post("/auth/forgot-password", { email: creds.email });
    const unknown = await post("/auth/forgot-password", { email: "nobody@example.com" });
    expect(known.status).toBe(204);
    expect(unknown).toEqual(known);
    await emailedToken(/Reset your Koinonia password/);
    await settle();
    expect(ctx.providers.email.sent).toHaveLength(0); // nothing went to the unknown address
  });

  it("stores only a hash of the token", async () => {
    await post("/auth/register", creds);
    await post("/auth/forgot-password", { email: creds.email });
    const token = await emailedToken(/Reset your Koinonia password/);
    const rows = await prisma.authToken.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("sets a new password once, signs out every session and verifies the email", async () => {
    const reg = await post("/auth/register", creds);
    await post("/auth/forgot-password", { email: creds.email });
    const token = await emailedToken(/Reset your Koinonia password/);

    expect((await post("/auth/reset-password", { token, password: "short" })).status).toBe(400);
    expect((await post("/auth/reset-password", { token, password: "a brand new password" })).status).toBe(204);

    expect((await call(ctx.app, "GET", "/me", undefined, reg.body.token)).status).toBe(401);
    expect((await post("/auth/login", { email: creds.email, password: creds.password })).status).toBe(401);
    const login = await post("/auth/login", { email: creds.email, password: "a brand new password" });
    expect(login.status).toBe(200);
    expect(login.body.user.emailVerified).toBe(true);

    // Single use.
    expect((await post("/auth/reset-password", { token, password: "yet another password" })).status).toBe(400);
  });

  it("expires after an hour, and a newer request cancels the older link", async () => {
    await post("/auth/register", creds);
    await post("/auth/forgot-password", { email: creds.email });
    const first = await emailedToken(/Reset your Koinonia password/);
    await post("/auth/forgot-password", { email: creds.email });
    const second = await emailedToken(/Reset your Koinonia password/);
    expect((await post("/auth/reset-password", { token: first, password: "a brand new password" })).status).toBe(400);

    ctx.setNow("2026-11-12T13:01:00Z");
    expect((await post("/auth/reset-password", { token: second, password: "a brand new password" })).status).toBe(400);
    expect((await post("/auth/login", { email: creds.email, password: creds.password })).status).toBe(200);
  });

  it("sends nothing to a disabled account", async () => {
    await post("/auth/register", creds);
    await emailedToken(/Confirm your email/);
    await prisma.user.update({ where: { email: creds.email }, data: { disabledAt: new Date() } });
    expect((await post("/auth/forgot-password", { email: creds.email })).status).toBe(204);
    await settle();
    expect(ctx.providers.email.sent).toHaveLength(0);
  });
});
