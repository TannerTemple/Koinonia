import type { Day } from "@koinonia/shared";

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] as const;
export const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
export const toDay = (year: number, month: number, date: number): Day => `${year}-${pad(month)}-${pad(date)}`;

/** Weeks (Sunday first) of a month, 1-based month. Cells outside the month are null. */
export function monthGrid(year: number, month: number): (Day | null)[][] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (Day | null)[] = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDay(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Move a { year, month } by a number of months. */
export function shiftMonth(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Whether any day of the month falls inside [minDay, maxDay]. */
export function monthInRange(year: number, month: number, minDay?: Day, maxDay?: Day): boolean {
  const prefix = `${year}-${pad(month)}`;
  return (!minDay || prefix >= minDay.slice(0, 7)) && (!maxDay || prefix <= maxDay.slice(0, 7));
}
