import type { AuthTokenKind, PrismaClient, User } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerDeviceSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
  verifyEmailSchema,
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

const RESET_TTL_MS = 60 * 60_000; // 1 hour
const VERIFY_TTL_MS = 3 * 86_400_000; // 3 days
const BAD_LINK = "That link or code is invalid or has expired. Ask for a new one.";

const MAX_FAILED_LOGINS = 8;
const LOCKOUT_MS = 15 * 60_000;

export async function authRoutes(app: FastifyInstance) {
  const { prisma, now, providers, env } = app.deps;
  const webUrl = env.WEB_URL.replace(/\/+$/, "");

  /** Issues a fresh single-use token of one kind (replacing unused older ones) and emails it. */
  async function sendAuthEmail(user: User, kind: AuthTokenKind) {
    const token = newToken();
    const ttl = kind === "PASSWORD_RESET" ? RESET_TTL_MS : VERIFY_TTL_MS;
    await prisma.$transaction([
      prisma.authToken.deleteMany({ where: { userId: user.id, kind, usedAt: null } }),
      prisma.authToken.create({
        data: { userId: user.id, kind, tokenHash: hashToken(token), expiresAt: new Date(now().getTime() + ttl) },
      }),
    ]);
    const first = user.name.split(" ")[0];
    const message =
      kind === "PASSWORD_RESET"
        ? {
            subject: "Reset your Koinonia password",
            text: [
              `Hi ${first},`,
              "",
              "Someone asked to reset the password for this Koinonia account. If it was you, open this link within one hour:",
              "",
              `${webUrl}/reset-password?token=${token}`,
              "",
              "In the iPhone app, choose \"I have a reset code\" and paste this code:",
              "",
              token,
              "",
              "If it wasn't you, ignore this email. Your password stays the same.",
            ].join("\n"),
          }
        : {
            subject: "Confirm your email for Koinonia",
            text: [
              `Hi ${first},`,
              "",
              "Confirm this is your email address by opening this link:",
              "",
              `${webUrl}/verify-email?token=${token}`,
              "",
              "In the iPhone app, go to Profile, choose \"Enter code\" and paste this code:",
              "",
              token,
              "",
              "The link works once and expires in three days.",
            ].join("\n"),
          };
    await providers.email.send({ to: user.email, ...message });
  }
  /** Email problems must never fail (or slow) the request that triggered them. */
  const sendInBackground = (user: User, kind: AuthTokenKind) => {
    const done = sendAuthEmail(user, kind).catch((err) => app.log.error(err, "auth email failed"));
    pending.add(done);
    void done.finally(() => pending.delete(done));
  };
  const pending = new Set<Promise<unknown>>();
  app.addHook("onClose", async () => {
    await Promise.allSettled([...pending]);
  });

  /** Atomically spends a token: valid only if unused and unexpired, and never twice. */
  async function consumeToken(token: string, kind: AuthTokenKind) {
    const tokenHash = hashToken(token);
    const { count } = await prisma.authToken.updateMany({
      where: { tokenHash, kind, usedAt: null, expiresAt: { gt: now() } },
      data: { usedAt: now() },
    });
    if (!count) throw badRequest(BAD_LINK, { token: "Invalid or expired" });
    return prisma.authToken.findUniqueOrThrow({ where: { tokenHash }, include: { user: true } });
  }

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
    sendInBackground(user, "EMAIL_VERIFY");
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

  /**
   * Always answers 204, whether or not the email has an account, so it can't be used to
   * find out who is registered. The email (if any) is sent after the response.
   */
  app.post("/auth/forgot-password", strict, async (request, reply) => {
    const input = parse(forgotPasswordSchema, request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (user && !user.disabledAt) sendInBackground(user, "PASSWORD_RESET");
    return reply.status(204).send();
  });

  app.post("/auth/reset-password", strict, async (request, reply) => {
    const input = parse(resetPasswordSchema, request.body);
    const { user } = await consumeToken(input.token, "PASSWORD_RESET");
    if (user.disabledAt) throw badRequest(BAD_LINK, { token: "Invalid or expired" });
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // Using an emailed link also proves the address is theirs.
        data: { passwordHash: await hashPassword(input.password), emailVerifiedAt: user.emailVerifiedAt ?? now() },
      }),
      // Whoever knew the old password is signed out everywhere.
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.authToken.deleteMany({ where: { userId: user.id, kind: "PASSWORD_RESET", usedAt: null } }),
    ]);
    failures.delete(user.email);
    return reply.status(204).send();
  });

  app.post("/auth/verify-email", strict, async (request, reply) => {
    const input = parse(verifyEmailSchema, request.body);
    const { user } = await consumeToken(input.token, "EMAIL_VERIFY");
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? now() } });
    return reply.status(204).send();
  });

  app.post("/auth/resend-verification", { preHandler: app.authenticate, ...strict }, async (request, reply) => {
    if (!request.auth.user.emailVerifiedAt) sendInBackground(request.auth.user, "EMAIL_VERIFY");
    return reply.status(204).send();
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
