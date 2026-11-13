import { describe, expect, it, vi } from "vitest";
import { EmailDeliveryError, ResendEmailProvider } from "../src/providers";

const message = { to: "maria@example.com", subject: "Reset your Koinonia password", text: "Open this link: https://app.test/reset-password?token=SECRET" };

type Reply = Response | Error | "hang";
/** A fetch that answers with the given replies in order, and records every call. */
function scripted(...replies: Reply[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!;
    if (reply === "hang") {
      return new Promise<Response>((_resolve, reject) => {
        init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
      });
    }
    if (reply instanceof Error) throw reply;
    return reply.clone();
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const ok = () => new Response(JSON.stringify({ id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" }), { status: 200 });
const fail = (status: number, name: string, headers?: Record<string, string>) =>
  new Response(JSON.stringify({ statusCode: status, name, message: `Problem with ${message.to}` }), { status, headers });
const provider = (fetch: typeof globalThis.fetch, extra = {}) =>
  new ResendEmailProvider({ apiKey: "re_test_key", from: "Koinonia <hello@koinonia.test>", backoffMs: 1, fetch, ...extra });

describe("Resend adapter", () => {
  it("posts the message the way Resend's API expects", async () => {
    const { fetch, calls } = scripted(ok());
    await provider(fetch, { replyTo: "help@koinonia.test" }).send(message);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.resend.com/emails");
    expect(calls[0]!.init.method).toBe("POST");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({
      from: "Koinonia <hello@koinonia.test>",
      to: ["maria@example.com"],
      subject: message.subject,
      text: message.text,
      reply_to: "help@koinonia.test",
    });
  });

  it("leaves reply_to out when none is configured", async () => {
    const { fetch, calls } = scripted(ok());
    await provider(fetch).send(message);
    expect(JSON.parse(calls[0]!.init.body as string)).not.toHaveProperty("reply_to");
  });

  it("retries a server error and a network error, reusing one idempotency key", async () => {
    const { fetch, calls } = scripted(fail(503, "internal_server_error"), new TypeError("fetch failed"), ok());
    await provider(fetch).send(message);
    expect(calls).toHaveLength(3);
    const keys = calls.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"]);
    expect(new Set(keys).size).toBe(1);
  });

  it("uses a new idempotency key for each message", async () => {
    const { fetch, calls } = scripted(ok());
    const p = provider(fetch);
    await p.send(message);
    await p.send(message);
    const keys = calls.map((c) => (c.init.headers as Record<string, string>)["Idempotency-Key"]);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("waits as long as a 429 asks before trying again", async () => {
    const { fetch, calls } = scripted(fail(429, "rate_limit_exceeded", { "retry-after": "0.05" }), ok());
    const started = Date.now();
    await provider(fetch).send(message);
    expect(calls).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
  });

  it("does not retry a request Resend will never accept", async () => {
    for (const [status, name] of [[401, "missing_api_key"], [403, "invalid_api_key"], [422, "validation_error"]] as const) {
      const { fetch, calls } = scripted(fail(status, name));
      const err = await provider(fetch).send(message).catch((e) => e);
      expect(err).toBeInstanceOf(EmailDeliveryError);
      expect(err).toMatchObject({ status, attempts: 1 });
      expect(err.message).toContain(`Resend responded ${status} (${name})`);
      expect(calls).toHaveLength(1);
    }
  });

  it("gives up after the configured number of tries", async () => {
    const { fetch, calls } = scripted(fail(500, "internal_server_error"));
    const err = await provider(fetch, { retries: 2 }).send(message).catch((e) => e);
    expect(calls).toHaveLength(3);
    expect(err).toMatchObject({ name: "EmailDeliveryError", status: 500, attempts: 3 });
  });

  it("stops waiting for a request that hangs", async () => {
    const { fetch, calls } = scripted("hang");
    const err = await provider(fetch, { timeoutMs: 20, retries: 1 }).send(message).catch((e) => e);
    expect(calls).toHaveLength(2);
    expect(err).toMatchObject({ status: 0, attempts: 2 });
    expect(err.message).toBe("Resend did not answer in time");
  });

  it("never puts the recipient, the message or the key into an error", async () => {
    for (const reply of [fail(422, "validation_error"), fail(500, "internal_server_error"), new TypeError(`connect failed for ${message.to}`)]) {
      const { fetch } = scripted(reply);
      const err = await provider(fetch, { retries: 0 }).send(message).catch((e) => e);
      const text = `${err.message} ${JSON.stringify(err)}`;
      expect(text).not.toContain("maria@example.com");
      expect(text).not.toContain("SECRET");
      expect(text).not.toContain("re_test_key");
    }
  });
});

/**
 * Sends one real email. Off unless you ask for it:
 *
 *   RESEND_LIVE_TEST=1 RESEND_API_KEY=re_... EMAIL_FROM="Koinonia <hello@yourdomain.com>" \
 *     pnpm --filter @koinonia/api exec vitest run test/resend.test.ts
 *
 * RESEND_TEST_TO chooses the recipient; the default is Resend's own always-delivered test inbox.
 */
describe.skipIf(!process.env.RESEND_LIVE_TEST)("Resend adapter (live)", () => {
  it("is accepted by the real service", async () => {
    const live = new ResendEmailProvider({ apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.EMAIL_FROM ?? "" });
    await expect(
      live.send({ to: process.env.RESEND_TEST_TO ?? "delivered@resend.dev", subject: "Koinonia live test", text: "Sent by the Koinonia test suite." }),
    ).resolves.toBeUndefined();
  });

  it("reports a bad key clearly", async () => {
    const bad = new ResendEmailProvider({ apiKey: "re_not_a_real_key", from: process.env.EMAIL_FROM ?? "", retries: 0 });
    await expect(bad.send({ to: "delivered@resend.dev", subject: "x", text: "x" })).rejects.toThrow(/Resend responded 4\d\d/);
  });
});
