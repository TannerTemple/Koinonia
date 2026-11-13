import { randomUUID } from "node:crypto";
import type { EmailMessage, EmailProvider } from "./index";

/**
 * Why an email could not be delivered. Deliberately carries no recipient, subject or body,
 * so it is safe to write to logs.
 */
export class EmailDeliveryError extends Error {
  constructor(
    message: string,
    /** HTTP status from the email service, or 0 when it could not be reached. */
    public status: number,
    public attempts: number,
  ) {
    super(message);
    this.name = "EmailDeliveryError";
  }
}

export interface ResendOptions {
  apiKey: string;
  /** "Name <address@your-verified-domain>" */
  from: string;
  replyTo?: string;
  /** Extra tries after the first, for timeouts, 429 and 5xx. */
  retries?: number;
  timeoutMs?: number;
  /** First wait between tries; doubles each time. */
  backoffMs?: number;
  fetch?: typeof fetch;
}

const ENDPOINT = "https://api.resend.com/emails";
const MAX_WAIT_MS = 5_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resend (https://resend.com). Switched on with EMAIL_PROVIDER=resend.
 *
 * - Temporary failures (timeout, network error, 429, 5xx) are retried with backoff; anything
 *   else (bad key, unverified sender, invalid address) fails at once, since retrying can't help.
 * - Every try of one message carries the same Idempotency-Key, so a retry after a response
 *   that got lost does not send the email twice.
 */
export class ResendEmailProvider implements EmailProvider {
  private readonly retries: number;
  private readonly timeoutMs: number;
  private readonly backoffMs: number;

  constructor(private readonly options: ResendOptions) {
    this.retries = options.retries ?? 2;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.backoffMs = options.backoffMs ?? 500;
  }

  async send(message: EmailMessage): Promise<void> {
    const doFetch = this.options.fetch ?? fetch;
    const body = JSON.stringify({
      from: this.options.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(this.options.replyTo ? { reply_to: this.options.replyTo } : {}),
    });
    const headers = {
      Authorization: `Bearer ${this.options.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": randomUUID(),
    };

    let last = new EmailDeliveryError("Resend could not be reached", 0, 0);
    for (let attempt = 1; attempt <= this.retries + 1; attempt++) {
      let wait = this.backoffMs * 2 ** (attempt - 1);
      try {
        const res = await doFetch(ENDPOINT, { method: "POST", headers, body, signal: AbortSignal.timeout(this.timeoutMs) });
        if (res.ok) return;

        last = new EmailDeliveryError(await describe(res), res.status, attempt);
        const temporary = res.status === 429 || res.status >= 500;
        if (!temporary) throw last;
        const retryAfter = Number(res.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) wait = retryAfter * 1000;
      } catch (err) {
        if (err instanceof EmailDeliveryError) {
          if (err.status !== 429 && err.status < 500) throw err;
        } else {
          const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
          last = new EmailDeliveryError(timedOut ? "Resend did not answer in time" : "Resend could not be reached", 0, attempt);
        }
      }
      if (attempt <= this.retries) await sleep(Math.min(wait, MAX_WAIT_MS));
    }
    throw last;
  }
}

/** "Resend responded 422 (validation_error)": the error type, never the message text, which can quote addresses. */
async function describe(res: Response): Promise<string> {
  let kind = "";
  try {
    const data = (await res.json()) as { name?: unknown };
    if (typeof data.name === "string") kind = ` (${data.name.slice(0, 60)})`;
  } catch {
    /* not JSON */
  }
  const hint =
    res.status === 401 || res.status === 403
      ? ": check RESEND_API_KEY and that the EMAIL_FROM domain is verified"
      : res.status === 422
        ? ": check EMAIL_FROM and the recipient address"
        : "";
  return `Resend responded ${res.status}${kind}${hint}`;
}
