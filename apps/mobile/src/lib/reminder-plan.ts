import { DEFAULT_REMINDER_TIME, addDays, type Contact, type Home } from "@koinonia/shared";

export interface PlannedReminder {
  /** Stable id so re-syncing replaces rather than duplicates. */
  id: string;
  title: string;
  body: string;
  /** Local wall-clock time to fire. */
  day: string;
  hour: number;
  minute: number;
  /** Where tapping it goes. */
  url: string;
  /** Number to show on the app icon when it fires: how many people will be waiting by then. */
  badge: number;
}

/** iOS keeps at most 64 pending local notifications per app. */
export const MAX_REMINDERS = 48;
/** How many mornings in a row to nudge about someone who is already due. */
export const NUDGE_DAYS = 3;
/** Above this many people waiting, they share one notification a day instead of one each. */
export const MAX_INDIVIDUAL_NUDGES = 8;

/** "18:30" → { hour: 18, minute: 30 }; anything missing or odd falls back to 9:00. */
export function parseTime(time: string | null | undefined): { hour: number; minute: number } {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? "") ?? /^(\d\d):(\d\d)$/.exec(DEFAULT_REMINDER_TIME)!;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** "9:00 AM", "6:30 PM" */
export function formatTime(time: string | null | undefined): string {
  const { hour, minute } = parseTime(time);
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

const first = (name: string) => name.split(" ")[0] ?? name;
const list = (names: string[]) => (names.length <= 2 ? names.join(" and ") : `${names[0]}, ${names[1]} and ${names.length - 2} more`);

/**
 * Turns the Today summary into the local notifications to schedule on the phone.
 *
 * - Each person gets their own reminder, at their own time of day (9am unless set), on the
 *   day they become due. Tapping it opens that person.
 * - Someone already due is nudged at their time for the next few days, until you reach out
 *   or say "Not today" (which re-plans everything).
 * - Note follow-ups fire on their day.
 *
 * Re-planned from scratch whenever the data changes, so a reach-out, a snooze or an edit
 * moves the reminders with it. Pure, so it can be unit tested without a phone.
 */
export function planReminders(home: Home, now: { hour: number; minute: number }): PlannedReminder[] {
  const { today } = home;
  const plans: PlannedReminder[] = [];
  const nowMinutes = now.hour * 60 + now.minute;
  const stillToday = (time: { hour: number; minute: number }) => time.hour * 60 + time.minute > nowMinutes;

  const waiting = [...home.overdue, ...home.dueToday];
  // How many people will be due by the end of a given day: the number for the app icon.
  const dueBy = (day: string) => waiting.length + home.upcoming.filter((c) => c.dueDay && c.dueDay <= day).length;

  const forPerson = (c: Contact, day: string, kind: "due" | "late"): PlannedReminder => {
    const time = parseTime(c.reminderTime);
    return {
      id: `${kind}-${c.id}-${day}`,
      title: `Reach out to ${c.name}`,
      body: kind === "late" ? `${first(c.name)} would love to hear from you.` : "It's time for a quick hello.",
      day,
      ...time,
      url: `/contact/${c.id}`,
      badge: dueBy(day),
    };
  };

  // Already due: a nudge at each person's time for the next few days.
  if (waiting.length <= MAX_INDIVIDUAL_NUDGES) {
    for (const c of waiting) {
      const start = stillToday(parseTime(c.reminderTime)) ? 0 : 1;
      for (let i = start; i < start + NUDGE_DAYS; i++) plans.push(forPerson(c, addDays(today, i), "late"));
    }
  } else {
    // Too many to ping one by one: a single morning summary that opens Today.
    const time = parseTime(null);
    const start = stillToday(time) ? 0 : 1;
    for (let i = start; i < start + NUDGE_DAYS; i++) {
      const day = addDays(today, i);
      plans.push({
        id: `late-all-${day}`,
        title: `${waiting.length} people to reach out to`,
        body: `${list(waiting.map((c) => c.name))} would love to hear from you.`,
        day,
        ...time,
        url: "/",
        badge: dueBy(day),
      });
    }
  }

  // Upcoming: each person on the day they become due.
  for (const c of home.upcoming) {
    if (c.dueDay) plans.push(forPerson(c, c.dueDay, "due"));
  }

  // Follow-ups from notes, at the default time.
  for (const note of home.followUps) {
    const day = note.followUpDay!;
    const time = parseTime(null);
    if (day < today || (day === today && !stillToday(time))) continue;
    plans.push({
      id: `note-${note.id}`,
      title: `Follow up with ${note.contactName}`,
      body: note.body.length > 120 ? `${note.body.slice(0, 117)}…` : note.body,
      day,
      ...time,
      url: `/contact/${note.contactId}`,
      badge: dueBy(day),
    });
  }

  // Soonest first; if there are more than the phone can hold, the furthest away wait for the next sync.
  return plans.sort((a, b) => a.day.localeCompare(b.day) || a.hour * 60 + a.minute - (b.hour * 60 + b.minute)).slice(0, MAX_REMINDERS);
}
