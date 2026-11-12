import { describe, expect, it } from "vitest";
import {
  addDays,
  cadenceLabel,
  computeNextDue,
  computeStreak,
  contactLink,
  createContactSchema,
  dayInTimezone,
  diffDays,
  dueLabel,
  dueStatus,
  effectiveDueDay,
  fillStarter,
  isDay,
  nextBirthday,
  normalizePhone,
  registerSchema,
  relativeDay,
} from "./index";

describe("dates", () => {
  it("validates days", () => {
    expect(isDay("2026-02-28")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("nope")).toBe(false);
  });
  it("finds the calendar day in a timezone", () => {
    const at = new Date("2026-11-13T03:30:00Z");
    expect(dayInTimezone(at, "America/Chicago")).toBe("2026-11-12");
    expect(dayInTimezone(at, "Europe/Rome")).toBe("2026-11-13");
    expect(dayInTimezone(at, "Not/AZone")).toBe("2026-11-13");
  });
  it("adds and diffs across month and DST boundaries", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
    expect(addDays("2026-03-07", 2)).toBe("2026-03-09");
    expect(diffDays("2026-10-30", "2026-11-03")).toBe(4);
  });
  it("describes relative days", () => {
    expect(relativeDay("2026-05-10", "2026-05-10")).toBe("today");
    expect(relativeDay("2026-05-07", "2026-05-10")).toBe("3 days ago");
    expect(relativeDay("2026-05-11", "2026-05-10")).toBe("tomorrow");
  });
  it("computes the next birthday", () => {
    expect(nextBirthday("1990-11-20", "2026-11-12")).toBe("2026-11-20");
    expect(nextBirthday("03-01", "2026-11-12")).toBe("2027-03-01");
    expect(nextBirthday("02-29", "2026-01-01")).toBe("2026-02-28");
  });
});

describe("cadence", () => {
  it("labels presets and custom intervals", () => {
    expect(cadenceLabel(7)).toBe("Every week");
    expect(cadenceLabel(21)).toBe("Every 3 weeks");
    expect(cadenceLabel(10)).toBe("Every 10 days");
    expect(cadenceLabel(null)).toBe("No reminder");
  });
  it("computes the next due day from the last reach-out", () => {
    expect(computeNextDue("2026-11-12", 3)).toBe("2026-11-15");
    expect(computeNextDue("2026-11-12", null)).toBeNull();
  });
  it("applies a snooze only when it is later", () => {
    expect(effectiveDueDay("2026-11-12", "2026-11-15")).toBe("2026-11-15");
    expect(effectiveDueDay("2026-11-12", "2026-11-01")).toBe("2026-11-12");
    expect(effectiveDueDay(null, "2026-11-15")).toBeNull();
  });
  it("classifies due status", () => {
    const today = "2026-11-12";
    expect(dueStatus("2026-11-10", today)).toBe("overdue");
    expect(dueStatus(today, today)).toBe("today");
    expect(dueStatus("2026-11-19", today)).toBe("soon");
    expect(dueStatus("2026-11-20", today)).toBe("later");
    expect(dueStatus(null, today)).toBe("none");
    expect(dueLabel("2026-11-09", today)).toBe("3 days overdue");
    expect(dueLabel("2026-11-13", today)).toBe("Due tomorrow");
  });
});

describe("streaks", () => {
  it("counts a run ending today", () => {
    const s = computeStreak(["2026-11-10", "2026-11-11", "2026-11-12"], "2026-11-12");
    expect(s).toEqual({ current: 3, longest: 3, doneToday: true });
  });
  it("keeps the streak alive until the end of today", () => {
    const s = computeStreak(["2026-11-10", "2026-11-11"], "2026-11-12");
    expect(s.current).toBe(2);
    expect(s.doneToday).toBe(false);
  });
  it("resets after a missed day but remembers the longest", () => {
    const s = computeStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-12"], "2026-11-12");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(3);
  });
  it("handles no activity and duplicates", () => {
    expect(computeStreak([], "2026-11-12")).toEqual({ current: 0, longest: 0, doneToday: false });
    expect(computeStreak(["2026-11-12", "2026-11-12"], "2026-11-12").current).toBe(1);
  });
});

describe("schemas", () => {
  it("normalizes phone numbers and emails", () => {
    expect(normalizePhone("+1 (555) 010-2000")).toBe("+15550102000");
    const parsed = registerSchema.parse({
      name: " Tanner ",
      email: "  ME@Example.com ",
      password: "long-enough",
      phone: "(555) 010-2000",
    });
    expect(parsed.name).toBe("Tanner");
    expect(parsed.email).toBe("me@example.com");
    expect(parsed.phone).toBe("5550102000");
  });
  it("turns blank optional fields into null", () => {
    const parsed = createContactSchema.parse({ name: "Ana", phone: "", email: "", birthday: "" });
    expect(parsed).toMatchObject({ phone: null, email: null, birthday: null, cadenceDays: null });
  });
  it("rejects bad input", () => {
    expect(createContactSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createContactSchema.safeParse({ name: "A", cadenceDays: 0 }).success).toBe(false);
    expect(createContactSchema.safeParse({ name: "A", birthday: "13-40" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "A", email: "x", password: "12345678" }).success).toBe(false);
  });
});

describe("templates", () => {
  it("fills first names and builds links", () => {
    expect(fillStarter("Hey {name}!", "Maria Lopez")).toBe("Hey Maria!");
    expect(contactLink("CALL", { phone: "+15550102000", email: null })).toBe("tel:+15550102000");
    expect(contactLink("EMAIL", { phone: null, email: null })).toBeNull();
  });
});
