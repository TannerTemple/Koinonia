import { describe, expect, it } from "vitest";
import { addDays, weekStart } from "./dates";
import { ALL_FEATURES_ON, DAILY_WORDS, RETENTION_FEATURES, featuresFrom, dailyWord, gentleStreak, memoryDays, milestoneAt, nextMilestone, pickMemory, prayerStreakLine, soFarLine, weekStreak, weekStreakLine } from "./keep";

const today = "2026-11-18"; // a Wednesday
const ago = (...n: number[]) => n.map((d) => addDays(today, -d));

describe("a prayer streak that forgives one missed day a week", () => {
  it("counts consecutive days, and survives until tonight", () => {
    expect(gentleStreak(ago(0, 1, 2), today)).toMatchObject({ current: 3, doneToday: true, graceUsed: false, atRisk: false });
    expect(gentleStreak(ago(1, 2, 3), today)).toMatchObject({ current: 3, doneToday: false, atRisk: true });
    expect(gentleStreak([], today)).toMatchObject({ current: 0, longest: 0, atRisk: false });
  });

  it("forgives a single missed day", () => {
    expect(gentleStreak(ago(0, 2, 3, 4), today)).toMatchObject({ current: 4, graceUsed: true });
    // Missed yesterday, not prayed yet today: the run is still alive.
    expect(gentleStreak(ago(2, 3, 4), today)).toMatchObject({ current: 3, graceUsed: true, atRisk: true, doneToday: false });
  });

  it("does not forgive two days in a row, or two misses in a week", () => {
    expect(gentleStreak(ago(3, 4, 5), today)).toMatchObject({ current: 0, longest: 3, atRisk: false });
    expect(gentleStreak(ago(0, 3, 4), today)).toMatchObject({ current: 1 });
    // misses 1 and 3 days ago: only the more recent one is forgiven
    expect(gentleStreak(ago(0, 2, 4, 5), today)).toMatchObject({ current: 2, graceUsed: true });
    // misses 1 and 9 days ago: more than a week apart, both forgiven
    expect(gentleStreak(ago(0, 2, 3, 4, 5, 6, 7, 8, 10, 11), today)).toMatchObject({ current: 10, graceUsed: true });
  });

  it("remembers the longest run", () => {
    expect(gentleStreak([...ago(0), ...ago(20, 21, 22, 23, 24)], today)).toMatchObject({ current: 1, longest: 5 });
  });

  it("says something encouraging, or nothing", () => {
    expect(prayerStreakLine(gentleStreak(ago(0), today))).toBeNull();
    expect(prayerStreakLine(gentleStreak(ago(0, 1), today))).toBe("2 days of prayer in a row.");
    expect(prayerStreakLine(gentleStreak(ago(0, 1, 2, 3, 4, 5, 6), today))).toBe("7 days of prayer in a row. Well done.");
    expect(prayerStreakLine(gentleStreak(ago(1, 2), today))).toBe("Pray today to make it 3 days in a row.");
    expect(prayerStreakLine(gentleStreak(ago(2, 3), today))).toBe("You missed yesterday, and that's all right. Pray today to keep your 2 days going.");
    expect(prayerStreakLine(gentleStreak(ago(5), today))).toBeNull();
  });
});

describe("weeks in a row staying in touch", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-18")).toBe("2026-11-16");
    expect(weekStart("2026-11-16")).toBe("2026-11-16");
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // Sunday belongs to the week before it ends
  });

  it("counts weeks with at least one reach-out", () => {
    expect(weekStreak(ago(1, 8, 9, 15), today)).toEqual({ current: 3, longest: 3, doneThisWeek: true });
    // nothing yet this week: last week's run still stands until Sunday
    expect(weekStreak(ago(8, 15), today)).toEqual({ current: 2, longest: 2, doneThisWeek: false });
    expect(weekStreak(ago(15, 22), today)).toEqual({ current: 0, longest: 2, doneThisWeek: false });
    expect(weekStreak([], today)).toEqual({ current: 0, longest: 0, doneThisWeek: false });
  });

  it("says something encouraging, or nothing", () => {
    expect(weekStreakLine(weekStreak(ago(1), today))).toBeNull();
    expect(weekStreakLine(weekStreak(ago(1, 8), today))).toBe("2 weeks in a row staying in touch.");
    expect(weekStreakLine(weekStreak(ago(8), today))).toBe("Reach out to someone this week to make it 2 weeks in a row.");
    expect(weekStreakLine(weekStreak(ago(30), today))).toBeNull();
  });
});

