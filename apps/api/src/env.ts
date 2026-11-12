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
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  WEB_URL: z.string().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().optional(),
  DIGEST_ENABLED: bool,
  DIGEST_HOUR: z.coerce.number().int().min(0).max(23).default(8),
  DIGEST_SMS: bool,
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Koinonia <hello@example.com>"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  PUSH_ENABLED: bool,
  EXPO_ACCESS_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${problems}`);
  }
  return parsed.data;
}
