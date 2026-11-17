/**
 * What is safe to write to a hosted log. Logs are kept by the hosting provider, often for
 * weeks and readable by anyone with dashboard access, so nothing a user typed belongs there.
 */

/** Removes things that look like email addresses, long secrets and phone numbers. */
export function scrub(text: string): string {
  return text
    .replace(/[^\s@"'`<>()]+@[^\s@"'`<>()]+\.[^\s@"'`<>()]+/g, "[email]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[number]");
}

/** The path of a request without its query string (search terms, tokens) or calendar secret. */
export function safeUrl(url: string): string {
  const path = url.split("?")[0] ?? "";
  return path.replace(/(\/calendar\/)[^/]+/, "$1[redacted].ics");
}

/**
 * An error reduced to what helps find the fault: its type, any code or status, and the
 * first line of its message with personal data scrubbed. No stack (it can quote arguments),
 * no nested metadata (Prisma puts query values there).
 */
export function safeError(error: unknown): { type: string; code?: string; status?: number; message: string } {
  if (!(error instanceof Error)) return { type: typeof error, message: "non-error thrown" };
  const extra = error as { code?: unknown; status?: unknown; statusCode?: unknown };
  const status = typeof extra.status === "number" ? extra.status : typeof extra.statusCode === "number" ? extra.statusCode : undefined;
  // Prisma messages start with a blank line and a long "Invalid `prisma...` invocation" preamble.
  const firstLine = error.message.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
  return {
    type: error.name,
    ...(typeof extra.code === "string" ? { code: extra.code } : {}),
    ...(status === undefined ? {} : { status }),
    message: scrub(firstLine).slice(0, 300),
  };
}
