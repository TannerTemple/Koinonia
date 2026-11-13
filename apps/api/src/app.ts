import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { PrismaClient, User } from "@prisma/client";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { dayInTimezone } from "@koinonia/shared";
import type { Env } from "./env";
import { hashToken } from "./lib/crypto";
import { forbidden, HttpError, unauthorized } from "./lib/errors";
import { safeError, safeUrl } from "./lib/log";
import type { Providers } from "./providers";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { calendarRoutes } from "./routes/calendar";
import { contactRoutes } from "./routes/contacts";
import { homeRoutes } from "./routes/home";
import { jobRoutes } from "./routes/jobs";
import { noteRoutes } from "./routes/notes";
import { prayerRoutes } from "./routes/prayer";
import { userRoutes } from "./routes/users";

export const SESSION_DAYS = 30;
export const SESSION_COOKIE = "koinonia_session";
/** Browsers send this on every call; a cookie is only honoured alongside it (see sessionToken). */
export const CLIENT_HEADER = "x-koinonia-client";

/** Set-Cookie value for the web session: httpOnly so page scripts can never read the token. */
export function sessionCookie(env: Env, token: string | null): string {
  return [
    `${SESSION_COOKIE}=${token ?? ""}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${token ? SESSION_DAYS * 86_400 : 0}`,
    ...(env.NODE_ENV === "production" ? ["Secure"] : []),
    ...(env.COOKIE_DOMAIN ? [`Domain=${env.COOKIE_DOMAIN}`] : []),
  ].join("; ");
}

/**
 * The session token of a request: a bearer header (iOS app), or the web cookie. The cookie
 * only counts together with the custom client header, which another site cannot send without
 * passing our CORS allowlist, so a forged cross-site request never carries a session.
 */
function sessionToken(request: FastifyRequest): { token: string; fromCookie: boolean } | null {
  const header = request.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    return token ? { token, fromCookie: false } : null;
  }
  if (request.headers[CLIENT_HEADER] !== "web") return null;
  for (const part of (request.headers.cookie ?? "").split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE && value.join("=")) return { token: value.join("="), fromCookie: true };
  }
  return null;
}

const DAY_MS = 86_400_000;

export interface AppDeps {
  prisma: PrismaClient;
  providers: Providers;
  env: Env;
  /** Injectable clock so tests can move time. */
  now?: () => Date;
  logger?: boolean;
  /** Where log lines go (default: stdout). Lets tests read what would be logged. */
  logStream?: { write: (line: string) => void };
  rateLimit?: boolean;
}

export interface AuthContext {
  user: User;
  sessionId: string;
  /** Today's calendar day in the user's timezone. */
  today: string;
}

