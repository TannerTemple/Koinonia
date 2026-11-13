import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { call, createTestApp, NOW, prisma, resetDb, signUp, type TestContext } from "./helpers";

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(resetDb);
afterAll(async () => {
  await ctx.app.close();
});

const creds = { name: "Tanner", email: "tanner@example.com", password: "correct horse battery" };

describe("auth", () => {
  it("registers, normalizes the email and never returns the password hash", async () => {
    const res = await call(ctx.app, "POST", "/auth/register", {
      ...creds,
      email: " Tanner@Example.com ",
      timezone: "America/Chicago",
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "tanner@example.com", role: "USER", timezone: "America/Chicago" });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "tanner@example.com" } });
    expect(stored.passwordHash).not.toContain(creds.password);
  });

  it("rejects invalid input with field errors", async () => {
    const res = await call(ctx.app, "POST", "/auth/register", { name: "", email: "nope", password: "short" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(["name", "email", "password"]));
  });

  it("rejects a duplicate email", async () => {
    await call(ctx.app, "POST", "/auth/register", creds);
    const res = await call(ctx.app, "POST", "/auth/register", creds);
    expect(res.status).toBe(409);
  });

  it("logs in with the right password only", async () => {
    await call(ctx.app, "POST", "/auth/register", creds);
    const bad = await call(ctx.app, "POST", "/auth/login", { email: creds.email, password: "wrong password" });
    expect(bad.status).toBe(401);
    const unknown = await call(ctx.app, "POST", "/auth/login", { email: "nobody@example.com", password: "whatever12" });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message);

    const ok = await call(ctx.app, "POST", "/auth/login", { email: "TANNER@example.com", password: creds.password });
    expect(ok.status).toBe(200);
    const me = await call(ctx.app, "GET", "/me", undefined, ok.body.token);
    expect(me.body.email).toBe(creds.email);
  });

  it("locks an email out after repeated wrong passwords, then lets it back in", async () => {
    const who = { ...creds, email: "locked@example.com" };
    await call(ctx.app, "POST", "/auth/register", who);
    for (let i = 0; i < 8; i++) {
      const res = await call(ctx.app, "POST", "/auth/login", { email: who.email, password: "wrong password" });
      expect(res.status).toBe(401);
    }
    // Even the right password is refused while locked out.
    const locked = await call(ctx.app, "POST", "/auth/login", { email: who.email, password: who.password });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("RATE_LIMITED");

    ctx.setNow("2026-11-12T12:16:00Z");
    const later = await call(ctx.app, "POST", "/auth/login", { email: who.email, password: who.password });
    expect(later.status).toBe(200);
    ctx.setNow(NOW);
  });

  it("requires a valid token", async () => {
    expect((await call(ctx.app, "GET", "/me")).status).toBe(401);
    expect((await call(ctx.app, "GET", "/me", undefined, "garbage")).status).toBe(401);
    expect((await call(ctx.app, "GET", "/home")).status).toBe(401);
  });

  it("logout revokes the token", async () => {
    const api = await signUp(ctx.app);
    expect((await api.call("POST", "/auth/logout")).status).toBe(204);
    expect((await api.call("GET", "/me")).status).toBe(401);
  });

  it("expires sessions after 30 idle days and slides while in use", async () => {
    const api = await signUp(ctx.app);
    ctx.setNow("2026-12-02T12:00:00Z"); // 20 days later: still valid, and extends
    expect((await api.call("GET", "/me")).status).toBe(200);
    ctx.setNow("2026-12-27T12:00:00Z"); // 25 more days: valid only because it slid
    expect((await api.call("GET", "/me")).status).toBe(200);
    ctx.setNow("2027-02-15T12:00:00Z");
    expect((await api.call("GET", "/me")).status).toBe(401);
    ctx.setNow("2026-11-12T12:00:00Z");
  });

  it("updates the profile", async () => {
    const api = await signUp(ctx.app);
    const res = await api.call("PATCH", "/me", { name: "New Name", phone: "+1 (555) 010-2000", discoverable: false });
    expect(res.body).toMatchObject({ name: "New Name", phone: "+15550102000", discoverable: false });
    expect((await api.call("PATCH", "/me", { timezone: "Mars/Olympus" })).status).toBe(400);
  });

  it("changes the password and signs out other sessions", async () => {
    await call(ctx.app, "POST", "/auth/register", creds);
    const a = await call(ctx.app, "POST", "/auth/login", creds);
    const b = await call(ctx.app, "POST", "/auth/login", creds);
    const wrong = await call(ctx.app, "POST", "/me/password", { currentPassword: "nope", newPassword: "brand new password" }, a.body.token);
    expect(wrong.status).toBe(400);
    const ok = await call(ctx.app, "POST", "/me/password", { currentPassword: creds.password, newPassword: "brand new password" }, a.body.token);
    expect(ok.status).toBe(204);
    expect((await call(ctx.app, "GET", "/me", undefined, a.body.token)).status).toBe(200);
    expect((await call(ctx.app, "GET", "/me", undefined, b.body.token)).status).toBe(401);
    expect((await call(ctx.app, "POST", "/auth/login", { email: creds.email, password: "brand new password" })).status).toBe(200);
  });

  it("deletes the account and everything in it", async () => {
    const api = await signUp(ctx.app);
    await api.call("POST", "/contacts", { name: "Ana" });
    // A session alone is not enough: the password is asked for again.
    expect((await api.call("DELETE", "/me")).status).toBe(400);
    expect((await api.call("DELETE", "/me", { password: "not my password" })).status).toBe(400);
    expect(await prisma.user.count()).toBe(1);
    expect((await api.call("DELETE", "/me", { password: "correct horse battery" })).status).toBe(204);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.contact.count()).toBe(0);
  });

  it("registers a push device once per token", async () => {
    const api = await signUp(ctx.app);
    const device = { token: "ExponentPushToken[abc]", platform: "ios" };
    expect((await api.call("POST", "/devices", device)).status).toBe(204);
    expect((await api.call("POST", "/devices", device)).status).toBe(204);
    expect(await prisma.pushDevice.count()).toBe(1);
  });

  it("serves a health check and 404s unknown routes", async () => {
    expect((await ctx.app.inject({ url: "/health" })).statusCode).toBe(200);
    expect((await call(ctx.app, "GET", "/nope")).status).toBe(404);
  });

  it("keeps the lockout in the database, so every API instance enforces it", async () => {
    const who = { ...creds, email: "shared-lock@example.com" };
    await call(ctx.app, "POST", "/auth/register", who);
    for (let i = 0; i < 8; i++) await call(ctx.app, "POST", "/auth/login", { email: who.email, password: "wrong password" });
    expect(await prisma.loginThrottle.findUnique({ where: { email: who.email } })).toMatchObject({ count: 8 });

    const second = await createTestApp(); // a second API process sharing the database
    const res = await call(second.app, "POST", "/auth/login", { email: who.email, password: who.password });
    await second.app.close();
    expect(res.status).toBe(429);
  });

  it("upgrades an old, cheaper password hash at the next sign-in", async () => {
    await call(ctx.app, "POST", "/auth/register", creds);
    const { scrypt } = await import("node:crypto");
    const salt = Buffer.from("0123456789abcdef");
    const key: Buffer = await new Promise((ok, no) => scrypt(creds.password, salt, 64, { N: 1024, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));
    const weak = ["scrypt", "10", salt.toString("base64"), key.toString("base64")].join("$");
    await prisma.user.update({ where: { email: creds.email }, data: { passwordHash: weak } });

    expect((await call(ctx.app, "POST", "/auth/login", { email: creds.email, password: "wrong password" })).status).toBe(401);
    expect((await call(ctx.app, "POST", "/auth/login", creds)).status).toBe(200);
    const after = await prisma.user.findUniqueOrThrow({ where: { email: creds.email } });
    expect(after.passwordHash).not.toBe(weak);
    expect(after.passwordHash.split("$")[1]).toBe("14");
    expect((await call(ctx.app, "POST", "/auth/login", creds)).status).toBe(200);
  });

  it("signs the web app in with an httpOnly cookie that needs the client header", async () => {
    const web = { "x-koinonia-client": "web" };
    const reg = await ctx.app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...creds, email: "cookie@example.com" }, headers: web });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().token).toBe(""); // nothing for page scripts to steal
    const setCookie = String(reg.headers["set-cookie"]);
    expect(setCookie).toMatch(/^koinonia_session=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax; Max-Age=2592000/);
    const cookie = setCookie.split(";")[0]!;

    const me = await ctx.app.inject({ method: "GET", url: "/v1/me", headers: { ...web, cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe("cookie@example.com");

    // A cross-site form or image can send the cookie but not the custom header.
    expect((await ctx.app.inject({ method: "GET", url: "/v1/me", headers: { cookie } })).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: "DELETE", url: "/v1/me", headers: { cookie }, payload: { password: creds.password } })).statusCode).toBe(401);

    const out = await ctx.app.inject({ method: "POST", url: "/v1/auth/logout", headers: { ...web, cookie }, payload: {} });
    expect(out.statusCode).toBe(204);
    expect(String(out.headers["set-cookie"])).toContain("Max-Age=0");
    expect((await ctx.app.inject({ method: "GET", url: "/v1/me", headers: { ...web, cookie } })).statusCode).toBe(401);
  });

  it("gives the iOS app a token and no cookie", async () => {
    const reg = await ctx.app.inject({ method: "POST", url: "/v1/auth/register", payload: { ...creds, email: "ios@example.com" } });
    expect(reg.json().token).toMatch(/^[\w-]{43}$/);
    expect(reg.headers["set-cookie"]).toBeUndefined();
  });

  it("unregisters the phone's push token at sign-out", async () => {
    const api = await signUp(ctx.app);
    await api.call("POST", "/devices", { token: "ExponentPushToken[mine]", platform: "ios" });
    await api.call("POST", "/devices", { token: "ExponentPushToken[tablet]", platform: "ios" });
    expect((await api.call("POST", "/auth/logout", { pushToken: "ExponentPushToken[mine]" })).status).toBe(204);
    expect((await prisma.pushDevice.findMany()).map((d) => d.token)).toEqual(["ExponentPushToken[tablet]"]);
  });
});
