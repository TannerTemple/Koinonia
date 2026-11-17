import { addDays } from "@koinonia/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, NOW, prisma, resetDb, signUp, TODAY, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let api: Api;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  ctx.setNow(NOW);
  api = await signUp(ctx.app, { name: "Owner" });
  // The database stamps accounts with the real clock; the tests run on a pinned one.
  await prisma.user.update({ where: { id: api.userId }, data: { role: "ADMIN", createdAt: new Date(NOW) } });
});
afterAll(async () => {
  await ctx.app.close();
});

const usage = async () => {
  await ctx.app.background.idle();
  return (await prisma.usageCount.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] })).map((u) => `${u.kind}|${u.name}|${u.platform}|${u.count}`);
};

describe("beta metrics", () => {
  it("is for admins only", async () => {
    const member = await signUp(ctx.app);
    expect((await member.call("GET", "/admin/metrics")).status).toBe(403);
    expect((await ctx.app.inject({ url: "/v1/admin/metrics" })).statusCode).toBe(401);
  });

  it("counts actions from the routes that succeed, and nothing from ones that fail", async () => {
    const mom = (await api.call("POST", "/contacts", { name: "Mom", cadenceDays: 7 })).body.id;
    await api.call("POST", `/contacts/${mom}/reach-out`, {});
    await api.call("POST", `/contacts/${mom}/reach-out`, {});
    await api.call("POST", "/contacts", { name: "" }); // refused
    await api.call("GET", `/contacts/${mom}`); // reading is not an action
    expect(await usage()).toEqual(["action|Added a person|app|1", "action|Logged a reach-out|app|2"]);
  });

  it("counts screens as patterns, never with an id or a name in them", async () => {
    const res = await api.call("POST", "/usage", { platform: "web", screens: ["/", "/people/cmh2x9k0a0001abcdxyz12345", "/people/cmh2x9k0a0002abcdxyz12345", "/people/Maria%20Lopez?x=1", "https://evil.example"] });
    expect(res.status).toBe(204);
    expect(await usage()).toEqual(["screen|/|web|1", "screen|/people/:id|web|3"]);
    const stored = JSON.stringify(await prisma.usageCount.findMany());
    expect(stored).not.toContain("cmh2x9k0a");
    expect(stored).not.toContain("Maria");
    expect(stored).not.toContain(api.userId);
  });

  it("needs a signed-in person and a sensible body to count a screen", async () => {
    expect((await ctx.app.inject({ method: "POST", url: "/v1/usage", payload: { platform: "web", screens: ["/"] } })).statusCode).toBe(401);
    expect((await api.call("POST", "/usage", { platform: "tv", screens: ["/"] })).status).toBe(400);
    expect((await api.call("POST", "/usage", { platform: "web", screens: Array(21).fill("/") })).status).toBe(400);
  });

  it("reports sign-ups, activation, retention and weekly active users as counts", async () => {
    // Someone who joined five weeks ago, added three people that day, and came back in weeks 1 and 4.
    const old = await signUp(ctx.app, { name: "Regular" });
    const joined = new Date(new Date(NOW).getTime() - 36 * 86_400_000);
    const joinedDay = joined.toISOString().slice(0, 10);
    await prisma.user.update({ where: { id: old.userId }, data: { createdAt: joined } });
    for (const name of ["A", "B", "C"]) await prisma.contact.create({ data: { userId: old.userId, name, createdAt: joined } });
    const person = (await prisma.contact.findFirstOrThrow({ where: { userId: old.userId } })).id;
    for (const offset of [8, 30]) await prisma.interaction.create({ data: { userId: old.userId, contactId: person, day: addDays(joinedDay, offset) } });
    await api.call("POST", "/usage", { platform: "app", screens: ["/contact/reach-out"] });
    await ctx.app.background.idle();

    const { status, body } = await api.call("GET", "/admin/metrics");
    expect(status).toBe(200);
    expect(body.today).toBe(TODAY);
    expect(body.totals).toEqual({ accounts: 2, activated: 1 });
    expect(body.weeks).toHaveLength(12);
    const cohort = body.weeks.find((w: { signups: number; activated: number }) => w.activated === 1);
    expect(cohort).toMatchObject({ signups: 1, activated: 1, week1Retained: 1, week1Known: true, week4Retained: 1 });
    expect(body.weeks.at(-1)).toMatchObject({ signups: 1, activated: 0, week1Known: false });
    expect(body.weeks.reduce((n: number, w: { activeUsers: number }) => n + w.activeUsers, 0)).toBe(2);
    expect(body.usage).toEqual([{ kind: "screen", name: "/contact/reach-out", platform: "app", count: 1 }]);

    // Counts only: no names, emails or ids anywhere in the report.
    const text = JSON.stringify(body);
    for (const secret of ["Regular", "Owner", "example.com", old.userId, api.userId, person]) expect(text).not.toContain(secret);
  });
});
