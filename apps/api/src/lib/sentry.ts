import { randomUUID } from "node:crypto";
import { safeError } from "./log";

/**
 * Optional error reporting to Sentry, switched on by setting SENTRY_DSN.
 *
 * Deliberately tiny and dependency-free: one HTTP call per unexpected error, in Sentry's
 * "envelope" format. Only what `safeError` allows leaves the server: the error's type, a
 * scrubbed one-line message, and the method and path of the request. Never a body, a
 * query string, a header, a user id or an IP address.
 */
export interface ErrorReporter {
  capture(error: unknown, context?: { method?: string; path?: string }): void;
}

export const noReporter: ErrorReporter = { capture: () => undefined };

interface Dsn {
  key: string;
  url: string;
}

/** "https://KEY@o123.ingest.sentry.io/456" → where to post, and the key to post with. */
export function parseDsn(dsn: string): Dsn | null {
  try {
    const u = new URL(dsn);
    const project = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!u.username || !/^\d+$/.test(project) || u.protocol !== "https:") return null;
    return { key: u.username, url: `https://${u.host}/api/${project}/envelope/` };
  } catch {
    return null;
  }
}

export function createSentryReporter(options: { dsn: string; environment: string; fetch?: typeof fetch; now?: () => Date }): ErrorReporter {
  const dsn = parseDsn(options.dsn);
  if (!dsn) return noReporter;
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  // A burst of the same failure must not turn into a burst of outbound calls.
  let sentThisMinute = 0;
  let minute = 0;

  return {
    capture(error, context) {
      const current = Math.floor(now().getTime() / 60_000);
      if (current !== minute) {
        minute = current;
        sentThisMinute = 0;
      }
      if (++sentThisMinute > 20) return;

      const safe = safeError(error);
      const eventId = randomUUID().replace(/-/g, "");
      const sentAt = now().toISOString();
      const event = {
        event_id: eventId,
        timestamp: sentAt,
        platform: "node",
        level: "error",
        environment: options.environment,
        server_name: "koinonia-api",
        transaction: context?.path ? `${context.method ?? "GET"} ${context.path}` : undefined,
        exception: { values: [{ type: safe.type, value: safe.message }] },
        tags: { ...(safe.code ? { code: safe.code } : {}) },
      };
      const body = [JSON.stringify({ event_id: eventId, sent_at: sentAt }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n") + "\n";
      // Fire and forget: reporting must never slow down or break the request that failed.
      void doFetch(dsn.url, {
        method: "POST",
        headers: { "Content-Type": "application/x-sentry-envelope", "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=koinonia/1.0, sentry_key=${dsn.key}` },
        body,
        signal: AbortSignal.timeout(5_000),
      }).catch(() => undefined);
    },
  };
}
