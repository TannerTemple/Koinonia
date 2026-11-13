import { addDays, type Home } from "@koinonia/shared";

export interface PlannedReminder {
  /** Stable id so re-syncing replaces rather than duplicates. */
  id: string;
  title: string;
  body: string;
  /** Local wall-clock time to fire. */
  day: string;
  hour: number;
  url: string;
}

export const REMINDER_HOUR = 9;
/** iOS keeps at most 64 pending local notifications per app. */
export const MAX_REMINDERS = 48;

/**
 * Turns the Today summary into the local notifications to schedule on the device:
 * one per upcoming reach-out day (people due the same day are grouped), a daily
 * nudge for the next week while anyone is overdue, and note follow-ups.
 * Pure, so it can be unit tested without a device.
 */
export function planReminders(home: Home, nowHour: number): PlannedReminder[] {
  const { today } = home;
  const plans: PlannedReminder[] = [];
  const canFireToday = nowHour < REMINDER_HOUR;
  const list = (names: string[]) =>
    names.length <= 2 ? names.join(" and ") : `${names[0]}, ${names[1]} and ${names.length - 2} more`;

  // Already due: nudge each morning for a week (re-planned whenever the app opens).
  const waiting = [...home.overdue, ...home.dueToday].map((c) => c.name);
  if (waiting.length) {
    for (let i = canFireToday ? 0 : 1; i < 7; i++) {
      plans.push({
        id: `due-${addDays(today, i)}`,
        title: waiting.length === 1 ? `Reach out to ${waiting[0]}` : `${waiting.length} people to reach out to`,
        body: waiting.length === 1 ? "A quick hello goes a long way." : `${list(waiting)} would love to hear from you.`,
        day: addDays(today, i),
        hour: REMINDER_HOUR,
        url: "/",
      });
    }
  }

  // Upcoming: one notification per due day.
  const byDay = new Map<string, string[]>();
  for (const c of home.upcoming) {
    if (!c.dueDay) continue;
    byDay.set(c.dueDay, [...(byDay.get(c.dueDay) ?? []), c.name]);
  }
  for (const [day, names] of byDay) {
    const existing = plans.find((p) => p.id === `due-${day}`);
    if (existing) continue; // the overdue nudge already covers that morning
    plans.push({
      id: `due-${day}`,
      title: names.length === 1 ? `Reach out to ${names[0]} today` : `${names.length} people to reach out to today`,
      body: names.length === 1 ? "It's been a little while." : `${list(names)}.`,
      day,
      hour: REMINDER_HOUR,
      url: "/",
    });
  }

  // Follow-ups from notes.
  for (const note of home.followUps) {
    const day = note.followUpDay!;
    if (day < today || (day === today && !canFireToday)) continue;
    plans.push({
      id: `note-${note.id}`,
      title: `Follow up with ${note.contactName}`,
      body: note.body.length > 120 ? `${note.body.slice(0, 117)}…` : note.body,
      day,
      hour: REMINDER_HOUR,
      url: `/contact/${note.contactId}`,
    });
  }

  return plans.sort((a, b) => a.day.localeCompare(b.day)).slice(0, MAX_REMINDERS);
}
