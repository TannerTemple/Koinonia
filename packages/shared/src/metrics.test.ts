import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { isActivated, ratio, retainedIn, screenPattern, weeklyMetrics, type MetricsAccount } from "./metrics";

const today = "2026-11-18"; // Wednesday; this week starts Monday 2026-11-16
const account = (signedUpDay: string, people: number[] = [], active: number[] = []): MetricsAccount => ({
  signedUpDay,
  peopleAddedDays: people.map((n) => addDays(signedUpDay, n)),
  activeDays: active.map((n) => addDays(signedUpDay, n)),
});

describe("activation and retention for one account", () => {
  it("is activated by three people within the first seven days", () => {
    expect(isActivated(account("2026-10-05", [0, 0, 6]))).toBe(true);
    expect(isActivated(account("2026-10-05", [0, 0, 7]))).toBe(false);
    expect(isActivated(account("2026-10-05", [0, 1]))).toBe(false);
  });

  it("is retained by any reach-out or prayer inside the window", () => {
    const a = account("2026-10-05", [], [0, 9, 30]);
    expect(retainedIn(a, 7, 13)).toBe(true);
    expect(retainedIn(a, 28, 34)).toBe(true);
    expect(retainedIn(account("2026-10-05", [], [0, 6, 14]), 7, 13)).toBe(false);
  });
});

describe("weekly metrics", () => {
  const accounts = [
    account("2026-10-05", [0, 0, 1], [0, 8, 29, 43]), // Monday six weeks ago: activated, kept at week 1 and 4, active this week
    account("2026-10-07", [0], [0]), // same week: not activated, never came back
    account("2026-11-10", [0, 1, 2], [0, 1]), // last week: activated; week 1 not over yet
    account("2026-11-17", [], []), // this week
  ];
  const rows = weeklyMetrics(accounts, today, 8);

  it("has one row per week, oldest first, ending with this week", () => {
    expect(rows).toHaveLength(8);
    expect(rows[7]!.weekStart).toBe("2026-11-16");
    expect(rows[0]!.weekStart).toBe("2026-09-28");
  });

  it("counts sign-ups, activation and retention by the week people joined", () => {
    const first = rows.find((r) => r.weekStart === "2026-10-05")!;
    expect(first).toMatchObject({ signups: 2, activated: 1, week1Retained: 1, week1Known: true, week4Retained: 1, week4Known: true });
    const last = rows.find((r) => r.weekStart === "2026-11-09")!;
    expect(last).toMatchObject({ signups: 1, activated: 1, week1Retained: 0, week1Known: false, week4Known: false });
    expect(rows[7]).toMatchObject({ signups: 1, activated: 0 });
  });

  it("counts weekly active users whatever week they joined", () => {
    expect(rows.find((r) => r.weekStart === "2026-10-05")!.activeUsers).toBe(2);
    expect(rows.find((r) => r.weekStart === "2026-11-09")!.activeUsers).toBe(1);
    expect(rows[7]!.activeUsers).toBe(1); // day 43 of the first account is 2026-11-17
    expect(rows.find((r) => r.weekStart === "2026-10-19")!.activeUsers).toBe(0);
  });

  it("only calls a retention figure known once the whole window has passed", () => {
    // Cohort week of 2026-10-12 ends Sunday 10-18; day 34 after that is 11-21, still ahead.
    const row = rows.find((r) => r.weekStart === "2026-10-12")!;
    expect(row.week1Known).toBe(true);
    expect(row.week4Known).toBe(false);
  });

  it("writes a ratio a person can read", () => {
    expect(ratio(3, 8)).toBe("3 of 8 (38%)");
    expect(ratio(0, 0)).toBe("–");
  });
});

describe("screen names carry no identifiers", () => {
  it("replaces anything that is not a plain word", () => {
    expect(screenPattern("/")).toBe("/");
    expect(screenPattern("/people")).toBe("/people");
    expect(screenPattern("/people/cmh2x9k0a0001abcdxyz12345/edit?tab=1")).toBe("/people/:id/edit");
    expect(screenPattern("/contact/cmh2x9k0a0001abcdxyz12345")).toBe("/contact/:id");
    expect(screenPattern("/contact/reach-out")).toBe("/contact/reach-out");
    expect(screenPattern("/reset-password/")).toBe("/reset-password");
    expect(screenPattern("/people/Maria%20Lopez")).toBe("/people/:id");
    expect(screenPattern("/people/12345")).toBe("/people/:id");
  });

  it("refuses things that are not screens", () => {
    expect(screenPattern("https://evil.example/x")).toBeNull();
    expect(screenPattern("/" + "a/".repeat(80))).toBeNull();
  });
});