declare module "fastify" {
  interface FastifyInstance {
    deps: Required<Pick<AppDeps, "prisma" | "providers" | "env" | "now">>;
    /** Work that continues after a response was sent (emails). */
    background: { track: (work: Promise<unknown>) => void; idle: () => Promise<void> };
    authenticate: (request: FastifyRequest, reply?: FastifyReply) => Promise<void>;
    requireAdmin: (request: FastifyRequest, reply?: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const now = deps.now ?? (() => new Date());
  const hops = deps.env.TRUST_PROXY;
  const app = Fastify({
    logger: deps.logger
      ? {
          level: deps.env.LOG_LEVEL,
          ...(deps.logStream ? { stream: deps.logStream } : {}),
          serializers: {
            // Path only: query strings carry search terms (names, emails, phone numbers).
            req: (req) => ({ method: req.method, url: safeUrl(req.url), remoteAddress: req.ip }),
          },
        }
      : false,
    // A number means "trust that many proxy hops", counted from the API outwards.
    trustProxy: typeof hops === "number" ? (_address: string, hop: number) => hop < hops : hops,
    // The largest legitimate body is a 500-person import (well under this).
    bodyLimit: 512 * 1024,
  });
  app.decorate("deps", { prisma: deps.prisma, providers: deps.providers, env: deps.env, now });
  app.decorateRequest("auth", null as unknown as AuthContext);

  const pending = new Set<Promise<unknown>>();
  app.decorate("background", {
    track: (work: Promise<unknown>) => {
      pending.add(work);
      void work.finally(() => pending.delete(work));
    },
    idle: async () => {
      while (pending.size) await Promise.allSettled([...pending]);
    },
  });
  // Let emails that are mid-send finish before the process exits on a deploy.
  app.addHook("onClose", () => app.background.idle());

  await app.register(helmet);
  await app.register(cors, {
    origin: deps.env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    // The web app signs in with an httpOnly cookie.
    credentials: true,
    // Let browsers remember the preflight answer for ten minutes.
    maxAge: 600,
    allowedHeaders: ["Content-Type", "Authorization", "X-Koinonia-Client"],
  });
  if (deps.rateLimit ?? true) {
    await app.register(rateLimit, {
      max: 300,
      timeWindow: "1 minute",
      // Hosts poll these constantly; they must never be throttled into "unhealthy".
      allowList: (request) => request.url === "/health" || request.url === "/health/ready",
    });
  }

  app.decorate("authenticate", async (request: FastifyRequest, reply?: FastifyReply) => {
    const found = sessionToken(request);
    if (!found) throw unauthorized();
    const { token, fromCookie } = found;

    const session = await deps.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    const at = now();
    if (!session || session.expiresAt <= at) throw unauthorized("Your session expired. Please sign in again.");
    if (session.user.disabledAt) throw forbidden("This account has been disabled.");

    // Sliding expiry: touch at most once a day to avoid a write on every request.
    if (at.getTime() - session.lastUsedAt.getTime() > DAY_MS) {
      await deps.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: at, expiresAt: new Date(at.getTime() + SESSION_DAYS * DAY_MS) },
      });
      await deps.prisma.user.update({ where: { id: session.userId }, data: { lastSeenAt: at } });
      if (fromCookie) reply?.header("Set-Cookie", sessionCookie(deps.env, token));
    }

    request.auth = {
      user: session.user,
      sessionId: session.id,
      today: dayInTimezone(at, session.user.timezone),
    };
  });

  app.decorate("requireAdmin", async (request: FastifyRequest, reply?: FastifyReply) => {
    await app.authenticate(request, reply);
    if (request.auth.user.role !== "ADMIN") throw forbidden("Admins only.");
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply
        .status(error.status)
        .send({ error: { code: error.code, message: error.message, fields: error.fields } });
    }
    // Prisma: a unique-constraint race is a conflict, a vanished row is a 404 — not a 500.
    const prismaCode = (error as { code?: string }).code;
    if (prismaCode === "P2002") {
      return reply.status(409).send({ error: { code: "CONFLICT", message: "That already exists." } });
    }
    if (prismaCode === "P2025") {
      return reply.status(404).send({ error: { code: "NOT_FOUND", message: "That wasn't found." } });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) {
      const code = status === 429 ? "RATE_LIMITED" : "BAD_REQUEST";
      const message = status === 429 ? "Too many requests. Give it a minute." : (error as Error).message;
      return reply.status(status).send({ error: { code, message } });
    }
    // Never the raw error: database errors can quote the values of the failed query.
    request.log.error({ err: safeError(error) }, "request failed");
    return reply
      .status(500)
      .send({ error: { code: "INTERNAL", message: "Something went wrong on our side." } });
  });

  // Responses hold personal data: no browser, proxy or CDN may keep a copy.
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/v1/") && !reply.hasHeader("Cache-Control")) reply.header("Cache-Control", "no-store");
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "No such endpoint." } }),
  );

  // Liveness: the process is up. Cheap, touches nothing, safe for frequent polling.
  app.get("/health", { logLevel: "silent" }, async () => ({ ok: true }));

  // Readiness: the API can reach its database. Use this for deploy checks and uptime monitors.
  app.get("/health/ready", { logLevel: "silent" }, async (_request, reply) => {
    try {
      await deps.prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: "up" };
    } catch {
      return reply.status(503).send({ ok: false, database: "down" });
    }
  });

  await app.register(
    async (v1) => {
      await v1.register(authRoutes);
      await v1.register(homeRoutes);
      await v1.register(contactRoutes);
      await v1.register(noteRoutes);
      await v1.register(prayerRoutes);
      await v1.register(userRoutes);
      await v1.register(adminRoutes);
      await v1.register(calendarRoutes);
      await v1.register(jobRoutes);
    },
    { prefix: "/v1" },
  );

  return app;
}
