/**
 * Koinonia works in calendar days ("YYYY-MM-DD") in the user's own timezone.
 * Due dates, streaks and the daily intention all flip at the user's midnight.
 */
export type Day = string;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(value: unknown): value is Day {
  if (typeof value !== "string" || !DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day of `at` in the given IANA timezone. */
export function dayInTimezone(at: Date, timezone: string): Day {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: isValidTimezone(timezone) ? timezone : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Hour (0-23) of `at` in the given timezone. */
export function hourInTimezone(at: Date, timezone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: isValidTimezone(timezone) ? timezone : "UTC",
    hour: "numeric",
    hourCycle: "h23",
  }).format(at);
  return Number(hour);
}

function toUtc(day: Day): number {
  return Date.parse(`${day}T00:00:00Z`);
}

export function addDays(day: Day, amount: number): Day {
  return new Date(toUtc(day) + amount * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: Day, to: Day): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Nov 12" or "Nov 12, 2025" when the year differs from `today`. */
export function formatDay(day: Day, today?: Day): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const base = `${MONTHS[m - 1]} ${d}`;
  return today && today.slice(0, 4) === String(y) ? base : `${base}, ${y}`;
}

export function weekdayName(day: Day): string {
  return WEEKDAYS[new Date(toUtc(day)).getUTCDay()]!;
}

/** "Thursday, Nov 12" */
export function formatLongDay(day: Day): string {
  return `${weekdayName(day)}, ${formatDay(day, day)}`;
}

/** Relative wording for a past or future day: "today", "yesterday", "3 days ago", "in 5 days". */
export function relativeDay(day: Day, today: Day): string {
  const delta = diffDays(today, day);
  if (delta === 0) return "today";
  if (delta === -1) return "yesterday";
  if (delta === 1) return "tomorrow";
  if (delta < 0) {
    const n = -delta;
    if (n < 14) return `${n} days ago`;
    if (n < 60) return `${Math.round(n / 7)} weeks ago`;
    if (n < 730) return `${Math.round(n / 30)} months ago`;
    return `${Math.round(n / 365)} years ago`;
  }
  if (delta < 14) return `in ${delta} days`;
  if (delta < 60) return `in ${Math.round(delta / 7)} weeks`;
  return `in ${Math.round(delta / 30)} months`;
}

/**
 * Birthdays are stored as "YYYY-MM-DD" or "MM-DD" (year unknown).
 * Returns the next occurrence on or after `today`.
 */
export function nextBirthday(birthday: string, today: Day): Day | null {
  const md = birthday.length === 5 ? birthday : birthday.slice(5);
  if (!/^\d{2}-\d{2}$/.test(md)) return null;
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    // Feb 29 falls back to Feb 28 in non-leap years.
    const candidate = isDay(`${y}-${md}`) ? `${y}-${md}` : md === "02-29" ? `${y}-02-28` : null;
    if (candidate && candidate >= today) return candidate;
  }
  return null;
}
