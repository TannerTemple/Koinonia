import { describe, expect, it, vi } from "vitest";
import { ExpoPushProvider } from "../src/providers";

function scripted(...replies: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    if (reply instanceof Error) throw reply;
    return reply.clone();
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const tickets = (...list: object[]) => new Response(JSON.stringify({ data: list }), { status: 200 });
const ok = { status: "ok", id: "ticket-id" };
const message = { title: "Koinonia", body: "Reach out to Mom today", data: { url: "/" } };

describe("Expo push adapter", () => {
  it("sends one message per device in the shape Expo expects", async () => {
    const { fetch, calls } = scripted(tickets(ok, ok));
    const result = await new ExpoPushProvider({ fetch }).send({ ...message, tokens: ["ExponentPushToken[a]", "ExponentPushToken[b]"] });
    expect(result).toEqual({ sent: 2, invalidTokens: [] });
    expect(calls[0]!.url).toBe("https://exp.host/--/api/v2/push/send");
    expect(calls[0]!.init.headers).not.toHaveProperty("Authorization");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual([
      { to: "ExponentPushToken[a]", title: "Koinonia", body: "Reach out to Mom today", data: { url: "/" }, sound: "default" },
      { to: "ExponentPushToken[b]", title: "Koinonia", body: "Reach out to Mom today", data: { url: "/" }, sound: "default" },
    ]);
  });

  it("adds the access token when one is configured", async () => {
    const { fetch, calls } = scripted(tickets(ok));
    await new ExpoPushProvider({ fetch, accessToken: "expo-secret" }).send({ ...message, tokens: ["ExponentPushToken[a]"] });
    expect(calls[0]!.init.headers).toMatchObject({ Authorization: "Bearer expo-secret" });
  });

  it("does nothing when there are no devices", async () => {
    const { fetch, calls } = scripted(tickets());
    expect(await new ExpoPushProvider({ fetch }).send({ ...message, tokens: [] })).toEqual({ sent: 0, invalidTokens: [] });
    expect(calls).toHaveLength(0);
  });

  it("splits more than 100 devices into batches", async () => {
    const tokens = Array.from({ length: 230 }, (_, i) => `ExponentPushToken[${i}]`);
    const { fetch, calls } = scripted(tickets(...Array(100).fill(ok)), tickets(...Array(100).fill(ok)), tickets(...Array(30).fill(ok)));
    const result = await new ExpoPushProvider({ fetch }).send({ ...message, tokens });
    expect(calls.map((c) => JSON.parse(c.init.body as string).length)).toEqual([100, 100, 30]);
    expect(result.sent).toBe(230);
  });

  it("reports devices that no longer exist, and counts other failures without blaming the token", async () => {
    const { fetch } = scripted(tickets(ok, { status: "error", details: { error: "DeviceNotRegistered" } }, { status: "error", details: { error: "MessageRateExceeded" } }));
    const result = await new ExpoPushProvider({ fetch }).send({ ...message, tokens: ["ExponentPushToken[a]", "ExponentPushToken[gone]", "ExponentPushToken[busy]"] });
    expect(result).toEqual({ sent: 1, invalidTokens: ["ExponentPushToken[gone]"] });
  });

  it("raises a plain error, with no token or message text, when Expo refuses or can't be reached", async () => {
    for (const reply of [new Response("nope", { status: 500 }), new TypeError("connect failed ExponentPushToken[a]")]) {
      const { fetch } = scripted(reply);
      const err = await new ExpoPushProvider({ fetch }).send({ ...message, tokens: ["ExponentPushToken[a]"] }).catch((e) => e);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toMatch(/^Expo push (responded 500|could not be reached)$/);
      expect(err.message).not.toContain("ExponentPushToken");
      expect(err.message).not.toContain("Mom");
    }
  });
});
