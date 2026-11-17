import { describe, expect, it } from "vitest";
import { maskEmail, readLastSignIn, rememberSignIn } from "./keep";

describe("used last time", () => {
  it("remembers the first name, email and method, and nothing else", () => {
    const text = rememberSignIn({ name: "  Pat  Walker ", email: "pat@example.com" });
    expect(JSON.parse(text)).toEqual({ method: "email", email: "pat@example.com", firstName: "Pat" });
    expect(readLastSignIn(text)).toEqual({ method: "email", email: "pat@example.com", firstName: "Pat" });
  });

  it("ignores anything unreadable", () => {
    for (const bad of [null, undefined, "", "not json", "{}", '{"email":"nope","firstName":"x","method":"email"}']) expect(readLastSignIn(bad)).toBeNull();
  });

  it("masks the email", () => {
    expect(maskEmail("pat@example.com")).toBe("p•••@example.com");
    expect(maskEmail("@example.com")).toBe("@example.com");
  });
});
