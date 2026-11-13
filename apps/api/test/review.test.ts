import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@koinonia/shared";
import { call, createTestApp, NOW, prisma, resetDb, signUp, TODAY, type Api, type TestContext } from "./helpers";

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
const person = async (name: string) => (await api.call("POST", "/contacts", { name, cadenceDays: 7 })).body.id as string;
const reach = (id: string, daysAgo: number) => api.call("POST", `/contacts/${id}/reach-out`, { day: ago(daysAgo) });

describe("weekly review", () => {
  it("needs a session", async () => {
    expect((await call(ctx.app, "GET", "/review/weekly")).status).toBe(401);
  });

  it("is all zeros, with both windows laid out, for a new user", async () => {
    const { status, body } = await api.call("GET", "/review/weekly");
    expect(status).toBe(200);
    expect(body.today).toBe(TODAY);
    expect(body.thisWeek).toMatchObject({ startDay: ago(6), endDay: TODAY, reachOuts: 0, peopleReached: 0, prayers: 0, daysReachedOut: 0, daysPrayed: 0, people: [] });
    expect(body.lastWeek).toMatchObject({ startDay: ago(13), endDay: ago(7), reachOuts: 0, prayers: 0 });
    expect(body.thisWeek.days.map((d: any) => d.day)).toEqual([6, 5, 4, 3, 2, 1, 0].map(ago));
    expect(body.streaks.reachOut.current).toBe(0);
  });

  it("counts reach-outs and people per window and ignores anything older", async () => {
    const [ana, ben, cy] = [await person("Ana"), await person("Ben"), await person("Cy")];
    await reach(ana, 0);
    await reach(ana, 1);
    await reach(ben, 6); // oldest day of this week
    await reach(ben, 7); // newest day of last week
    await reach(cy, 13); // oldest day of last week
    await reach(cy, 14); // too old to count

    const { body } = await api.call("GET", "/review/weekly");
    expect(body.thisWeek).toMatchObject({ reachOuts: 3, peopleReached: 2, daysReachedOut: 3 });
    expect(body.thisWeek.people).toEqual([
      { id: ana, name: "Ana", reachOuts: 2 },
      { id: ben, name: "Ben", reachOuts: 1 },
    ]);
    expect(body.thisWeek.days.at(-1)).toEqual({ day: TODAY, reachOuts: 1, prayers: 0 });
    expect(body.lastWeek).toMatchObject({ reachOuts: 2, peopleReached: 2, daysReachedOut: 2 });
    expect(body.streaks.reachOut).toMatchObject({ current: 2, doneToday: true });
  });

  it("counts prayers per window and the prayer streak", async () => {
    const one = (await api.call("POST", "/intentions", { title: "One" })).body.id;
    const two = (await api.call("POST", "/intentions", { title: "Two" })).body.id;
    await api.call("POST", `/intentions/${one}/pray`);
    await api.call("POST", `/intentions/${two}/pray`);
    await prisma.prayerLog.createMany({
      data: [
        { userId: api.userId, intentionId: one, day: ago(1) },
        { userId: api.userId, intentionId: one, day: ago(9) },
        { userId: api.userId, intentionId: two, day: ago(20) },
      ],
    });

    const { body } = await api.call("GET", "/review/weekly");
    expect(body.thisWeek).toMatchObject({ prayers: 3, daysPrayed: 2 });
    expect(body.lastWeek).toMatchObject({ prayers: 1, daysPrayed: 1 });
    expect(body.streaks.prayer).toMatchObject({ current: 2, doneToday: true });
  });

  it("uses the user's own timezone for where the week ends", async () => {
    const tokyo = await signUp(ctx.app, { timezone: "Asia/Tokyo" });
    ctx.setNow("2026-11-12T16:00:00Z"); // already the 13th in Tokyo
    const { body } = await tokyo.call("GET", "/review/weekly");
    expect(body.today).toBe("2026-11-13");
    expect(body.thisWeek.endDay).toBe("2026-11-13");
  });

  it("never includes another user's activity", async () => {
    const other = await signUp(ctx.app);
    const theirs = (await other.call("POST", "/contacts", { name: "Theirs", cadenceDays: 7 })).body.id;
    await other.call("POST", `/contacts/${theirs}/reach-out`, {});
    const { body } = await api.call("GET", "/review/weekly");
    expect(body.thisWeek.reachOuts).toBe(0);
    expect(JSON.stringify(body)).not.toContain("Theirs");
  });
});
