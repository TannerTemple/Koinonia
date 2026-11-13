import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, resetDb, signUp, TODAY, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let api: Api;
beforeAll(async () => {
  ctx = await createTestApp();
});
beforeEach(async () => {
  await resetDb();
  api = await signUp(ctx.app);
});
afterAll(async () => {
  await ctx.app.close();
});

describe("contacts", () => {
  it("creates a contact and schedules the first reminder from today", async () => {
    const res = await api.call("POST", "/contacts", {
      name: "Maria Lopez",
      phone: "(555) 010-2000",
      email: "Maria@Example.com",
      cadenceDays: 7,
      relationship: "College friend",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: "Maria Lopez",
      phone: "5550102000",
      email: "maria@example.com",
      cadenceDays: 7,
      nextDueDay: "2026-11-19",
      dueDay: "2026-11-19",
      lastContactedDay: null,
    });
  });

  it("counts from the last time you talked when you provide it", async () => {
    const res = await api.call("POST", "/contacts", { name: "Dad", cadenceDays: 3, lastContactedDay: "2026-11-01" });
    expect(res.body.nextDueDay).toBe("2026-11-04"); // already overdue
    const future = await api.call("POST", "/contacts", { name: "X", lastContactedDay: "2027-01-01" });
    expect(future.status).toBe(400);
  });

  it("has no due day without a cadence", async () => {
    const res = await api.call("POST", "/contacts", { name: "No Reminder" });
    expect(res.body).toMatchObject({ cadenceDays: null, nextDueDay: null, dueDay: null });
  });

  it("validates input", async () => {
    expect((await api.call("POST", "/contacts", { name: "" })).status).toBe(400);
    expect((await api.call("POST", "/contacts", { name: "A", cadenceDays: 0 })).status).toBe(400);
    expect((await api.call("POST", "/contacts", { name: "A", email: "nope" })).status).toBe(400);
  });

  it("lists alphabetically, searches by name and hides archived people", async () => {
    await api.call("POST", "/contacts", { name: "Zoe" });
    await api.call("POST", "/contacts", { name: "Ana" });
    const gone = await api.call("POST", "/contacts", { name: "Archived Al" });
    await api.call("PATCH", `/contacts/${gone.body.id}`, { archived: true });

    const all = await api.call("GET", "/contacts");
    expect(all.body.map((c: any) => c.name)).toEqual(["Ana", "Zoe"]);
    const search = await api.call("GET", "/contacts?q=zo");
    expect(search.body.map((c: any) => c.name)).toEqual(["Zoe"]);
    const archived = await api.call("GET", "/contacts?archived=true");
    expect(archived.body.map((c: any) => c.name)).toEqual(["Archived Al"]);
  });

  it("updates only the fields sent and reschedules when the cadence changes", async () => {
    const created = await api.call("POST", "/contacts", { name: "Ana", phone: "5550102000", cadenceDays: 7 });
    const renamed = await api.call("PATCH", `/contacts/${created.body.id}`, { name: "Ana Maria" });
    expect(renamed.body).toMatchObject({ name: "Ana Maria", phone: "5550102000", cadenceDays: 7, nextDueDay: "2026-11-19" });

    const faster = await api.call("PATCH", `/contacts/${created.body.id}`, { cadenceDays: 3 });
    expect(faster.body.nextDueDay).toBe("2026-11-15");
    const off = await api.call("PATCH", `/contacts/${created.body.id}`, { cadenceDays: null });
    expect(off.body).toMatchObject({ cadenceDays: null, nextDueDay: null });
  });

  it("logging a reach-out restarts the clock and records history", async () => {
    const created = await api.call("POST", "/contacts", { name: "Ana", cadenceDays: 14, lastContactedDay: "2026-10-01" });
    const res = await api.call("POST", `/contacts/${created.body.id}/reach-out`, { channel: "CALL", summary: "Caught up about the move" });
    expect(res.status).toBe(201);
    expect(res.body.contact).toMatchObject({ lastContactedDay: TODAY, nextDueDay: "2026-11-26" });
    expect(res.body.interaction).toMatchObject({ channel: "CALL", day: TODAY, summary: "Caught up about the move" });

    const detail = await api.call("GET", `/contacts/${created.body.id}`);
    expect(detail.body.interactions).toHaveLength(1);
  });

  it("back-dated reach-outs don't move the clock backwards, and deleting one resyncs", async () => {
    const created = await api.call("POST", "/contacts", { name: "Ana", cadenceDays: 7 });
    const id = created.body.id;
    const recent = await api.call("POST", `/contacts/${id}/reach-out`, { day: "2026-11-10" });
    expect(recent.body.contact.nextDueDay).toBe("2026-11-17");
    const older = await api.call("POST", `/contacts/${id}/reach-out`, { day: "2026-11-02" });
    expect(older.body.contact).toMatchObject({ lastContactedDay: "2026-11-10", nextDueDay: "2026-11-17" });
    expect((await api.call("POST", `/contacts/${id}/reach-out`, { day: "2026-12-25" })).status).toBe(400);

    expect((await api.call("DELETE", `/interactions/${recent.body.interaction.id}`)).status).toBe(204);
    const after = await api.call("GET", `/contacts/${id}`);
    expect(after.body).toMatchObject({ lastContactedDay: "2026-11-02", nextDueDay: "2026-11-09" });
  });

  it("snoozes without logging a reach-out, and a reach-out clears the snooze", async () => {
    const created = await api.call("POST", "/contacts", { name: "Ana", cadenceDays: 3, lastContactedDay: "2026-11-05" });
    const id = created.body.id;
    expect(created.body.dueDay).toBe("2026-11-08");

    const snoozed = await api.call("POST", `/contacts/${id}/snooze`, { days: 2 });
    expect(snoozed.body).toMatchObject({ nextDueDay: "2026-11-08", snoozedUntilDay: "2026-11-14", dueDay: "2026-11-14" });
    expect((await api.call("POST", `/contacts/${id}/snooze`, { untilDay: TODAY })).status).toBe(400);
    const cleared = await api.call("POST", `/contacts/${id}/snooze`, { clear: true });
    expect(cleared.body.dueDay).toBe("2026-11-08");

    await api.call("POST", `/contacts/${id}/snooze`, { untilDay: "2026-12-01" });
    const reached = await api.call("POST", `/contacts/${id}/reach-out`, {});
    expect(reached.body.contact).toMatchObject({ snoozedUntilDay: null, dueDay: "2026-11-15" });
  });

  it("imports in bulk and skips people already in the list", async () => {
    await api.call("POST", "/contacts", { name: "Existing Person", phone: "555-010-2000" });
    const res = await api.call("POST", "/contacts/import", {
      cadenceDays: 28,
      contacts: [
        { name: "Existing Again", phone: "(555) 010-2000" },
        { name: "New One", phone: "555-010-3000", email: "not an email" },
        { name: "New Two", email: "two@example.com", birthday: "1990-04-12" },
        { name: "New Two", email: "two@example.com" },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ created: 2, skipped: 2 });
    const all = await api.call("GET", "/contacts");
    const one = all.body.find((c: any) => c.name === "New One");
    expect(one).toMatchObject({ email: null, cadenceDays: 28, nextDueDay: "2026-12-10" });
  });

  it("matches phone numbers written differently, and keeps two people who share a name", async () => {
    await api.call("POST", "/contacts", { name: "Maria Lopez", phone: "+1 (555) 010-2000" });
    await api.call("POST", "/contacts", { name: "No Details" });
    const res = await api.call("POST", "/contacts/import", {
      cadenceDays: null,
      contacts: [
        { name: "Maria L.", phone: "555 010 2000" }, // same number without the country code
        { name: "Maria Lopez", phone: "555-010-9999" }, // another Maria Lopez
        { name: "Maria Lopez" }, // nothing to tell her apart from the first
        { name: "No Details", phone: "555-010-7777" }, // the existing one has no details: same person
        { name: "Sam Hill", email: "SAM@example.com" },
        { name: "Samuel Hill", email: "sam@example.com" },
      ],
    });
    expect(res.body).toEqual({ created: 2, skipped: 4 });
    const all = (await api.call("GET", "/contacts")).body;
    expect(all.map((c: any) => c.name).sort()).toEqual(["Maria Lopez", "Maria Lopez", "No Details", "Sam Hill"]);
    expect(all.find((c: any) => c.name === "Sam Hill")).toMatchObject({ cadenceDays: null, nextDueDay: null });
  });

  it("imports the largest batch and refuses a bigger one", async () => {
    const people = (n: number) => Array.from({ length: n }, (_, i) => ({ name: `Person ${i}`, phone: `555${String(1000000 + i)}` }));
    expect((await api.call("POST", "/contacts/import", { cadenceDays: 28, contacts: people(500) })).body).toEqual({ created: 500, skipped: 0 });
    expect((await api.call("POST", "/contacts/import", { cadenceDays: 28, contacts: people(501) })).status).toBe(400);
    expect((await api.call("POST", "/contacts/import", { cadenceDays: 28, contacts: [] })).status).toBe(400);
  });

  it("deletes a contact with its notes and history", async () => {
    const created = await api.call("POST", "/contacts", { name: "Ana", cadenceDays: 7 });
    await api.call("POST", `/contacts/${created.body.id}/notes`, { body: "Likes hiking" });
    await api.call("POST", `/contacts/${created.body.id}/reach-out`, {});
    expect((await api.call("DELETE", `/contacts/${created.body.id}`)).status).toBe(204);
    expect((await api.call("GET", `/contacts/${created.body.id}`)).status).toBe(404);
  });

  it("keeps each user's people private", async () => {
    const mine = await api.call("POST", "/contacts", { name: "Mine" });
    const other = await signUp(ctx.app);
    expect((await other.call("GET", "/contacts")).body).toEqual([]);
    expect((await other.call("GET", `/contacts/${mine.body.id}`)).status).toBe(404);
    expect((await other.call("PATCH", `/contacts/${mine.body.id}`, { name: "Hacked" })).status).toBe(404);
    expect((await other.call("DELETE", `/contacts/${mine.body.id}`)).status).toBe(404);
    expect((await other.call("POST", `/contacts/${mine.body.id}/reach-out`, {})).status).toBe(404);
    expect((await other.call("POST", `/contacts/${mine.body.id}/notes`, { body: "x" })).status).toBe(404);
  });
});

describe("notes", () => {
  it("creates, pins, edits and deletes notes on a person", async () => {
    const contact = await api.call("POST", "/contacts", { name: "Ana" });
    const id = contact.body.id;
    const first = await api.call("POST", `/contacts/${id}/notes`, { body: "  Started a new job at the hospital  " });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ body: "Started a new job at the hospital", pinned: false, contactName: "Ana" });
    const second = await api.call("POST", `/contacts/${id}/notes`, { body: "Kids: Leo and Mia", pinned: true });

    const list = await api.call("GET", `/contacts/${id}/notes`);
    expect(list.body.map((n: any) => n.id)).toEqual([second.body.id, first.body.id]); // pinned first

    const edited = await api.call("PATCH", `/notes/${first.body.id}`, { body: "Started at St. Luke's" });
    expect(edited.body).toMatchObject({ body: "Started at St. Luke's", pinned: false });
    expect((await api.call("POST", `/contacts/${id}/notes`, { body: "   " })).status).toBe(400);

    expect((await api.call("DELETE", `/notes/${first.body.id}`)).status).toBe(204);
    expect((await api.call("DELETE", `/notes/${first.body.id}`)).status).toBe(404);
    const detail = await api.call("GET", `/contacts/${id}`);
    expect(detail.body.notes).toHaveLength(1);
    expect(detail.body.noteCount).toBe(1);
  });

  it("tracks follow-up days and re-opens a follow-up when it moves", async () => {
    const contact = await api.call("POST", "/contacts", { name: "Ana" });
    const note = await api.call("POST", `/contacts/${contact.body.id}/notes`, {
      body: "Ask how the interview went",
      followUpDay: "2026-11-14",
    });
    expect(note.body).toMatchObject({ followUpDay: "2026-11-14", followUpDone: false });
    const done = await api.call("PATCH", `/notes/${note.body.id}`, { followUpDone: true });
    expect(done.body.followUpDone).toBe(true);
    const moved = await api.call("PATCH", `/notes/${note.body.id}`, { followUpDay: "2026-11-20" });
    expect(moved.body).toMatchObject({ followUpDay: "2026-11-20", followUpDone: false });
    const other = await signUp(ctx.app);
    expect((await other.call("PATCH", `/notes/${note.body.id}`, { body: "x" })).status).toBe(404);
  });
});
