import type { Home } from "./schemas";

/** The three things a new user does first. Each ticks itself off from what the account holds. */
export interface GettingStarted {
  addedPerson: boolean;
  addedPrayer: boolean;
  reachedOut: boolean;
  /** How many of the three are done. */
  done: number;
  /** True once all three are done: the card goes away. */
  finished: boolean;
}

export function gettingStarted(home: Pick<Home, "stats" | "streaks">): GettingStarted {
  const addedPerson = home.stats.contacts > 0;
  const addedPrayer = home.stats.activeIntentions > 0 || home.streaks.prayer.longest > 0;
  const reachedOut = home.streaks.reachOut.longest > 0;
  const done = [addedPerson, addedPrayer, reachedOut].filter(Boolean).length;
  return { addedPerson, addedPrayer, reachedOut, done, finished: done === 3 };
}

/** "Good morning" / "Good afternoon" / "Good evening" for an hour of the day (0-23). */
export function greetingFor(hour: number): string {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** One line under the "Reach out" heading. */
export function reachOutSummary(dueCount: number, people: number): string {
  if (people === 0) return "Add the people you want to stay close to.";
  if (dueCount === 0) return "Nobody is waiting on you today.";
  return dueCount === 1 ? "One person would love to hear from you." : `${dueCount} people would love to hear from you.`;
}
