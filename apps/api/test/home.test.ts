import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { runDigest } from "../src/services/digest";
import { loadEnv } from "../src/env";
import { call, createTestApp, NOW, prisma, resetDb, signUp, TODAY, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let api: Api;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  ctx.setNow(NOW);
  api = await signUp(ctx.app, { name: "Tanner Temple", email: "tanner@example.com" });
});
afterAll(async () => {
  await ctx.app.close();
});

async function seedPeople() {
  await api.call("POST", "/contacts", { name: "Overdue Olive", cadenceDays: 7, lastContactedDay: "2026-10-20" });
  await api.call("POST", "/contacts", { name: "Today Tom", cadenceDays: 3, lastContactedDay: "2026-11-09" });
  await api.call("POST", "/contacts", { name: "Soon Sue", cadenceDays: 7, lastContactedDay: "2026-11-10", birthday: "1990-11-20" });
  await api.call("POST", "/contacts", { name: "Later Lou", cadenceDays: 90 });
  await api.call("POST", "/contacts", { name: "Quiet Quinn" });
}

describe("home", () => {
  it("is empty but well-formed for a new user", async () => {
    const res = await api.call("GET", "/home");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      today: TODAY,
      overdue: [],
      dueToday: [],
      upcoming: [],
      followUps: [],
      birthdays: [],
      prayer: { intention: null },
      streaks: { reachOut: { current: 0 }, prayer: { current: 0 } },
      stats: { contacts: 0, reachOutsThisWeek: 0, activeIntentions: 0 },
    });
  });

  it("sorts people into overdue, due today and upcoming", async () => {
    await seedPeople();
    const { body } = await api.call("GET", "/home");
    expect(body.overdue.map((c: any) => c.name)).toEqual(["Overdue Olive"]);
    expect(body.dueToday.map((c: any) => c.name)).toEqual(["Today Tom"]);
    expect(body.upcoming.map((c: any) => c.name)).toEqual(["Soon Sue"]);
    expect(body.birthdays).toMatchObject([{ day: "2026-11-20", contact: { name: "Soon Sue" } }]);
    expect(body.stats.contacts).toBe(5);
  });

  it("moves a person out of overdue after a reach-out or a snooze, and tracks the streak", async () => {
    await seedPeople();
    const before = (await api.call("GET", "/home")).body;
    await api.call("POST", `/contacts/${before.overdue[0].id}/reach-out`, {});
    await api.call("POST", `/contacts/${before.dueToday[0].id}/snooze`, { days: 30 });
    const after = (await api.call("GET", "/home")).body;
    expect(after.overdue).toEqual([]);
    expect(after.dueToday).toEqual([]);
    expect(after.upcoming.map((c: any) => c.name)).toEqual(["Soon Sue", "Overdue Olive"]);
    expect(after.streaks.reachOut).toEqual({ current: 1, longest: 1, doneToday: true });
    expect(after.stats.reachOutsThisWeek).toBe(1);
  });

  it("surfaces note follow-ups that are due within a week, until done", async () => {
    const contact = await api.call("POST", "/contacts", { name: "Ana" });
    const due = await api.call("POST", `/contacts/${contact.body.id}/notes`, { body: "Ask about the interview", followUpDay: "2026-11-11" });
    await api.call("POST", `/contacts/${contact.body.id}/notes`, { body: "Far away", followUpDay: "2027-03-01" });
    await api.call("POST", `/contacts/${contact.body.id}/notes`, { body: "Just a note" });
    let home = (await api.call("GET", "/home")).body;
    expect(home.followUps.map((n: any) => n.body)).toEqual(["Ask about the interview"]);
    expect(home.followUps[0].contactName).toBe("Ana");
    await api.call("PATCH", `/notes/${due.body.id}`, { followUpDone: true });
    home = (await api.call("GET", "/home")).body;
    expect(home.followUps).toEqual([]);
  });

  it("includes today's intention and the prayer streak", async () => {
    const intention = await api.call("POST", "/intentions", { title: "Grandma's health" });
    await api.call("POST", `/intentions/${intention.body.id}/pray`);
    ctx.setNow("2026-11-13T12:00:00Z");
    await api.call("POST", `/intentions/${intention.body.id}/pray`);
    const { body } = await api.call("GET", "/home");
    expect(body.prayer.intention).toMatchObject({ title: "Grandma's health", prayedToday: true });
    expect(body.streaks.prayer).toEqual({ current: 2, longest: 2, doneToday: true });
    expect(body.stats.activeIntentions).toBe(1);
  });

  it("uses the user's timezone to decide what day it is", async () => {
    // 03:00 UTC on the 13th is still the 12th in Chicago.
    ctx.setNow("2026-11-13T03:00:00Z");
    const chicago = await signUp(ctx.app, { timezone: "America/Chicago" });
    const rome = await signUp(ctx.app, { timezone: "Europe/Rome" });
    expect((await chicago.call("GET", "/home")).body.today).toBe("2026-11-12");
    expect((await rome.call("GET", "/home")).body.today).toBe("2026-11-13");
  });
});

