import { BRAND, RETENTION_FEATURES, featuresFrom } from "@koinonia/shared";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1, "is missing"),
  DIRECT_URL: z.string().optional(),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default("0.0.0.0"),
  /** Optional: report unexpected errors to Sentry. Unset = nothing is sent anywhere. */
  SENTRY_DSN: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CORS_ORIGINS: z.string().default(`${BRAND.defaultWebUrl},http://localhost:8081`),
  WEB_URL: z.string().default(BRAND.defaultWebUrl),
  API_PUBLIC_URL: z.string().optional(),
  /**
   * How many reverse proxies sit in front of the API: "false"/0 for none, a number for that
   * many hops (1 on most hosts), or "true" to trust every forwarded address (only safe when
   * the API cannot be reached except through the proxy).
   */
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((v) => {
      if (!v || v === "false" || v === "0") return false;
      if (v === "true") return true;
      const hops = Number(v);
      return Number.isInteger(hops) && hops > 0 ? hops : false;
    }),
  /**
   * Lets an outside scheduler run the daily digest: POST /v1/jobs/digest with this value in
   * the X-Cron-Secret header. Unset = the endpoint does not exist.
   */
  CRON_SECRET: z.string().min(24, "must be at least 24 characters").optional(),
  /**
   * Shared with the web app (its PROXY_SECRET). When a request carries it, the API believes
   * the visitor address the web app passes along, so web visitors are rate-limited one by one
   * instead of all together. Unset = web visitors share the web server's address.
   */
  PROXY_SECRET: z.string().min(24, "must be at least 24 characters").optional(),
  /** Optional Domain attribute for the web session cookie, e.g. ".example.com". */
  COOKIE_DOMAIN: z.string().optional(),
  DIGEST_ENABLED: bool,
  DIGEST_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  DIGEST_SMS: bool,
  /** Which email service sends messages. "mock" records them and sends nothing. */
  EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default(BRAND.emailFrom),
  EMAIL_REPLY_TO: z.string().optional(),
  /** Retention features to switch off, comma-separated (see docs/RETENTION.md). Empty = all on. */
  FEATURES_OFF: z.string().optional(),
  /** Where "Send feedback" messages are emailed. Unset = they are only saved (Admin > Feedback). */
  FEEDBACK_EMAIL: z.string().trim().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "must be an email address, like you@example.com").optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  /** Which service delivers push notifications. "mock" records them and sends nothing. */
  PUSH_PROVIDER: z.enum(["mock", "expo"]).optional(),
  /** Older switch, still honoured: PUSH_ENABLED=true means PUSH_PROVIDER=expo. */
  PUSH_ENABLED: bool,
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

const isOrigin = (value: string) => /^https?:\/\/[^/\s?#]+$/.test(value);

/** What people actually paste into a host's settings page: quotes, spaces, a trailing slash. */
const tidy = (value: string | undefined) => {
  const v = value?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
  return v ? v : undefined;
};
const tidyUrl = (value: string | undefined) => tidy(value)?.replace(/\/+$/, "");

/** Why a database address is unusable, in plain words; null when it looks right. */
export function databaseUrlProblem(name: string, value: string | undefined): string | null {
  const v = tidy(value);
  if (!v) return `is missing. Paste the connection string from Neon (it starts with postgresql://).`;
  if (/^psql\s/.test(v)) return `starts with "psql". Paste only the part inside the quotes, starting with postgresql://`;
  if (!/^postgres(ql)?:\/\/[^\s]+$/.test(v)) return `must start with postgresql:// and contain no spaces. What was pasted starts with "${v.slice(0, 12)}..."`;
  if (/\[?YOUR[-_ ]?PASSWORD\]?|<password>|\*{4,}/i.test(v)) return `still contains a placeholder instead of the real password. In Neon, click "Show password" before copying.`;
  try {
    new URL(v);
  } catch {
    return `is not a valid address. Copy it again from Neon with the copy button.`;
  }
  if (name === "DIRECT_URL" && /-pooler\./.test(v)) return `is the pooled address (its host contains "-pooler"). It must be the direct one: in Neon's Connect box, switch "Connection pooling" off and copy again.`;
  return null;
}

/** Checks that involve more than one setting. Run even when a single value is malformed, so every problem is listed at once. */
function crossChecks(env: { CORS_ORIGINS: string; WEB_URL: string; EMAIL_PROVIDER: string; RESEND_API_KEY?: string; EMAIL_FROM: string }, ctx: { addIssue(issue: { code: "custom"; path: string[]; message: string }): void }) {
  // CORS: an explicit list of origins. The API sends credentials, so "anything" is never right.
  const origins = env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  if (origins.length === 0 || origins.some((o) => !isOrigin(o))) {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGINS"],
      message: "must be a comma-separated list of origins like https://app.example.com (no paths, no trailing slash, never *)",
    });
  }
  if (!isOrigin(env.WEB_URL.replace(/\/+$/, ""))) {
    ctx.addIssue({ code: "custom", path: ["WEB_URL"], message: "must be the web app's address, like https://app.example.com" });
  }

  // Asking for real email without the means to send it should stop the API at start,
  // not fail quietly the first time someone needs a password reset.
  if (env.EMAIL_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY?.trim()) {
      ctx.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "required when EMAIL_PROVIDER=resend" });
    }
    const address = /<([^>]+)>/.exec(env.EMAIL_FROM)?.[1] ?? env.EMAIL_FROM;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim()) || /@example\.(com|org|net)$/i.test(address.trim())) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "must be a real sender on a domain verified with Resend when EMAIL_PROVIDER=resend",
      });
    }
  }
}

