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
  api = await signUp(ctx.app);
});
afterAll(async () => {
  await ctx.app.close();
});

const ago = (n: number) => addDays(TODAY, -n);

describe("Today's reasons to come back", () => {
  it("is quiet and well-formed for a new account", async () => {
    const { body } = await api.call("GET", "/home");
    expect(body.keep.prayerStreak).toMatchObject({ current: 0, longest: 0, doneToday: false, atRisk: false });
    expect(body.keep.reachOutWeeks).toEqual({ current: 0, longest: 0, doneThisWeek: false });
    expect(body.keep.totals).toMatchObject({ reachOuts: 0, prayers: 0, answered: 0 });
    expect(body.keep.totals.sinceDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.keep.memory).toBeNull();
  });

  it("forgives one missed day of prayer and counts everything built up", async () => {
    const intention = (await api.call("POST", "/intentions", { title: "Mom's surgery" })).body.id;
    for (const n of [4, 3, 2]) await prisma.prayerLog.create({ data: { userId: api.userId, intentionId: intention, day: ago(n) } });
    // Missed yesterday; not prayed yet today.
    let keep = (await api.call("GET", "/home")).body.keep;
    expect(keep.prayerStreak).toMatchObject({ current: 3, graceUsed: true, atRisk: true, doneToday: false });

    await api.call("POST", `/intentions/${intention}/pray`);
    keep = (await api.call("GET", "/home")).body.keep;
    expect(keep.prayerStreak).toMatchObject({ current: 4, graceUsed: true, atRisk: false, doneToday: true });
    expect(keep.totals.prayers).toBe(4);

    await api.call("PATCH", `/intentions/${intention}`, { status: "ANSWERED" });
    expect((await api.call("GET", "/home")).body.keep.totals.answered).toBe(1);
  });

  it("counts weeks in a row of staying in touch, and brings back a memory", async () => {
    const mom = (await api.call("POST", "/contacts", { name: "Mom", cadenceDays: 7 })).body.id;
    const gone = (await api.call("POST", "/contacts", { name: "Old Friend", cadenceDays: 30 })).body.id;
    await prisma.interaction.createMany({
      data: [
        { userId: api.userId, contactId: mom, day: ago(14) },
        { userId: api.userId, contactId: mom, day: ago(7), summary: "Talked about Thanksgiving" },
        { userId: api.userId, contactId: mom, day: ago(30), summary: "She got the all-clear" },
        { userId: api.userId, contactId: gone, day: ago(365), summary: "Archived people stay out of memories" },
      ],
    });
    await api.call("PATCH", `/contacts/${gone}`, { archived: true });
    await api.call("POST", `/contacts/${mom}/reach-out`, {});

    const keep = (await api.call("GET", "/home")).body.keep;
    expect(keep.reachOutWeeks).toMatchObject({ current: 3, doneThisWeek: true });
    expect(keep.totals.reachOuts).toBe(5);
    expect(keep.memory).toEqual({ label: "A month ago", day: ago(30), contactId: mom, contactName: "Mom", summary: "She got the all-clear" });
  });

  it("never shows one person's memories or totals to another", async () => {
    const mom = (await api.call("POST", "/contacts", { name: "Mom", cadenceDays: 7 })).body.id;
    await prisma.interaction.create({ data: { userId: api.userId, contactId: mom, day: ago(7), summary: "Private" } });
    const other = await signUp(ctx.app);
    const keep = (await other.call("GET", "/home")).body.keep;
    expect(keep.memory).toBeNull();
    expect(keep.totals.reachOuts).toBe(0);
  });
});