describe("daily digest", () => {
  const env = loadEnv({ ...process.env, DIGEST_HOUR: "8", DIGEST_SMS: "true" });

  it("sends one digest a day to users with something due, through every channel", async () => {
    await seedPeople();
    await api.call("PATCH", "/me", { phone: "+15550102000" });
    await api.call("POST", "/devices", { token: "ExponentPushToken[abc]", platform: "ios" });
    await signUp(ctx.app); // nothing due → no digest

    const deps = { prisma, providers: ctx.providers, env };
    const first = await runDigest(deps, new Date(NOW));
    expect(first).toEqual({ considered: 2, sent: 1 });
    const digests = ctx.providers.email.sent.filter((m) => !m.subject.startsWith("Confirm your email"));
    expect(digests).toHaveLength(1);
    expect(digests[0]).toMatchObject({
      to: "tanner@example.com",
      subject: "Reach out to Overdue Olive and Today Tom today",
    });
    expect(digests[0]!.text).toContain("Overdue Olive — 16 days overdue");
    expect(ctx.providers.push.sent[0]).toMatchObject({ tokens: ["ExponentPushToken[abc]"] });
    expect(ctx.providers.sms.sent[0]).toMatchObject({ to: "+15550102000" });

    const second = await runDigest(deps, new Date(NOW));
    expect(second.sent).toBe(0);
    const tomorrow = await runDigest(deps, new Date("2026-11-13T12:00:00Z"));
    expect(tomorrow.sent).toBe(1);
  });

  it("waits for the digest hour and respects the opt-out", async () => {
    await seedPeople();
    const deps = { prisma, providers: ctx.providers, env };
    const digestCount = () => ctx.providers.email.sent.filter((m) => !m.subject.startsWith("Confirm your email")).length;
    const before = digestCount();
    expect((await runDigest(deps, new Date("2026-11-12T05:00:00Z"))).sent).toBe(0);
    await api.call("PATCH", "/me", { digestEnabled: false });
    expect((await runDigest(deps, new Date(NOW))).sent).toBe(0);
    expect(digestCount()).toBe(before);
  });
});

describe("calendar feed", () => {
  it("serves a private .ics of reach-outs, follow-ups and birthdays", async () => {
    await seedPeople();
    const people = (await api.call("GET", "/contacts")).body;
    await api.call("POST", `/contacts/${people[0].id}/notes`, { body: "Bring the book; it's due", followUpDay: "2026-11-15" });

    const feed = await api.call("GET", "/me/calendar-feed");
    expect(feed.body.url).toMatch(/\/v1\/calendar\/.+\.ics$/);
    expect((await api.call("GET", "/me/calendar-feed")).body.url).toBe(feed.body.url);

    const path = new URL(feed.body.url).pathname.replace("/v1", "");
    const ics = await call<string>(ctx.app, "GET", path);
    expect(ics.status).toBe(200);
    expect(ics.body).toContain("BEGIN:VCALENDAR");
    expect(ics.body).toContain("SUMMARY:Reach out to Overdue Olive");
    expect(ics.body).toContain(`DTSTART;VALUE=DATE:20261112`); // overdue shows today
    expect(ics.body).toContain("SUMMARY:Soon Sue's birthday");
    expect(ics.body).toContain("DESCRIPTION:Bring the book\\; it's due");
    expect(ics.body).not.toContain("Quiet Quinn");

    const reset = await api.call("POST", "/me/calendar-feed");
    expect(reset.body.url).not.toBe(feed.body.url);
    expect((await call(ctx.app, "GET", path)).status).toBe(404);
    expect((await call(ctx.app, "GET", "/calendar/.ics")).status).toBe(404);
  });
});
