import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().default(4000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:8081"),
  WEB_URL: z.string().default("http://localhost:3000"),
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
  CRON_SECRET: z.string().min(24, "CRON_SECRET must be at least 24 characters").optional(),
  /** Optional Domain attribute for the web session cookie, e.g. ".example.com". */
  COOKIE_DOMAIN: z.string().optional(),
  DIGEST_ENABLED: bool,
  DIGEST_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  DIGEST_SMS: bool,
  /** Which email service sends messages. "mock" records them and sends nothing. */
  EMAIL_PROVIDER: z.enum(["mock", "resend"]).default("mock"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Koinonia <hello@example.com>"),
  EMAIL_REPLY_TO: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  PUSH_ENABLED: bool,
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

const checked = schema.superRefine((env, ctx) => {
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
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = checked.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return parsed.data;
}
