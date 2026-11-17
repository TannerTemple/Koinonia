import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { csvField, toCsv } from "../src/lib/csv";
import { call, createTestApp, prisma, resetDb, signUp, TODAY, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let api: Api;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  api = await signUp(ctx.app, { name: "Export Tester", email: "export@example.com", phone: "+1 555 010 2000" });
});
afterAll(async () => {
  await ctx.app.close();
});

/** Rows are stamped by the database's own clock, not the app's (which the tests pin to TODAY). */
const ADDED = new Date().toISOString().slice(0, 10);

/** An account with one of everything. */
async function fill(who: Api = api) {
  const mom = (await who.call("POST", "/contacts", { name: "Mom", phone: "555-010-3000", cadenceDays: 7, groups: ["Family"], favorite: true, birthday: "11-20", reminderTime: "18:30" })).body.id;
  await who.call("POST", "/contacts", { name: "=cmd|' /C calc'!A0", cadenceDays: null });
  await who.call("POST", `/contacts/${mom}/notes`, { body: 'She said "call me, anytime"\nand meant it', followUpDay: "2026-11-20", pinned: true });
  await who.call("POST", `/contacts/${mom}/reach-out`, { channel: "CALL", summary: "Long chat, all good" });
  const prayer = (await who.call("POST", "/intentions", { title: "Mom's knee surgery", contactId: mom, details: "Friday morning" })).body.id;
  await who.call("POST", `/intentions/${prayer}/pray`);
  await who.call("POST", "/intentions", { title: "Patience" });
  await who.call("GET", "/prayer/today");
  await who.call("POST", "/devices", { token: "ExponentPushToken[x]", platform: "ios" });
  await who.call("POST", "/me/calendar-feed");
  return { mom, prayer };
}

