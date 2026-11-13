import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, prisma, resetDb, signUp, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let api: Api;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  api = await signUp(ctx.app, { name: "Searcher" });
});
afterAll(async () => {
  await ctx.app.close();
});

describe("finding people on Koinonia", () => {
  it("finds members by name, exact email or phone — and never yourself", async () => {
    const maria = await signUp(ctx.app, { name: "Maria Lopez", email: "maria@example.com", phone: "+1 555 010 2000" });
    await signUp(ctx.app, { name: "Mario Rossi", email: "mario@example.com" });

    const byName = await api.call("GET", "/users/search?q=mari");
    expect(byName.body.map((u: any) => u.name)).toEqual(["Maria Lopez", "Mario Rossi"]);
    expect(byName.body[0]).toMatchObject({ matchedBy: "name", email: null, phone: null, alreadyContact: false });

    // An address nobody has confirmed can't be found: anyone could have typed it at sign-up.
    expect((await api.call("GET", "/users/search?q=maria@example.com")).body).toEqual([]);
    await prisma.user.update({ where: { id: maria.userId }, data: { emailVerifiedAt: new Date() } });
    const byEmail = await api.call("GET", "/users/search?q=MARIA@example.com");
    expect(byEmail.body).toMatchObject([{ id: maria.userId, matchedBy: "email", email: "maria@example.com" }]);
    expect((await api.call("GET", "/users/search?q=mar@example.com")).body).toEqual([]);

    const byPhone = await api.call("GET", `/users/search?q=${encodeURIComponent("(555) 010-2000")}`);
    expect(byPhone.body).toMatchObject([{ id: maria.userId, matchedBy: "phone" }]);

    // A fragment of a number must not reveal the whole number.
    expect((await api.call("GET", "/users/search?q=0102000")).body).toEqual([]);
    expect((await api.call("GET", "/users/search?q=5550102000")).body).toHaveLength(1);
    expect((await api.call("GET", "/users/search?q=Searcher")).body).toEqual([]);
    expect((await api.call("GET", "/users/search?q=m")).body).toEqual([]);
    // Names match from the start of a first or last name only, so the list can't be browsed by fragment.
    expect((await api.call("GET", "/users/search?q=ma")).body).toEqual([]);
    expect((await api.call("GET", "/users/search?q=ari")).body).toEqual([]);
    expect((await api.call("GET", "/users/search?q=lop")).body.map((u: any) => u.name)).toEqual(["Maria Lopez"]);
  });

  it("respects the discoverable setting", async () => {
    const hidden = await signUp(ctx.app, { name: "Hidden Hank", email: "hank@example.com" });
    await hidden.call("PATCH", "/me", { discoverable: false });
    expect((await api.call("GET", "/users/search?q=hank")).body).toEqual([]);
    expect((await api.call("GET", "/users/search?q=hank@example.com")).body).toEqual([]);
    const res = await api.call("POST", "/contacts", { name: "Hank", linkedUserId: hidden.userId });
    expect(res.status).toBe(400);
  });

  it("adds a found member as a linked contact", async () => {
    const maria = await signUp(ctx.app, { name: "Maria Lopez" });
    const created = await api.call("POST", "/contacts", { name: "Maria Lopez", linkedUserId: maria.userId, cadenceDays: 14 });
    expect(created.status).toBe(201);
    expect(created.body.linkedUserId).toBe(maria.userId);
    const again = await api.call("GET", "/users/search?q=maria");
    expect(again.body[0].alreadyContact).toBe(true);
    expect((await api.call("POST", "/contacts", { name: "Me", linkedUserId: api.userId })).status).toBe(400);
  });
});

describe("admin", () => {
  async function makeAdmin() {
    const admin = await signUp(ctx.app, { name: "Admin" });
    await prisma.user.update({ where: { id: admin.userId }, data: { role: "ADMIN" } });
    return admin;
  }

  it("is closed to regular users and signed-out visitors", async () => {
    expect((await api.call("GET", "/admin/stats")).status).toBe(403);
    expect((await api.call("GET", "/admin/users")).status).toBe(403);
    expect((await api.call("PATCH", `/admin/users/${api.userId}`, { role: "ADMIN" })).status).toBe(403);
    expect((await ctx.app.inject({ url: "/v1/admin/stats" })).statusCode).toBe(401);
  });

  it("reports stats and lists users", async () => {
    const admin = await makeAdmin();
    const c = await api.call("POST", "/contacts", { name: "Ana", cadenceDays: 7 });
    await api.call("POST", `/contacts/${c.body.id}/reach-out`, {});
    const i = await api.call("POST", "/intentions", { title: "Peace" });
    await api.call("POST", `/intentions/${i.body.id}/pray`);

    const stats = await admin.call("GET", "/admin/stats");
    expect(stats.body).toMatchObject({ users: 2, newUsersThisWeek: 2, contacts: 1, reachOuts: 1, reachOutsThisWeek: 1, intentions: 1, prayers: 1 });

    const users = await admin.call("GET", "/admin/users");
    expect(users.body).toHaveLength(2);
    const searcher = users.body.find((u: any) => u.name === "Searcher");
    expect(searcher).toMatchObject({ contactCount: 1, intentionCount: 1, disabled: false });
    expect((await admin.call("GET", "/admin/users?q=searcher")).body).toHaveLength(1);
  });

  it("promotes, disables and re-enables users, but not itself", async () => {
    const admin = await makeAdmin();
    const promoted = await admin.call("PATCH", `/admin/users/${api.userId}`, { role: "ADMIN" });
    expect(promoted.body.role).toBe("ADMIN");
    expect((await api.call("GET", "/admin/stats")).status).toBe(200);

    const disabled = await admin.call("PATCH", `/admin/users/${api.userId}`, { disabled: true });
    expect(disabled.body.disabled).toBe(true);
    expect((await api.call("GET", "/me")).status).toBe(401); // signed out everywhere
    const login = await ctx.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: disabled.body.email, password: "correct horse battery" },
    });
    expect(login.statusCode).toBe(403);

    const enabled = await admin.call("PATCH", `/admin/users/${api.userId}`, { disabled: false });
    expect(enabled.body.disabled).toBe(false);
    expect((await admin.call("PATCH", `/admin/users/${admin.userId}`, { disabled: true })).status).toBe(400);
    expect((await admin.call("PATCH", "/admin/users/nope", { disabled: true })).status).toBe(404);
  });
});
