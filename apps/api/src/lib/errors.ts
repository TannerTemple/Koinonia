import type { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) =>
  new HttpError(400, "BAD_REQUEST", message, fields);
export const unauthorized = (message = "Please sign in.") =>
  new HttpError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "You don't have access to that.") =>
  new HttpError(403, "FORBIDDEN", message);
export const notFound = (what = "That") => new HttpError(404, "NOT_FOUND", `${what} wasn't found.`);
export const conflict = (message: string, fields?: Record<string, string>) =>
  new HttpError(409, "CONFLICT", message, fields);

/** Validate input with a shared zod schema, turning issues into a field → message map. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  const first = Object.values(fields)[0] ?? "Invalid input";
  throw badRequest(first, fields);
}
