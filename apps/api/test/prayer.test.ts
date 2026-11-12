import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, NOW, resetDb, signUp, TODAY, type Api, type TestContext } from "./helpers";

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

describe("prayer intentions", () => {
  it("creates intentions, linked to a person or not", async () => {
    const contact = await api.call("POST", "/contacts", { name: "Maria Lopez" });
    const linked = await api.call("POST", "/intentions", { title: "Maria's surgery", contactId: contact.body.id });
    expect(linked.status).toBe(201);
    expect(linked.body).toMatchObject({ kind: "PROMISED", status: "ACTIVE", contactName: "Maria Lopez", prayedCount: 0, prayedToday: false });
    const personal = await api.call("POST", "/intentions", { title: "Patience at work" });
    expect(personal.body).toMatchObject({ kind: "PERSONAL", contactId: null });

    const detail = await api.call("GET", `/contacts/${contact.body.id}`);
    expect(detail.body.intentions.map((i: any) => i.title)).toEqual(["Maria's surgery"]);
    expect(detail.body.activeIntentionCount).toBe(1);

    expect((await api.call("POST", "/intentions", { title: "" })).status).toBe(400);
    expect((await api.call("POST", "/intentions", { title: "x", contactId: "nope" })).status).toBe(404);
  });

  it("marks prayed once per day and can undo it", async () => {
    const created = await api.call("POST", "/intentions", { title: "Peace" });
    const id = created.body.id;
    const first = await api.call("POST", `/intentions/${id}/pray`);
    expect(first.body).toMatchObject({ prayedCount: 1, prayedToday: true, lastPrayedDay: TODAY });
    const again = await api.call("POST", `/intentions/${id}/pray`);
    expect(again.body.prayedCount).toBe(1);

    ctx.setNow("2026-11-13T12:00:00Z");
    const nextDay = await api.call("POST", `/intentions/${id}/pray`);
    expect(nextDay.body).toMatchObject({ prayedCount: 2, lastPrayedDay: "2026-11-13" });
    const undone = await api.call("DELETE", `/intentions/${id}/pray`);
    expect(undone.body).toMatchObject({ prayedCount: 1, prayedToday: false, lastPrayedDay: TODAY });
  });

  it("marks answered, filters by status, and deletes", async () => {
    const a = await api.call("POST", "/intentions", { title: "Job for Sam" });
    await api.call("POST", "/intentions", { title: "Still praying" });
    const answered = await api.call("PATCH", `/intentions/${a.body.id}`, { status: "ANSWERED" });
    expect(answered.body.status).toBe("ANSWERED");
    expect(answered.body.answeredAt).toEqual(expect.any(String));
    expect(answered.body.title).toBe("Job for Sam");

    const active = await api.call("GET", "/intentions?status=ACTIVE");
    expect(active.body.map((i: any) => i.title)).toEqual(["Still praying"]);
    expect((await api.call("GET", "/intentions")).body).toHaveLength(2);
    expect((await api.call("GET", "/intentions?status=BOGUS")).status).toBe(400);

    expect((await api.call("DELETE", `/intentions/${a.body.id}`)).status).toBe(204);
    const other = await signUp(ctx.app);
    const mine = (await api.call("GET", "/intentions")).body[0];
    expect((await other.call("POST", `/intentions/${mine.id}/pray`)).status).toBe(404);
    expect((await other.call("PATCH", `/intentions/${mine.id}`, { title: "x" })).status).toBe(404);
  });
});

describe("the intention of the day", () => {
  it("is empty when there is nothing to pray for", async () => {
    const res = await api.call("GET", "/prayer/today");
    expect(res.body).toEqual({ day: TODAY, intention: null, chosenByUser: false });
  });

  it("suggests the intention that has waited longest and keeps it for the day", async () => {
    const a = await api.call("POST", "/intentions", { title: "A" });
    const b = await api.call("POST", "/intentions", { title: "B" });
    await api.call("POST", `/intentions/${a.body.id}/pray`);

    const today = await api.call("GET", "/prayer/today");
    expect(today.body).toMatchObject({ chosenByUser: false, intention: { id: b.body.id } });
    // Praying for it doesn't make the suggestion jump to something else today.
    await api.call("POST", `/intentions/${b.body.id}/pray`);
    expect((await api.call("GET", "/prayer/today")).body.intention).toMatchObject({ id: b.body.id, prayedToday: true });

    ctx.setNow("2026-11-13T12:00:00Z");
    expect((await api.call("GET", "/prayer/today")).body).toMatchObject({ day: "2026-11-13", intention: { id: a.body.id } });
  });

  it("lets the user choose, and falls back when the choice is answered", async () => {
    const a = await api.call("POST", "/intentions", { title: "A" });
    const b = await api.call("POST", "/intentions", { title: "B" });
    const chosen = await api.call("PUT", "/prayer/today", { intentionId: b.body.id });
    expect(chosen.body).toMatchObject({ chosenByUser: true, intention: { id: b.body.id } });
    expect((await api.call("GET", "/prayer/today")).body.intention.id).toBe(b.body.id);

    await api.call("PATCH", `/intentions/${b.body.id}`, { status: "ANSWERED" });
    expect((await api.call("GET", "/prayer/today")).body).toMatchObject({ chosenByUser: false, intention: { id: a.body.id } });
    expect((await api.call("PUT", "/prayer/today", { intentionId: b.body.id })).status).toBe(400);
    expect((await api.call("PUT", "/prayer/today", { intentionId: "nope" })).status).toBe(404);
  });
});
