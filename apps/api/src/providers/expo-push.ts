import type { PushMessage, PushProvider, PushResult } from "./index";

export interface ExpoPushOptions {
  /** Optional: only needed when "enhanced push security" is on for the Expo project. */
  accessToken?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

const ENDPOINT = "https://exp.host/--/api/v2/push/send";
/** Expo accepts at most 100 messages per request. */
const CHUNK = 100;

interface Ticket {
  status?: string;
  details?: { error?: string };
}

/**
 * Expo's push service (which hands messages to Apple and Google). Switched on with
 * PUSH_PROVIDER=expo.
 *
 * - Sends in batches of 100, each with a timeout.
 * - Reports the tokens Expo says no longer exist ("DeviceNotRegistered": the app was
 *   deleted or notifications were turned off) so the caller can forget them.
 * - Errors carry a status only: never a token or the message text.
 */
export class ExpoPushProvider implements PushProvider {
  constructor(private readonly options: ExpoPushOptions = {}) {}

  async send(message: PushMessage): Promise<PushResult> {
    const doFetch = this.options.fetch ?? fetch;
    const invalidTokens: string[] = [];
    let failed = 0;

    for (let i = 0; i < message.tokens.length; i += CHUNK) {
      const tokens = message.tokens.slice(i, i + CHUNK);
      let res: Response;
      try {
        res = await doFetch(ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            ...(this.options.accessToken ? { Authorization: `Bearer ${this.options.accessToken}` } : {}),
          },
          body: JSON.stringify(tokens.map((to) => ({ to, title: message.title, body: message.body, data: message.data, sound: "default" }))),
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
        });
      } catch {
        throw new Error("Expo push could not be reached");
      }
      if (!res.ok) throw new Error(`Expo push responded ${res.status}`);

      const body = (await res.json().catch(() => null)) as { data?: Ticket[] } | null;
      (body?.data ?? []).forEach((ticket, index) => {
        if (ticket.status === "ok") return;
        failed += 1;
        if (ticket.details?.error === "DeviceNotRegistered" && tokens[index]) invalidTokens.push(tokens[index]);
      });
    }
    return { sent: message.tokens.length - failed, invalidTokens };
  }
}
