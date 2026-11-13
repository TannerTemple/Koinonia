import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "../src/env";
import { hashPassword, hashToken, needsRehash, newToken, SCRYPT_LOG_N, verifyPassword } from "../src/lib/crypto";
import {
  createProviders,
  ExpoPushProvider,
  MockEmailProvider,
  MockPushProvider,
  MockSmsProvider,
  ResendEmailProvider,
  TwilioSmsProvider,
} from "../src/providers";

const base = { DATABASE_URL: "postgresql://x" };
afterEach(() => vi.unstubAllGlobals());

function stubFetch(status = 200) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(status === 200 ? "{}" : "nope", { status }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("provider selection", () => {
  it("uses mocks unless keys are present", () => {
    const p = createProviders(loadEnv(base));
    expect(p.email).toBeInstanceOf(MockEmailProvider);
    expect(p.sms).toBeInstanceOf(MockSmsProvider);
    expect(p.push).toBeInstanceOf(MockPushProvider);
  });

  it("keeps the mock even when a Resend key is present, until EMAIL_PROVIDER says otherwise", () => {
    expect(createProviders(loadEnv({ ...base, RESEND_API_KEY: "re_x" })).email).toBeInstanceOf(MockEmailProvider);
    const real = loadEnv({ ...base, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "Koinonia <hello@koinonia.test>" });
    expect(createProviders(real).email).toBeInstanceOf(ResendEmailProvider);
  });

  it("refuses to start with EMAIL_PROVIDER=resend and no key or a placeholder sender", () => {
    expect(() => loadEnv({ ...base, EMAIL_PROVIDER: "resend" })).toThrow(/RESEND_API_KEY/);
    expect(() => loadEnv({ ...base, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "  " })).toThrow(/RESEND_API_KEY/);
    expect(() => loadEnv({ ...base, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x" })).toThrow(/EMAIL_FROM/);
    expect(() => loadEnv({ ...base, EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x", EMAIL_FROM: "not an address" })).toThrow(/EMAIL_FROM/);
    expect(() => loadEnv({ ...base, EMAIL_PROVIDER: "carrier-pigeon" })).toThrow(/EMAIL_PROVIDER/);
  });

  it("switches SMS and push on by their own settings", () => {
    const p = createProviders(
      loadEnv({ ...base, TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM_NUMBER: "+15550001111", PUSH_ENABLED: "true" }),
    );
    expect(p.sms).toBeInstanceOf(TwilioSmsProvider);
    expect(p.push).toBeInstanceOf(ExpoPushProvider);
    // Twilio needs all three values.
    expect(createProviders(loadEnv({ ...base, TWILIO_ACCOUNT_SID: "AC1" })).sms).toBeInstanceOf(MockSmsProvider);
  });

  it("refuses to start without a database URL", () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });
});

describe("real adapters (HTTP stubbed)", () => {
  it("Twilio: posts a form with basic auth", async () => {
    const fetch = stubFetch();
    await new TwilioSmsProvider("AC1", "secret", "+15550001111").send({ to: "+15550002222", body: "Hello" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(init.headers).toMatchObject({ Authorization: `Basic ${Buffer.from("AC1:secret").toString("base64")}` });
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({ To: "+15550002222", From: "+15550001111", Body: "Hello" });
  });

  it("Expo push: one message per device, and nothing when there are no devices", async () => {
    const fetch = stubFetch();
    const push = new ExpoPushProvider();
    await push.send({ tokens: [], title: "T", body: "B" });
    expect(fetch).not.toHaveBeenCalled();
    await push.send({ tokens: ["ExponentPushToken[a]", "ExponentPushToken[b]"], title: "T", body: "B", data: { url: "/" } });
    const sent = JSON.parse(fetch.mock.calls[0]![1].body as string);
    expect(sent.map((m: any) => m.to)).toEqual(["ExponentPushToken[a]", "ExponentPushToken[b]"]);
    expect(sent[0]).toMatchObject({ title: "T", body: "B", data: { url: "/" } });
  });

  it("raises when the service says no, so the caller can log it", async () => {
    stubFetch(500);
    await expect(new TwilioSmsProvider("AC1", "secret", "+15550001111").send({ to: "+15550002222", body: "Hello" })).rejects.toThrow(/Twilio responded 500/);
  });

});

describe("password and token hashing", () => {
  it("verifies the right password only, with a different salt each time", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterz", a)).toBe(false);
  });

  it("rejects malformed stored hashes instead of throwing", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc$def")).toBe(false);
    expect(await verifyPassword("x", "scrypt$onlysalt")).toBe(false);
    expect(await verifyPassword("x", "scrypt$99$c2FsdA==$aGFzaA==")).toBe(false);
  });

  it("records the cost in the hash and still reads hashes from before it did", async () => {
    const { scryptSync } = await import("node:crypto");
    const salt = Buffer.from("0123456789abcdef");
    const legacy = ["scrypt", salt.toString("base64"), scryptSync("old password", salt, 64).toString("base64")].join("$");
    expect(await verifyPassword("old password", legacy)).toBe(true);
    expect(needsRehash(legacy)).toBe(SCRYPT_LOG_N > 14);
    const fresh = await hashPassword("new password");
    expect(fresh.split("$")[1]).toBe(String(SCRYPT_LOG_N));
    expect(needsRehash(fresh)).toBe(false);
  });

  it("makes long random tokens and stable hashes", () => {
    const t = newToken();
    expect(t).toMatch(/^[\w-]{43}$/);
    expect(newToken()).not.toBe(t);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
});
