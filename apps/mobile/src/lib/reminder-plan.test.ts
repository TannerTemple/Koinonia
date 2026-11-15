import { describe, expect, it } from "vitest";
import type { Contact, Home, Note } from "@koinonia/shared";
import { MAX_REMINDERS, NUDGE_DAYS, formatTime, parseTime, planReminders } from "./reminder-plan";

const TODAY = "2026-11-12";
const contact = (name: string, dueDay: string, reminderTime: string | null = null): Contact => ({
  id: name.toLowerCase(), name, phone: null, email: null, relationship: null, birthday: null, cadenceDays: 7, preferredChannel: "TEXT",
  reminderTime, favorite: false, groups: [],
  lastContactedDay: null, nextDueDay: dueDay, snoozedUntilDay: null, dueDay, linkedUserId: null, archived: false,
  noteCount: 0, activeIntentionCount: 0, createdAt: "",
});
const note = (id: string, followUpDay: string, body = "Ask about the interview"): Note => ({
  id, contactId: "c1", contactName: "Ana", body, pinned: false, followUpDay, followUpDone: false, createdAt: "", updatedAt: "",
});
const home = (partial: Partial<Home>): Home => ({
  today: TODAY, overdue: [], dueToday: [], upcoming: [], nextUp: null, followUps: [], birthdays: [],
  prayer: { day: TODAY, intention: null, chosenByUser: false },
  streaks: { reachOut: { current: 0, longest: 0, doneToday: false }, prayer: { current: 0, longest: 0, doneToday: false } },
  stats: { contacts: 0, reachOutsThisWeek: 0, activeIntentions: 0 },
  ...partial,
});
const at = (hour: number, minute = 0) => ({ hour, minute });

describe("reminder times", () => {
  it("reads a time, and falls back to 9:00", () => {
    expect(parseTime("18:30")).toEqual({ hour: 18, minute: 30 });
    expect(parseTime(null)).toEqual({ hour: 9, minute: 0 });
    expect(parseTime("soon")).toEqual({ hour: 9, minute: 0 });
  });

  it("shows times the way a clock does", () => {
    expect([formatTime(null), formatTime("18:30"), formatTime("00:05"), formatTime("12:00")]).toEqual(["9:00 AM", "6:30 PM", "12:05 AM", "12:00 PM"]);
  });
});

describe("planReminders", () => {
  it("plans nothing when nothing is due", () => {
    expect(planReminders(home({}), at(7))).toEqual([]);
  });

  it("reminds about each person on their due day, at their own time, and opens that person", () => {
    const plans = planReminders(home({ upcoming: [contact("Ana", "2026-11-14"), contact("Ben", "2026-11-14", "18:30"), contact("Cy", "2026-11-20", "07:15")] }), at(7));
    expect(plans.map((p) => [p.day, p.hour, p.minute, p.title, p.url])).toEqual([
      ["2026-11-14", 9, 0, "Reach out to Ana", "/contact/ana"],
      ["2026-11-14", 18, 30, "Reach out to Ben", "/contact/ben"],
      ["2026-11-20", 7, 15, "Reach out to Cy", "/contact/cy"],
    ]);
  });

  it("nudges about someone already due for the next few days, starting today only if their time is still ahead", () => {
    const morning = planReminders(home({ overdue: [contact("Mom", "2026-11-10")] }), at(7));
    expect(morning.map((p) => p.day)).toEqual(["2026-11-12", "2026-11-13", "2026-11-14"]);
    expect(morning).toHaveLength(NUDGE_DAYS);
    expect(morning[0]).toMatchObject({ title: "Reach out to Mom", url: "/contact/mom" });

    const evening = planReminders(home({ overdue: [contact("Mom", "2026-11-10")] }), at(20));
    expect(evening.map((p) => p.day)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);

    // Her time is 6:30pm: at 5pm today still counts, at 6:30 exactly it does not.
    const late = home({ dueToday: [contact("Mom", TODAY, "18:30")] });
    expect(planReminders(late, at(17))[0]!.day).toBe(TODAY);
    expect(planReminders(late, at(18, 30))[0]!.day).toBe("2026-11-13");
  });

  it("moves with the data: after a reach-out or a snooze the old reminders are simply not planned", () => {
    const mom = contact("Mom", "2026-11-10");
    const before = planReminders(home({ overdue: [mom] }), at(7));
    expect(before.some((p) => p.id.startsWith("late-mom"))).toBe(true);
    // She was reached: the server now says she is due next week.
    const after = planReminders(home({ upcoming: [contact("Mom", "2026-11-19")] }), at(7));
    expect(after.map((p) => p.id)).toEqual(["due-mom-2026-11-19"]);
    // Her time was edited: same day, new time.
    const edited = planReminders(home({ upcoming: [contact("Mom", "2026-11-19", "20:00")] }), at(7));
    expect(edited[0]).toMatchObject({ day: "2026-11-19", hour: 20, minute: 0 });
  });

  it("sends one summary a day instead of a flood when many people are waiting", () => {
    const many = Array.from({ length: 12 }, (_, i) => contact(`Person ${i}`, "2026-11-01"));
    const plans = planReminders(home({ overdue: many }), at(7));
    expect(plans).toHaveLength(NUDGE_DAYS);
    expect(plans[0]).toMatchObject({ title: "12 people to reach out to", url: "/", hour: 9 });
  });

  it("sets the icon badge to how many people will be waiting by then", () => {
    const plans = planReminders(
      home({ overdue: [contact("Mom", "2026-11-10")], dueToday: [contact("Dad", TODAY)], upcoming: [contact("Ana", "2026-11-13"), contact("Cy", "2026-11-20")] }),
      at(7),
    );
    const badge = (id: string) => plans.find((p) => p.id === id)!.badge;
    expect(badge(`late-mom-${TODAY}`)).toBe(2);
    expect(badge("late-mom-2026-11-13")).toBe(3);
    expect(badge("due-ana-2026-11-13")).toBe(3);
    expect(badge("due-cy-2026-11-20")).toBe(4);
  });

  it("gives every reminder its own id", () => {
    const plans = planReminders(home({ dueToday: [contact("Mom", TODAY)], overdue: [contact("Dad", "2026-11-01")], upcoming: [contact("Ana", "2026-11-14")], followUps: [note("n1", "2026-11-14")] }), at(7));
    expect(new Set(plans.map((p) => p.id)).size).toBe(plans.length);
  });

  it("includes note follow-ups that are still ahead and links to the person", () => {
    const plans = planReminders(home({ followUps: [note("n1", "2026-11-11"), note("n2", TODAY), note("n3", "2026-11-15", "x".repeat(200))] }), at(12));
    expect(plans.map((p) => p.id)).toEqual(["note-n3"]);
    expect(plans[0]).toMatchObject({ title: "Follow up with Ana", url: "/contact/c1" });
    expect(plans[0]!.body.length).toBeLessThanOrEqual(120);
    expect(planReminders(home({ followUps: [note("n2", TODAY)] }), at(7)).map((p) => p.id)).toEqual(["note-n2"]);
  });

  it("stays under the iOS limit, keeping the soonest", () => {
    const upcoming = Array.from({ length: 80 }, (_, i) => contact(`P${i}`, `2026-${i < 18 ? "11" : i < 49 ? "12" : "01"}-${String((i % 28) + 1).padStart(2, "0")}`));
    const plans = planReminders(home({ upcoming }), at(7));
    expect(plans).toHaveLength(MAX_REMINDERS);
    const days = plans.map((p) => p.day);
    expect([...days].sort()).toEqual(days);
  });
});
