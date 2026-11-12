import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { PrismaClient, User } from "@prisma/client";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { dayInTimezone } from "@koinonia/shared";
import type { Env } from "./env";
import { hashToken } from "./lib/crypto";
import { forbidden, HttpError, unauthorized } from "./lib/errors";
import type { Providers } from "./providers";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { calendarRoutes } from "./routes/calendar";
import { contactRoutes } from "./routes/contacts";
import { homeRoutes } from "./routes/home";
import { noteRoutes } from "./routes/notes";
import { prayerRoutes } from "./routes/prayer";
import { userRoutes } from "./routes/users";

export const SESSION_DAYS = 30;
const DAY_MS = 86_400_000;

export interface AppDeps {
  prisma: PrismaClient;
  providers: Providers;
  env: Env;
  /** Injectable clock so tests can move time. */
  now?: () => Date;
  logger?: boolean;
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
    authenticate: (request: FastifyRequest) => Promise<void>;
    requireAdmin: (request: FastifyRequest) => Promise<void>;
  }
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const now = deps.now ?? (() => new Date());
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: deps.env.TRUST_PROXY });
  app.decorate("deps", { prisma: deps.prisma, providers: deps.providers, env: deps.env, now });
  app.decorateRequest("auth", null as unknown as AuthContext);

  await app.register(helmet);
  await app.register(cors, {
    origin: deps.env.CORS_ORIGINS.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  });
  if (deps.rateLimit ?? true) {
    await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  }

  app.decorate("authenticate", async (request: FastifyRequest) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) throw unauthorized();

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
    }

    request.auth = {
      user: session.user,
      sessionId: session.id,
      today: dayInTimezone(at, session.user.timezone),
    };
  });

  app.decorate("requireAdmin", async (request: FastifyRequest) => {
    await app.authenticate(request);
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
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: { code: "INTERNAL", message: "Something went wrong on our side." } });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: "NOT_FOUND", message: "No such endpoint." } }),
  );

  app.get("/health", async () => ({ ok: true }));

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
    },
    { prefix: "/v1" },
  );

  return app;
}
