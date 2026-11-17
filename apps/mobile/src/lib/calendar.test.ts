import { describe, expect, it } from "vitest";
import { monthGrid, monthInRange, shiftMonth } from "./calendar";

describe("monthGrid", () => {
  it("lays out a month in Sunday-first weeks", () => {
    const weeks = monthGrid(2026, 11); // November 2026 starts on a Sunday
    expect(weeks).toHaveLength(5);
    expect(weeks[0]![0]).toBe("2026-11-01");
    expect(weeks[4]![1]).toBe("2026-11-30");
    expect(weeks[4]!.slice(2)).toEqual([null, null, null, null, null]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("pads the first week and handles leap years", () => {
    const feb = monthGrid(2028, 2); // starts on a Tuesday, 29 days
    expect(feb[0]!.slice(0, 3)).toEqual([null, null, "2028-02-01"]);
    expect(feb.flat().filter(Boolean)).toHaveLength(29);
    expect(monthGrid(2027, 2).flat().filter(Boolean)).toHaveLength(28);
  });
});

describe("shiftMonth", () => {
  it("crosses year boundaries both ways", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, -18)).toEqual({ year: 2024, month: 12 });
  });
});

describe("monthInRange", () => {
  it("knows when a month has no selectable days", () => {
    expect(monthInRange(2026, 12, undefined, "2026-11-12")).toBe(false);
    expect(monthInRange(2026, 11, undefined, "2026-11-12")).toBe(true);
    expect(monthInRange(2026, 10, "2026-11-12")).toBe(false);
    expect(monthInRange(2030, 1)).toBe(true);
  });
});
