import { addDays, diffDays, type Day } from "./dates";

export interface Streak {
  /** Consecutive days ending today (or yesterday, so a streak survives until midnight tonight). */
  current: number;
  longest: number;
  /** Whether today already counts. */
  doneToday: boolean;
}

export function computeStreak(days: Iterable<Day>, today: Day): Streak {
  const set = new Set(days);
  const sorted = [...set].sort();

  let longest = 0;
  let run = 0;
  let prev: Day | null = null;
  for (const day of sorted) {
    run = prev && diffDays(prev, day) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }

  const doneToday = set.has(today);
  let cursor = doneToday ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest, doneToday };
}
