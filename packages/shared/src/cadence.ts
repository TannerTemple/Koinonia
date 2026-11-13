import { addDays, diffDays, formatDay, type Day } from "./dates";

export const CADENCE_PRESETS = [
  { days: 3, label: "Every 3 days" },
  { days: 7, label: "Every week" },
  { days: 14, label: "Every 2 weeks" },
  { days: 28, label: "Every 4 weeks" },
  { days: 60, label: "Every 2 months" },
  { days: 90, label: "Every 3 months" },
  { days: 180, label: "Twice a year" },
  { days: 365, label: "Once a year" },
] as const;

export const MAX_CADENCE_DAYS = 730;

export function cadenceLabel(days: number | null | undefined): string {
  if (!days) return "No reminder";
  const preset = CADENCE_PRESETS.find((p) => p.days === days);
  if (preset) return preset.label;
  if (days === 1) return "Every day";
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

/** When a contact is next due, counting from the last time you reached out (or from a start day). */
export function computeNextDue(fromDay: Day, cadenceDays: number | null | undefined): Day | null {
  if (!cadenceDays || cadenceDays < 1) return null;
  return addDays(fromDay, cadenceDays);
}

/** A snooze pushes the due day later; it never pulls it earlier. */
export function effectiveDueDay(
  nextDueDay: Day | null | undefined,
  snoozedUntilDay: Day | null | undefined,
): Day | null {
  if (!nextDueDay) return null;
  if (snoozedUntilDay && snoozedUntilDay > nextDueDay) return snoozedUntilDay;
  return nextDueDay;
}

export type DueStatus = "none" | "overdue" | "today" | "soon" | "later";

/** `soon` means within the next 7 days. */
export function dueStatus(dueDay: Day | null | undefined, today: Day): DueStatus {
  if (!dueDay) return "none";
  const delta = diffDays(today, dueDay);
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";
  if (delta <= 7) return "soon";
  return "later";
}

export function dueLabel(dueDay: Day | null | undefined, today: Day): string {
  if (!dueDay) return "No reminder";
  const delta = diffDays(today, dueDay);
  if (delta < -1) return `${-delta} days overdue`;
  if (delta === -1) return "1 day overdue";
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  if (delta <= 14) return `Due in ${delta} days`;
  return `Due ${formatDay(dueDay, today)}`;
}
