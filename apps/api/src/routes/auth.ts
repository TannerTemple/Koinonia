import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  changePasswordSchema,
  loginSchema,
  registerDeviceSchema,
  registerSchema,
  updateMeSchema,
  type AuthResponse,
} from "@koinonia/shared";
import { SESSION_DAYS } from "../app";
import { hashPassword, hashToken, newToken, verifyPassword } from "../lib/crypto";
import { badRequest, conflict, forbidden, parse, tooMany, unauthorized } from "../lib/errors";
import { toUser } from "../lib/serialize";

async function createSession(prisma: PrismaClient, userId: string, now: Date): Promise<string> {
  const token = newToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      lastUsedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000),
    },
  });
  return token;
}

// Verified against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = hashPassword("not-a-real-password");

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MS = 15 * 60_000;

export async function authRoutes(app: FastifyInstance) {
  const { prisma, now } = app.deps;
  // Failed sign-ins per email, so guessing one account's password is slow no matter how many
  // IP addresses it comes from. In memory: fine for one API instance; move to the database
  // or Redis when there are several.
  const failures = new Map<string, { count: number; resetAt: number }>();
  const lockedOut = (email: string) => {
    const entry = failures.get(email);
    if (!entry) return false;
    if (entry.resetAt <= now().getTime()) {
      failures.delete(email);
      return false;
    }
    return entry.count >= MAX_FAILED_LOGINS;
  };
  const recordFailure = (email: string) => {
    if (failures.size > 50_000) failures.clear();
    const at = now().getTime();
    const entry = failures.get(email);
    if (entry && entry.resetAt > at) entry.count += 1;
    else failures.set(email, { count: 1, resetAt: at + LOCKOUT_MS });
  };
  const strict = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  app.post("/auth/register", strict, async (request, reply): Promise<AuthResponse> => {
    const input = parse(registerSchema, request.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw conflict("An account with that email already exists.", { email: "Already registered" });
    }
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        phone: input.phone,
        timezone: input.timezone ?? "UTC",
        passwordHash: await hashPassword(input.password),
        lastSeenAt: now(),
      },
    });
    reply.status(201);
    return { token: await createSession(prisma, user.id, now()), user: toUser(user) };
  });

  app.post("/auth/login", strict, async (request): Promise<AuthResponse> => {
    const input = parse(loginSchema, request.body);
    if (lockedOut(input.email)) throw tooMany("Too many sign-in attempts. Try again in 15 minutes.");
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !ok) {
      recordFailure(input.email);
      throw unauthorized("That email and password don't match.");
    }
    failures.delete(input.email);
    if (user.disabledAt) throw forbidden("This account has been disabled.");
    await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: now() } } });
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: now() } });
    return { token: await createSession(prisma, user.id, now()), user: toUser(user) };
  });

  app.post("/auth/logout", { preHandler: app.authenticate }, async (request, reply) => {
    await prisma.session.delete({ where: { id: request.auth.sessionId } });
    return reply.status(204).send();
  });

  app.get("/me", { preHandler: app.authenticate }, async (request) => toUser(request.auth.user));

  app.patch("/me", { preHandler: app.authenticate }, async (request) => {
    const input = parse(updateMeSchema, request.body);
    const user = await prisma.user.update({ where: { id: request.auth.user.id }, data: input });
    return toUser(user);
  });

  app.post("/me/password", { preHandler: app.authenticate, ...strict }, async (request, reply) => {
    const input = parse(changePasswordSchema, request.body);
    const { user, sessionId } = request.auth;
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw badRequest("Your current password isn't right.", { currentPassword: "Incorrect" });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    // Sign out everywhere else.
    await prisma.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } });
    return reply.status(204).send();
  });

  app.delete("/me", { preHandler: app.authenticate }, async (request, reply) => {
    await prisma.user.delete({ where: { id: request.auth.user.id } });
    return reply.status(204).send();
  });

  app.post("/devices", { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(registerDeviceSchema, request.body);
    await prisma.pushDevice.upsert({
      where: { token: input.token },
      create: { ...input, userId: request.auth.user.id },
      update: { userId: request.auth.user.id, platform: input.platform },
    });
    return reply.status(204).send();
  });
}
