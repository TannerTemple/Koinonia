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

describe("weekly review wording", () => {
  it("compares two weeks", async () => {
    const { compareWeeks } = await import("./review");
    expect(compareWeeks(5, 3)).toEqual({ direction: "up", label: "2 more than the week before" });
    expect(compareWeeks(1, 4)).toEqual({ direction: "down", label: "3 fewer than the week before" });
    expect(compareWeeks(2, 2)).toEqual({ direction: "same", label: "Same as the week before" });
  });

  it("writes a headline for any week", async () => {
    const { weekHeadline } = await import("./review");
    expect(weekHeadline(9, 12)).toBe("You reached 9 people and prayed 12 times this week.");
    expect(weekHeadline(1, 1)).toBe("You reached 1 person and prayed once this week.");
    expect(weekHeadline(3, 0)).toBe("You reached 3 people this week.");
    expect(weekHeadline(0, 2)).toContain("prayed 2 times");
    expect(weekHeadline(0, 0)).toContain("quiet week");
  });
});

describe("vCard import", () => {
  const file = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Lopez;Maria;;;",
    "FN:Maria Lopez",
    "item1.TEL;type=HOME:+1 312 555 0100",
    "TEL;type=CELL;type=pref:(312) 555-0150",
    "EMAIL;type=INTERNET:maria@example.com",
    "EMAIL:second@example.com",
    "BDAY:1990-04-12",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:4.0",
    "N:Okafor;Daniel;;;",
    "TEL;VALUE=uri:tel:+13125550102",
    "BDAY:--0704",
    "NOTE:a folded line that",
    "  continues here",
    "END:VCARD",
    "BEGIN:VCARD",
    "VERSION:2.1",
    "ORG:Corner Bakery\\, Inc.;Front desk",
    "BDAY;value=date:1604-12-25",
    "END:VCARD",
    "BEGIN:VCARD",
    "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Jos=C3=A9 Mart=C3=ADn",
    "BDAY:19850230",
    "END:VCARD",
    "BEGIN:VCARD",
    "TEL:555-0000",
    "END:VCARD",
  ].join("\r\n");

  it("reads names, the best phone, the first email and birthdays", async () => {
    const { parseVCards } = await import("./vcard");
    expect(parseVCards(file)).toEqual([
      { name: "Maria Lopez", phone: "(312) 555-0150", email: "maria@example.com", birthday: "1990-04-12" },
      { name: "Daniel Okafor", phone: "+13125550102", email: null, birthday: "07-04" },
      { name: "Corner Bakery, Inc.", phone: null, email: null, birthday: "12-25" },
      { name: "José Martín", phone: null, email: null, birthday: null },
    ]);
  });

  it("returns nothing for files that aren't vCards", async () => {
    const { parseVCards } = await import("./vcard");
    expect(parseVCards("name,phone\nAna,555")).toEqual([]);
    expect(parseVCards("")).toEqual([]);
  });

  it("splits long lists into batches", async () => {
    const { chunk } = await import("./vcard");
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});

describe("birthdays", () => {
  it("never shows a year that wasn't given", async () => {
    const { birthdayLabel } = await import("./dates");
    expect(birthdayLabel("11-20")).toBe("Nov 20");
    expect(birthdayLabel("1990-04-12")).toBe("Apr 12, 1990");
  });

  it("splits into month, day and optional year, and joins back", async () => {
    const { splitBirthday, joinBirthday } = await import("./dates");
    expect(splitBirthday("11-20")).toEqual({ month: "11", day: "20", year: "" });
    expect(splitBirthday("1990-04-02")).toEqual({ month: "4", day: "2", year: "1990" });
    expect(splitBirthday(null)).toEqual({ month: "", day: "", year: "" });
    expect(joinBirthday({ month: "4", day: "2", year: "" })).toBe("04-02");
    expect(joinBirthday({ month: "4", day: "2", year: "1990" })).toBe("1990-04-02");
    expect(joinBirthday({ month: "4", day: "2", year: "19" })).toBe("04-02");
    expect(joinBirthday({ month: "", day: "2", year: "1990" })).toBe("");
    for (const b of ["11-20", "1990-04-12", "02-29"]) expect(joinBirthday(splitBirthday(b))).toBe(b);
  });
});

describe("getting started", () => {
  const home = (contacts: number, intentions: number, reach: number, prayed: number) => ({
    stats: { contacts, reachOutsThisWeek: 0, activeIntentions: intentions },
    streaks: { reachOut: { current: 0, longest: reach, doneToday: false }, prayer: { current: 0, longest: prayed, doneToday: false } },
  });

  it("ticks off each step from what the account holds", async () => {
    const { gettingStarted } = await import("./start");
    expect(gettingStarted(home(0, 0, 0, 0))).toEqual({ addedPerson: false, addedPrayer: false, reachedOut: false, done: 0, finished: false });
    expect(gettingStarted(home(2, 0, 0, 0))).toMatchObject({ addedPerson: true, done: 1, finished: false });
    expect(gettingStarted(home(2, 1, 1, 0))).toMatchObject({ done: 3, finished: true });
    // A prayer that was answered or deleted after being prayed still counts.
    expect(gettingStarted(home(1, 0, 0, 1)).addedPrayer).toBe(true);
  });

  it("greets by time of day and sums up who is waiting", async () => {
    const { greetingFor, reachOutSummary } = await import("./start");
    expect([greetingFor(7), greetingFor(13), greetingFor(21)]).toEqual(["Good morning", "Good afternoon", "Good evening"]);
    expect(reachOutSummary(0, 0)).toContain("Add the people");
    expect(reachOutSummary(0, 4)).toBe("Nobody is waiting on you today.");
    expect(reachOutSummary(1, 4)).toContain("One person");
    expect(reachOutSummary(3, 4)).toContain("3 people");
  });
});

describe("people list", () => {
  const person = (name: string, extra: Record<string, unknown> = {}) =>
    ({ id: name, name, phone: null, email: null, relationship: null, groups: [], favorite: false, dueDay: null, ...extra }) as never;
  const people = [
    person("Mom", { groups: ["Family"], favorite: true, phone: "5550102000", dueDay: "2026-11-10" }),
    person("Ben Castellano", { groups: ["Friends", "Ministry"], relationship: "College friend", dueDay: "2026-11-12" }),
    person("Ana", { groups: ["family"], email: "ana@example.com", dueDay: "2026-11-20" }),
    person("Zed", { groups: ["Book club"] }),
  ];
  const names = (list: { name: string }[]) => list.map((p) => p.name);

  it("puts favorites first, then sorts by name", async () => {
    const { filterPeople } = await import("./people");
    expect(names(filterPeople(people, { today: "2026-11-12" }))).toEqual(["Mom", "Ana", "Ben Castellano", "Zed"]);
  });

  it("filters by due, favorites and group", async () => {
    const { filterPeople } = await import("./people");
    const today = "2026-11-12";
    expect(names(filterPeople(people, { today, filter: "due" }))).toEqual(["Mom", "Ben Castellano"]);
    expect(names(filterPeople(people, { today, filter: "favorites" }))).toEqual(["Mom"]);
    expect(names(filterPeople(people, { today, filter: "group:Family" }))).toEqual(["Mom", "Ana"]);
    expect(names(filterPeople(people, { today, filter: "group:Ministry" }))).toEqual(["Ben Castellano"]);
    expect(names(filterPeople(people, { today, filter: "group:Nobody" }))).toEqual([]);
  });

  it("searches name, relationship, group, email and phone digits, together with a filter", async () => {
    const { filterPeople } = await import("./people");
    const find = (q: string, filter?: never) => names(filterPeople(people, { today: "2026-11-12", q, filter }));
    expect(find("cast")).toEqual(["Ben Castellano"]);
    expect(find("college")).toEqual(["Ben Castellano"]);
    expect(find("book")).toEqual(["Zed"]);
    expect(find("ana@")).toEqual(["Ana"]);
    expect(find("(555) 010")).toEqual(["Mom"]);
    expect(find("55")).toEqual([]);
    expect(find("ana", "group:Family" as never)).toEqual(["Ana"]);
  });

  it("lists the groups in use: presets in order, then the rest, without duplicates", async () => {
    const { groupsInUse } = await import("./people");
    expect(groupsInUse(people)).toEqual(["Family", "Friends", "Ministry", "Book club"]);
    expect(groupsInUse([])).toEqual([]);
  });
});
