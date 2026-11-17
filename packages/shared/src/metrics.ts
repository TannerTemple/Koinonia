/**
 * Beta metrics: counts only. Nothing here reads names, notes, prayers or contact details;
 * the inputs are timestamps and days of activity per account, and the output is totals per week.
 */
import { addDays, diffDays, weekStart, type Day } from "./dates";

/** An account reduced to what the metrics need. */
export interface MetricsAccount {
  signedUpDay: Day;
  /** Days on which each of the first few people was added (any order). */
  peopleAddedDays: Day[];
  /** Days with at least one reach-out or prayer logged. */
  activeDays: Day[];
}

export interface WeekMetrics {
  /** Monday of the week. */
  weekStart: Day;
  signups: number;
  /** Of that week's sign-ups: added 3 or more people within 7 days of signing up. */
  activated: number;
  /** Of that week's sign-ups: logged a reach-out or prayer on days 7 to 13 after signing up. */
  week1Retained: number;
  /** False while those days are still in the future for some of the cohort. */
  week1Known: boolean;
  /** Of that week's sign-ups: logged a reach-out or prayer on days 28 to 34 after signing up. */
  week4Retained: number;
  week4Known: boolean;
  /** Accounts (of any age) that logged a reach-out or prayer during this week. */
  activeUsers: number;
}

export const ACTIVATION_PEOPLE = 3;

const between = (day: Day, from: Day, to: Day) => day >= from && day <= to;

export function isActivated(a: MetricsAccount): boolean {
  const limit = addDays(a.signedUpDay, 6);
  return a.peopleAddedDays.filter((d) => d <= limit).length >= ACTIVATION_PEOPLE;
}

/** Active during the given window of days after sign-up (0 = the sign-up day). */
export function retainedIn(a: MetricsAccount, fromOffset: number, toOffset: number): boolean {
  const from = addDays(a.signedUpDay, fromOffset);
  const to = addDays(a.signedUpDay, toOffset);
  return a.activeDays.some((d) => between(d, from, to));
}

/** One row per week, oldest first, for the last `weeks` weeks ending with the week containing `today`. */
export function weeklyMetrics(accounts: MetricsAccount[], today: Day, weeks = 12): WeekMetrics[] {
  const thisWeek = weekStart(today);
  const rows: WeekMetrics[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    const cohort = accounts.filter((a) => between(a.signedUpDay, start, end));
    // A window is "known" once it has fully passed for the last person who could be in the cohort.
    const known = (lastOffset: number) => diffDays(addDays(end, lastOffset), today) > 0;
    rows.push({
      weekStart: start,
      signups: cohort.length,
      activated: cohort.filter(isActivated).length,
      week1Retained: cohort.filter((a) => retainedIn(a, 7, 13)).length,
      week1Known: known(13),
      week4Retained: cohort.filter((a) => retainedIn(a, 28, 34)).length,
      week4Known: known(34),
      activeUsers: accounts.filter((a) => a.activeDays.some((d) => between(d, start, end))).length,
    });
  }
  return rows;
}

/** "3 of 8 (38%)", or a dash when there is nobody to count. */
export function ratio(part: number, whole: number): string {
  return whole === 0 ? "–" : `${part} of ${whole} (${Math.round((part / whole) * 100)}%)`;
}

// ---- Which screens and features get used ------------------------------------------------

export const USAGE_KINDS = ["screen", "action"] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

export interface UsageRow {
  kind: UsageKind;
  /** A screen's address pattern ("/people/:id") or an action ("Logged a reach-out"). Never an id. */
  name: string;
  platform: string;
  count: number;
}

export interface AdminMetrics {
  today: Day;
  totals: { accounts: number; activated: number };
  weeks: WeekMetrics[];
  /** Totals over the last 30 days, most used first. */
  usage: UsageRow[];
}

/**
 * Turns an address into a pattern with no identifiers in it, so a count can never point at a
 * person: "/people/cmh2x9k0a0001/edit" becomes "/people/:id/edit". Returns null for anything
 * that does not look like an app screen.
 */
export function screenPattern(path: string): string | null {
  const clean = path.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  if (clean.length > 120 || !clean.startsWith("/")) return null;
  const parts = clean
    .split("/")
    .map((seg) => (seg === "" ? seg : /^[a-z][a-z-]{0,23}$/.test(seg) && !/^c[a-z0-9]{20,}$/.test(seg) ? seg : ":id"));
  const pattern = parts.join("/") || "/";
  return /^[a-z:/-]{1,80}$/.test(pattern) ? pattern : null;
}

/** What a successful write means in plain words; routes not listed are not counted. */
export const ACTION_NAMES: Record<string, string> = {
  "POST /v1/contacts": "Added a person",
  "POST /v1/contacts/import": "Imported contacts",
  "PATCH /v1/contacts/:id": "Edited a person",
  "POST /v1/contacts/:id/reach-out": "Logged a reach-out",
  "POST /v1/contacts/:id/snooze": "Chose 'Not today'",
  "POST /v1/contacts/:id/notes": "Wrote a note",
  "POST /v1/intentions": "Added to the prayer list",
  "POST /v1/intentions/:id/pray": "Prayed",
  "PUT /v1/prayer/today": "Chose today's prayer",
  "POST /v1/feedback": "Sent feedback",
  "POST /v1/me/calendar-feed": "Turned on the calendar",
};
