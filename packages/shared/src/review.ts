/** How this week's number compares with last week's, in words and as a direction. */
export function compareWeeks(current: number, previous: number): { direction: "up" | "down" | "same"; label: string } {
  const delta = current - previous;
  if (delta === 0) return { direction: "same", label: "Same as the week before" };
  return {
    direction: delta > 0 ? "up" : "down",
    label: `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} than the week before`,
  };
}

/** A sentence that sums up the week, kind whatever the numbers are. */
export function weekHeadline(peopleReached: number, prayers: number): string {
  const people = peopleReached === 1 ? "1 person" : `${peopleReached} people`;
  const prayed = prayers === 1 ? "prayed once" : `prayed ${prayers} times`;
  if (peopleReached === 0 && prayers === 0) return "A quiet week. Today is a good day to reach out to one person.";
  if (peopleReached === 0) return `You ${prayed} this week. Who could you reach out to today?`;
  if (prayers === 0) return `You reached ${people} this week.`;
  return `You reached ${people} and ${prayed} this week.`;
}
