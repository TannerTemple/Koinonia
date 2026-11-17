import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, resetDb, signUp, type Api, type TestContext } from "./helpers";

let ctx: TestContext;
let owner: Api;
let other: Api;
let ids: { contact: string; note: string; interaction: string; intention: string };

beforeAll(async () => {
  ctx = await createTestApp();
  await resetDb();
  owner = await signUp(ctx.app, { name: "Owner" });
  other = await signUp(ctx.app, { name: "Other" });
  const contact = (await owner.call("POST", "/contacts", { name: "Private Person", cadenceDays: 7 })).body.id;
  const note = (await owner.call("POST", `/contacts/${contact}/notes`, { body: "secret note" })).body.id;
  const interaction = (await owner.call("POST", `/contacts/${contact}/reach-out`, {})).body.interaction.id;
  const intention = (await owner.call("POST", "/intentions", { title: "secret intention", contactId: contact })).body.id;
  ids = { contact, note, interaction, intention };
});
afterAll(async () => {
  await ctx.app.close();
});

describe("one user can never see or change another user's data", () => {
  it("lists only your own rows", async () => {
    expect((await other.call("GET", "/contacts")).body).toEqual([]);
    expect((await other.call("GET", "/intentions")).body).toEqual([]);
    const home = (await other.call("GET", "/home")).body;
    expect(JSON.stringify(home)).not.toContain("Private Person");
    expect(JSON.stringify(home)).not.toContain("secret");
    expect((await other.call("GET", "/prayer/today")).body.intention).toBeNull();
  });

  it("answers 404 for every read or write by id", async () => {
    const attempts: [Parameters<Api["call"]>[0], string, unknown?][] = [
      ["GET", `/contacts/${ids.contact}`],
      ["PATCH", `/contacts/${ids.contact}`, { name: "Hijacked" }],
      ["DELETE", `/contacts/${ids.contact}`],
      ["POST", `/contacts/${ids.contact}/reach-out`, {}],
      ["POST", `/contacts/${ids.contact}/snooze`, { days: 3 }],
      ["GET", `/contacts/${ids.contact}/notes`],
      ["POST", `/contacts/${ids.contact}/notes`, { body: "planted" }],
      ["PATCH", `/notes/${ids.note}`, { body: "changed" }],
      ["DELETE", `/notes/${ids.note}`],
      ["DELETE", `/interactions/${ids.interaction}`],
      ["PATCH", `/intentions/${ids.intention}`, { title: "changed" }],
      ["DELETE", `/intentions/${ids.intention}`],
      ["POST", `/intentions/${ids.intention}/pray`],
      ["DELETE", `/intentions/${ids.intention}/pray`],
      ["PUT", "/prayer/today", { intentionId: ids.intention }],
      ["POST", "/intentions", { title: "linked to someone else's person", contactId: ids.contact }],
    ];
    for (const [method, url, body] of attempts) {
      const res = await other.call(method, url, body);
      expect(res.status, `${method} ${url}`).toBe(404);
    }
  });

  it("can't re-point your own intention at someone else's person", async () => {
    const mine = (await other.call("POST", "/intentions", { title: "mine" })).body.id;
    expect((await other.call("PATCH", `/intentions/${mine}`, { contactId: ids.contact })).status).toBe(404);
  });

  it("leaves the owner's data untouched", async () => {
    const detail = (await owner.call("GET", `/contacts/${ids.contact}`)).body;
    expect(detail.name).toBe("Private Person");
    expect(detail.notes.map((n: any) => n.body)).toEqual(["secret note"]);
    expect(detail.interactions).toHaveLength(1);
    expect(detail.intentions.map((i: any) => i.title)).toEqual(["secret intention"]);
  });
});