export type Env = z.infer<typeof schema> & { PUSH_PROVIDER: "mock" | "expo" };

/** Settings that work but are wrong for a public deployment. Logged at start, never fatal. */
export function productionWarnings(env: Env): string[] {
  if (env.NODE_ENV !== "production") return [];
  const warnings: string[] = [];
  const local = (url: string) => /\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(url);
  const origins = env.CORS_ORIGINS.split(",").map((o) => o.trim());
  if (origins.some(local)) warnings.push("CORS_ORIGINS still allows localhost; set it to the web app's address only.");
  if (origins.some((o) => o.startsWith("http://") && !local(o))) warnings.push("CORS_ORIGINS contains an http:// origin; use https://.");
  if (local(env.WEB_URL)) warnings.push("WEB_URL points at localhost; links in emails will not work.");
  else if (env.WEB_URL.startsWith("http://")) warnings.push("WEB_URL is http://; use https:// so emailed links are private.");
  if (env.TRUST_PROXY === false) warnings.push("TRUST_PROXY is off; behind a host's proxy every visitor shares one rate limit. Set TRUST_PROXY=1.");
  if (env.TRUST_PROXY === true) warnings.push("TRUST_PROXY=true trusts any forwarded address; prefer a hop count such as 1.");
  if (env.EMAIL_PROVIDER === "mock") warnings.push("EMAIL_PROVIDER=mock: no email is sent, so password reset and email confirmation reach nobody. See the Real email step in docs/DEPLOY.md.");
  if (!env.PROXY_SECRET) warnings.push("PROXY_SECRET is not set; everyone using the web app shares one rate limit. Set the same long random value on the API and the web app.");
  if (!env.API_PUBLIC_URL) warnings.push("API_PUBLIC_URL is not set; calendar links are built from the request's host.");
  else if (!isOrigin(env.API_PUBLIC_URL)) warnings.push("API_PUBLIC_URL should look like https://your-api.onrender.com (no path).");
  return warnings;
}

