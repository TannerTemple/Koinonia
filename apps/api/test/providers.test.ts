import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnv } from "../src/env";
import { hashPassword, hashToken, newToken, verifyPassword } from "../src/lib/crypto";
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

  it("switches each real adapter on by its own keys", () => {
    const p = createProviders(
      loadEnv({ ...base, RESEND_API_KEY: "re_x", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM_NUMBER: "+15550001111", PUSH_ENABLED: "true" }),
    );
    expect(p.email).toBeInstanceOf(ResendEmailProvider);
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
  it("Resend: posts the message with the API key", async () => {
    const fetch = stubFetch();
    await new ResendEmailProvider("re_key", "Koinonia <hi@example.com>").send({ to: "a@b.co", subject: "Hi", text: "Body" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers).toMatchObject({ Authorization: "Bearer re_key" });
    expect(JSON.parse(init.body as string)).toEqual({ from: "Koinonia <hi@example.com>", to: "a@b.co", subject: "Hi", text: "Body" });
  });

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
    await expect(new ResendEmailProvider("k", "f").send({ to: "a@b.co", subject: "s", text: "t" })).rejects.toThrow(/Resend responded 500/);
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
