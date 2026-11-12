import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { AuthResponse } from "@koinonia/shared";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { createMockProviders } from "../src/providers";

export const prisma = new PrismaClient();

export interface TestContext {
  app: FastifyInstance;
  providers: ReturnType<typeof createMockProviders>;
  /** Move the app's clock. */
  setNow: (iso: string) => void;
}

/** Noon UTC, so "today" is the same calendar day in every timezone used by the tests. */
export const NOW = "2026-11-12T12:00:00Z";
export const TODAY = "2026-11-12";

export async function createTestApp(): Promise<TestContext> {
  let current = new Date(NOW);
  const providers = createMockProviders();
  const env = loadEnv({ ...process.env, DIGEST_HOUR: "8" });
  const app = await buildApp({ prisma, providers, env, now: () => current, rateLimit: false });
  return { app, providers, setNow: (iso) => (current = new Date(iso)) };
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "User", "Session", "Contact", "Interaction", "Note", "PrayerIntention", "PrayerLog", "DailyIntention", "PushDevice", "AuthToken" RESTART IDENTITY CASCADE`,
  );
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Api {
  token: string;
  userId: string;
  call: <T = any>(method: Method, url: string, body?: unknown) => Promise<{ status: number; body: T }>;
}

export async function call<T = any>(
  app: FastifyInstance,
  method: Method,
  url: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: T }> {
  const res = await app.inject({
    method,
    url: `/v1${url}`,
    payload: body as object | undefined,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  let parsed: unknown = res.body;
  try {
    parsed = res.body ? JSON.parse(res.body) : null;
  } catch {
    /* non-JSON (e.g. calendar feed) */
  }
  return { status: res.statusCode, body: parsed as T };
}

let counter = 0;

/** Registers a fresh user and returns a client bound to their token. */
export async function signUp(
  app: FastifyInstance,
  overrides: Partial<{ name: string; email: string; phone: string; timezone: string }> = {},
): Promise<Api> {
  counter += 1;
  const res = await call<AuthResponse>(app, "POST", "/auth/register", {
    name: overrides.name ?? `Tester ${counter}`,
    email: overrides.email ?? `tester${counter}-${Date.now()}@example.com`,
    password: "correct horse battery",
    phone: overrides.phone,
    timezone: overrides.timezone ?? "UTC",
  });
  if (res.status !== 201) throw new Error(`sign up failed: ${JSON.stringify(res.body)}`);
  const { token, user } = res.body;
  return { token, userId: user.id, call: (method, url, body) => call(app, method, url, body, token) };
}
