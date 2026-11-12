import { describe, expect, it } from "vitest";
import type { Contact, Home, Note } from "@koinonia/shared";
import { MAX_REMINDERS, planReminders } from "./reminder-plan";

const TODAY = "2026-11-12";
const contact = (name: string, dueDay: string): Contact => ({
  id: name, name, phone: null, email: null, relationship: null, birthday: null, cadenceDays: 7, preferredChannel: "TEXT",
  lastContactedDay: null, nextDueDay: dueDay, snoozedUntilDay: null, dueDay, linkedUserId: null, archived: false,
  noteCount: 0, activeIntentionCount: 0, createdAt: "",
});
const note = (id: string, followUpDay: string, body = "Ask about the interview"): Note => ({
  id, contactId: "c1", contactName: "Ana", body, pinned: false, followUpDay, followUpDone: false, createdAt: "", updatedAt: "",
});
const home = (partial: Partial<Home>): Home => ({
  today: TODAY, overdue: [], dueToday: [], upcoming: [], followUps: [], birthdays: [],
  prayer: { day: TODAY, intention: null, chosenByUser: false },
  streaks: { reachOut: { current: 0, longest: 0, doneToday: false }, prayer: { current: 0, longest: 0, doneToday: false } },
  stats: { contacts: 0, reachOutsThisWeek: 0, activeIntentions: 0 },
  ...partial,
});

describe("planReminders", () => {
  it("plans nothing when nothing is due", () => {
    expect(planReminders(home({}), 7)).toEqual([]);
  });

  it("schedules one reminder per upcoming due day and groups people due together", () => {
    const plans = planReminders(home({ upcoming: [contact("Ana", "2026-11-14"), contact("Ben", "2026-11-14"), contact("Cy", "2026-11-20")] }), 7);
    expect(plans.map((p) => [p.day, p.title])).toEqual([
      ["2026-11-14", "2 people to reach out to today"],
      ["2026-11-20", "Reach out to Cy today"],
    ]);
    expect(plans[0]!.body).toBe("Ana and Ben.");
    expect(plans.every((p) => p.hour === 9)).toBe(true);
  });

  it("nudges every morning for a week while someone is waiting", () => {
    const morning = planReminders(home({ overdue: [contact("Mom", "2026-11-10")] }), 7);
    expect(morning).toHaveLength(7);
    expect(morning[0]).toMatchObject({ day: TODAY, title: "Reach out to Mom" });
    // After 9am, today's slot has passed: start tomorrow.
    const evening = planReminders(home({ overdue: [contact("Mom", "2026-11-10")] }), 20);
    expect(evening).toHaveLength(6);
    expect(evening[0]!.day).toBe("2026-11-13");
  });

  it("does not double up on a morning that already has a nudge", () => {
    const plans = planReminders(home({ dueToday: [contact("Mom", TODAY)], upcoming: [contact("Ana", "2026-11-14")] }), 7);
    expect(plans.filter((p) => p.day === "2026-11-14")).toHaveLength(1);
    expect(new Set(plans.map((p) => p.id)).size).toBe(plans.length);
  });

  it("includes note follow-ups that are still ahead and links to the person", () => {
    const plans = planReminders(home({ followUps: [note("n1", "2026-11-11"), note("n2", TODAY), note("n3", "2026-11-15", "x".repeat(200))] }), 12);
    expect(plans.map((p) => p.id)).toEqual(["note-n3"]);
    expect(plans[0]).toMatchObject({ title: "Follow up with Ana", url: "/contact/c1" });
    expect(plans[0]!.body.length).toBeLessThanOrEqual(120);
    expect(planReminders(home({ followUps: [note("n2", TODAY)] }), 7).map((p) => p.id)).toEqual(["note-n2"]);
  });

  it("stays under the iOS pending-notification limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => note(`n${i}`, "2026-11-20"));
    expect(planReminders(home({ followUps: many }), 7)).toHaveLength(MAX_REMINDERS);
  });
});