/** Thrown when a setting is missing or wrong. The message is written for a person, not a log parser. */
export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(
      [
        `${BRAND.name} API cannot start: ` + (problems.length === 1 ? "one setting is" : `${problems.length} settings are`) + " missing or wrong.",
        "",
        ...problems.map((p) => `  - ${p}`),
        "",
        "Fix: correct the value in your host's settings and save (Render: service > Environment. Azure: Container App > Containers > Environment variables).",
        "Locally, edit apps/api/.env. The full list is in .env.example and docs/DEPLOY.md.",
      ].join("\n"),
    );
    this.name = "EnvError";
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const production = source.NODE_ENV === "production";
  const input: NodeJS.ProcessEnv = { ...source };
  // An empty box on a host's settings page means "not set".
  for (const key of Object.keys(input)) if (input[key]?.trim() === "") delete input[key];
  for (const key of ["DATABASE_URL", "DIRECT_URL", "RESEND_API_KEY", "SENTRY_DSN", "CRON_SECRET", "PROXY_SECRET"]) if (input[key]) input[key] = tidy(input[key]);
  for (const key of ["WEB_URL", "API_PUBLIC_URL"]) if (input[key]) input[key] = tidyUrl(input[key]);
  if (input.CORS_ORIGINS) input.CORS_ORIGINS = input.CORS_ORIGINS.split(",").map((o) => tidyUrl(o)).filter(Boolean).join(",");
  // Render tells the service its own public address; use it unless one was chosen.
  if (!input.API_PUBLIC_URL && input.RENDER_EXTERNAL_URL) input.API_PUBLIC_URL = tidyUrl(input.RENDER_EXTERNAL_URL);
  // One address to set instead of two: browsers at WEB_URL may call the API.
  if (!input.CORS_ORIGINS && input.WEB_URL && isOrigin(input.WEB_URL)) input.CORS_ORIGINS = input.WEB_URL;

  const problems: string[] = [];
  const db = databaseUrlProblem("DATABASE_URL", input.DATABASE_URL);
  if (db) problems.push(`DATABASE_URL ${db}`);
  if (input.DIRECT_URL) {
    const direct = databaseUrlProblem("DIRECT_URL", input.DIRECT_URL);
    if (direct) problems.push(`DIRECT_URL ${direct}`);
  } else if (!db && /-pooler\./.test(input.DATABASE_URL ?? "")) {
    problems.push(`DIRECT_URL is missing. DATABASE_URL is Neon's pooled address, so migrations need the direct one too: in Neon's Connect box, switch "Connection pooling" off, copy, and add it as DIRECT_URL.`);
  }
  if (production && input.PORT && !/^\d+$/.test(input.PORT)) problems.push(`PORT must be a number (on Render, do not set it at all). It is "${input.PORT}".`);

  const unknownFeatures = featuresFrom(input.FEATURES_OFF).unknown;
  if (unknownFeatures.length) problems.push(`FEATURES_OFF has ${unknownFeatures.length === 1 ? "a name" : "names"} that ${unknownFeatures.length === 1 ? "is" : "are"} not a feature: ${unknownFeatures.join(", ")}. The features are: ${RETENTION_FEATURES.join(", ")}.`);

  const parsed = schema.safeParse(input);
  const cross: { path: string[]; message: string }[] = [];
  crossChecks(
    {
      CORS_ORIGINS: input.CORS_ORIGINS ?? BRAND.defaultWebUrl,
      WEB_URL: input.WEB_URL ?? BRAND.defaultWebUrl,
      EMAIL_PROVIDER: input.EMAIL_PROVIDER ?? "mock",
      RESEND_API_KEY: input.RESEND_API_KEY,
      EMAIL_FROM: input.EMAIL_FROM ?? BRAND.emailFrom,
    },
    { addIssue: (issue) => cross.push(issue) },
  );
  const issues = [...(parsed.success ? [] : parsed.error.issues.map((i) => ({ path: i.path.map(String), message: i.message }))), ...cross];
  if (issues.length) {
    for (const issue of issues) {
      const name = issue.path.join(".");
      if (name === "DATABASE_URL" && db) continue;
      const shown = name === "WEB_URL" || name === "CORS_ORIGINS" || name === "LOG_LEVEL" || name === "EMAIL_PROVIDER" || name === "PUSH_PROVIDER" || name === "DIGEST_HOUR" ? ` It is "${input[name] ?? ""}".` : "";
      problems.push(`${name} ${issue.message.replace(/^Invalid input: /, "is wrong: ").replace(/^Invalid option: /, "is not one of the allowed values: ")}.${shown}`);
    }
  }
  if (problems.length || !parsed.success) throw new EnvError(problems);
  return { ...parsed.data, PUSH_PROVIDER: parsed.data.PUSH_PROVIDER ?? (parsed.data.PUSH_ENABLED ? "expo" : "mock") };
}