describe("milestones", () => {
  it("knows when one is reached and which is next", () => {
    expect(milestoneAt(7)).toBe(7);
    expect(milestoneAt(8)).toBeNull();
    expect(nextMilestone(7)).toBe(14);
    expect(nextMilestone(0)).toBe(3);
    expect(nextMilestone(365)).toBeNull();
  });
});

describe("a memory from this day", () => {
  const mom = { contactId: "c1", contactName: "Mom" };
  it("looks a week, a month, three and six months and a year back", () => {
    expect(memoryDays(today)).toEqual(["2025-11-18", "2026-05-20", "2026-08-19", "2026-10-19", "2026-11-11"]);
  });

  it("prefers the oldest memory with something written down", () => {
    const found = pickMemory(today, [
      { ...mom, day: "2025-11-18", summary: null },
      { ...mom, day: "2026-10-19", summary: " She got the job! " },
      { ...mom, day: "2026-11-11", summary: "Talked about Thanksgiving" },
    ]);
    expect(found).toEqual({ label: "A month ago", day: "2026-10-19", contactId: "c1", contactName: "Mom", summary: "She got the job!" });
  });

  it("falls back to a reach-out with nothing written, and to nothing", () => {
    expect(pickMemory(today, [{ ...mom, day: "2025-11-18", summary: null }])).toMatchObject({ label: "A year ago today", summary: null });
    expect(pickMemory(today, [{ ...mom, day: "2026-11-17", summary: "yesterday" }])).toBeNull();
  });
});

describe("what has been built up", () => {
  it("reads as one sentence, and stays quiet with nothing to count", () => {
    expect(soFarLine({ reachOuts: 42, prayers: 118, answered: 3, sinceDay: "2026-03-09" })).toBe("Since March 2026: 42 reach-outs, 118 prayers, 3 answered.");
    expect(soFarLine({ reachOuts: 1, prayers: 0, answered: 0, sinceDay: "2026-11-01" })).toBe("Since November 2026: 1 reach-out.");
    expect(soFarLine({ reachOuts: 0, prayers: 0, answered: 0, sinceDay: "2026-11-01" })).toBeNull();
  });
});

describe("a word for today", () => {
  it("is the same all day, changes the next day, and cycles", () => {
    expect(dailyWord(today)).toEqual(dailyWord(today));
    expect(dailyWord(addDays(today, 1))).not.toEqual(dailyWord(today));
    expect(dailyWord(addDays(today, DAILY_WORDS.length))).toEqual(dailyWord(today));
    expect(dailyWord("2020-02-29").reference).toBeTruthy();
  });

  it("has a full, short entry for every day", () => {
    for (const w of DAILY_WORDS) {
      expect(w.text.length).toBeGreaterThan(10);
      expect(w.text.length).toBeLessThan(130);
      expect(w.reference).toMatch(/^[1-3]? ?[A-Z][a-z]+ \d+:\d+$/);
      expect(w.nudge.length).toBeGreaterThan(10);
    }
    expect(new Set(DAILY_WORDS.map((w) => w.text)).size).toBe(DAILY_WORDS.length);
  });
});

describe("switching features off", () => {
  it("leaves everything on by default", () => {
    expect(featuresFrom(undefined)).toEqual({ features: ALL_FEATURES_ON, unknown: [] });
    expect(featuresFrom("  ")).toEqual({ features: ALL_FEATURES_ON, unknown: [] });
    expect(Object.keys(ALL_FEATURES_ON)).toEqual([...RETENTION_FEATURES]);
  });

  it("turns off only what is named, whatever the capitals or spacing", () => {
    const { features, unknown } = featuresFrom(" memory, DailyWord ,,");
    expect(unknown).toEqual([]);
    expect(features).toEqual({ ...ALL_FEATURES_ON, memory: false, dailyWord: false });
  });

  it("reports names it does not know", () => {
    expect(featuresFrom("memory, streaks").unknown).toEqual(["streaks"]);
  });

  it("drops \"Well done\" when milestones are off, and keeps the count", () => {
    const week = gentleStreak(ago(0, 1, 2, 3, 4, 5, 6), today);
    expect(prayerStreakLine(week, { milestones: false })).toBe("7 days of prayer in a row.");
  });
});
