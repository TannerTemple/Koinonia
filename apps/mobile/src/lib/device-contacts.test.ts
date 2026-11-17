import { describe, expect, it } from "vitest";
import { toImportable, toImportables } from "./device-contacts";

describe("address-book entries", () => {
  it("uses the name, the primary or mobile phone, and the first email", () => {
    expect(
      toImportable(
        {
          id: "A1",
          name: " Maria Lopez ",
          phoneNumbers: [{ number: "555-0100", label: "home" }, { number: "(555) 010-2000", label: "mobile" }],
          emails: [{ email: "maria@example.com" }, { email: "work@example.com" }],
        },
        0,
      ),
    ).toEqual({ key: "A1", name: "Maria Lopez", phone: "(555) 010-2000", email: "maria@example.com", birthday: null });
    expect(toImportable({ name: "P", phoneNumbers: [{ number: "1" }, { number: "2", isPrimary: true }] }, 3)).toMatchObject({ key: "row-3", phone: "2" });
  });

  it("builds a name from its parts, or the company, and skips entries with none", () => {
    expect(toImportable({ firstName: "Daniel", lastName: "Okafor" }, 0)?.name).toBe("Daniel Okafor");
    expect(toImportable({ name: "", company: "Corner Bakery" }, 0)?.name).toBe("Corner Bakery");
    expect(toImportable({ phoneNumbers: [{ number: "555" }] }, 0)).toBeNull();
    expect(toImportable({ name: "x".repeat(200) }, 0)?.name).toHaveLength(80);
  });

  it("converts birthdays from 0-based months, with or without a year", () => {
    expect(toImportable({ name: "A", birthday: { day: 12, month: 3, year: 1990 } }, 0)?.birthday).toBe("1990-04-12");
    expect(toImportable({ name: "A", birthday: { day: 25, month: 11 } }, 0)?.birthday).toBe("12-25");
    expect(toImportable({ name: "A", birthday: { day: 4, month: 6, year: 1604 } }, 0)?.birthday).toBe("07-04");
    expect(toImportable({ name: "A", birthday: { day: 4, month: 12 } }, 0)?.birthday).toBeNull();
    expect(toImportable({ name: "A", birthday: {} }, 0)?.birthday).toBeNull();
  });

  it("sorts by name and ignores blanks and empty fields", () => {
    const list = toImportables([{ name: "Zed" }, { name: "  " }, { name: "Ana", phoneNumbers: [{ number: " " }], emails: [{}] }]);
    expect(list.map((c) => c.name)).toEqual(["Ana", "Zed"]);
    expect(list[0]).toMatchObject({ phone: null, email: null });
  });
});