describe("CSV writing", () => {
  it("quotes what needs quoting and doubles quotes", () => {
    expect(csvField("plain")).toBe("plain");
    expect(csvField("a, b")).toBe('"a, b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("two\nlines")).toBe('"two\nlines"');
    expect([csvField(null), csvField(undefined), csvField(0), csvField(false)]).toEqual(["", "", "0", "false"]);
  });

  it("stops a cell from being run as a spreadsheet formula", () => {
    expect(csvField("=1+1")).toBe("'=1+1");
    expect(csvField("+15550102000")).toBe("'+15550102000");
    expect(csvField("-5")).toBe("'-5");
    expect(csvField("@handle")).toBe("'@handle");
    expect(csvField("=a,b")).toBe("\"'=a,b\"");
  });

  it("writes a header row, CRLF line ends and a byte-order mark", () => {
    expect(toCsv(["A", "B"], [[1, "x"], [2, null]])).toBe("﻿A,B\r\n1,x\r\n2,\r\n");
  });
});

describe("exporting my data", () => {
  it("needs a session", async () => {
    expect((await call(ctx.app, "GET", "/me/export")).status).toBe(401);
    expect((await call(ctx.app, "GET", "/me/export/people.csv")).status).toBe(401);
  });

  it("returns everything the account holds as JSON, in plain words", async () => {
    await fill();
    const res = await ctx.app.inject({ url: "/v1/me/export", headers: { authorization: `Bearer ${api.token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-disposition"]).toBe(`attachment; filename="koinonia-${TODAY}.json"`);
    expect(res.headers["cache-control"]).toBe("no-store");
    const data = res.json();

    expect(data.account).toMatchObject({ name: "Export Tester", email: "export@example.com", phone: "+15550102000", emailConfirmed: false });
    expect(data.people.map((p: any) => p.name)).toEqual(["=cmd|' /C calc'!A0", "Mom"]);
    const mom = data.people[1];
    expect(mom).toMatchObject({ phone: "5550103000", groups: ["Family"], favorite: true, birthday: "11-20", reachOutEveryDays: 7, reminderTime: "18:30", lastReachedOut: TODAY, archived: false });
    expect(mom.notes).toEqual([expect.objectContaining({ text: 'She said "call me, anytime"\nand meant it', pinned: true, followUpOn: "2026-11-20", followUpDone: false })]);
    expect(mom.reachOuts).toEqual([{ day: TODAY, how: "Call", summary: "Long chat, all good" }]);
    expect(data.prayers).toEqual([
      expect.objectContaining({ title: "Mom's knee surgery", for: "Mom", details: "Friday morning", status: "active", prayedOn: [TODAY] }),
      expect.objectContaining({ title: "Patience", for: null, prayedOn: [] }),
    ]);
  });

  it("never includes secrets or internal ids", async () => {
    await fill();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: api.userId } });
    const text = (await ctx.app.inject({ url: "/v1/me/export", headers: { authorization: `Bearer ${api.token}` } })).body;
    for (const secret of [user.passwordHash, user.calendarTokenHash!, api.token, api.userId, "ExponentPushToken", "passwordHash", "tokenHash"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("writes each table as CSV that a spreadsheet opens safely", async () => {
    await fill();
    const csv = async (table: string) => {
      const res = await ctx.app.inject({ url: `/v1/me/export/${table}.csv`, headers: { authorization: `Bearer ${api.token}` } });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(res.headers["content-disposition"]).toBe(`attachment; filename="koinonia-${table}-${TODAY}.csv"`);
      return res.body.replace("﻿", "").trimEnd().split("\r\n");
    };

    const people = await csv("people");
    expect(people[0]).toBe("Name,Phone,Email,Relationship,Birthday,Groups,Favorite,Reach out every (days),Reminder time,Usual way,Last reached out,Next due,Archived,Added");
    expect(people[1]!.startsWith("'=cmd|' /C calc'!A0,")).toBe(true); // not a formula any more
    expect(people[2]).toBe(`Mom,5550103000,,,11-20,Family,yes,7,18:30,Text,${TODAY},2026-11-19,,${ADDED}`);

    const notes = await csv("notes");
    expect(notes.join("\r\n")).toBe(`Person,Note,Pinned,Follow up on,Follow-up done,Written\r\nMom,"She said ""call me, anytime""\nand meant it",yes,2026-11-20,,${ADDED}`);

    expect(await csv("reach-outs")).toEqual(["Person,Day,How,Summary", `Mom,${TODAY},Call,"Long chat, all good"`]);
    expect(await csv("prayers")).toEqual([
      "Prayer,Details,For,Kind,Status,Times prayed,Last prayed,Added",
      `Mom's knee surgery,Friday morning,Mom,I said I'd pray,active,1,${TODAY},${ADDED}`,
      `Patience,,,Personal,active,0,,${ADDED}`,
    ]);
  });

  it("refuses unknown tables", async () => {
    for (const file of ["users.csv", "people", "people.json", "..%2Fenv.csv"]) {
      expect((await api.call("GET", `/me/export/${file}`)).status).toBe(404);
    }
  });

  it("only ever contains the signed-in user's own data", async () => {
    await fill();
    const other = await signUp(ctx.app, { name: "Someone Else" });
    await other.call("POST", "/contacts", { name: "Their Person" });
    const mine = (await ctx.app.inject({ url: "/v1/me/export", headers: { authorization: `Bearer ${api.token}` } })).body;
    const theirs = (await ctx.app.inject({ url: "/v1/me/export", headers: { authorization: `Bearer ${other.token}` } })).body;
    expect(mine).not.toContain("Their Person");
    expect(theirs).not.toContain("Mom");
    expect(JSON.parse(theirs).people.map((p: any) => p.name)).toEqual(["Their Person"]);
  });
});

describe("deleting my account", () => {
  it("removes every row the account owned, in every table, and nobody else's", async () => {
    const { mom } = await fill();
    await call(ctx.app, "POST", "/auth/forgot-password", { email: "export@example.com" });
    await ctx.app.background.idle();
    for (let i = 0; i < 2; i++) await call(ctx.app, "POST", "/auth/login", { email: "export@example.com", password: "wrong password" });

    // Someone else, who also has this user linked as one of their people.
    const other = await signUp(ctx.app, { name: "Keeper" });
    await other.call("POST", "/contacts", { name: "Export Tester", linkedUserId: api.userId });
    await other.call("POST", "/intentions", { title: "Their prayer" });

    const counts = async () => ({
      users: await prisma.user.count(),
      sessions: await prisma.session.count({ where: { userId: api.userId } }),
      contacts: await prisma.contact.count({ where: { userId: api.userId } }),
      interactions: await prisma.interaction.count({ where: { userId: api.userId } }),
      notes: await prisma.note.count({ where: { userId: api.userId } }),
      intentions: await prisma.prayerIntention.count({ where: { userId: api.userId } }),
      prayerLogs: await prisma.prayerLog.count({ where: { userId: api.userId } }),
      dailyIntentions: await prisma.dailyIntention.count({ where: { userId: api.userId } }),
      devices: await prisma.pushDevice.count({ where: { userId: api.userId } }),
      authTokens: await prisma.authToken.count({ where: { userId: api.userId } }),
      throttles: await prisma.loginThrottle.count({ where: { email: "export@example.com" } }),
    });
    const before = await counts();
    // The test only means something if there was a row of every kind to delete.
    for (const [table, n] of Object.entries(before)) expect(n, table).toBeGreaterThan(0);

    expect((await api.call("DELETE", "/me", { password: "correct horse battery" })).status).toBe(204);

    expect(await counts()).toEqual({ users: 1, sessions: 0, contacts: 0, interactions: 0, notes: 0, intentions: 0, prayerLogs: 0, dailyIntentions: 0, devices: 0, authTokens: 0, throttles: 0 });
    expect(await prisma.note.count({ where: { contactId: mom } })).toBe(0);

    // The other account is intact; its link to the deleted member is simply cleared.
    const theirs = (await other.call("GET", "/contacts")).body;
    expect(theirs).toHaveLength(1);
    expect(theirs[0]).toMatchObject({ name: "Export Tester", linkedUserId: null });
    expect((await other.call("GET", "/intentions")).body).toHaveLength(1);

    // The old session is dead and the email is free to register again.
    expect((await api.call("GET", "/me")).status).toBe(401);
    expect((await call(ctx.app, "POST", "/auth/register", { name: "Back Again", email: "export@example.com", password: "a brand new password" })).status).toBe(201);
  });
});
