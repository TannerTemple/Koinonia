import type { AuthTokenKind, PrismaClient, User } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  registerDeviceSchema,
  registerSchema,
  resetPasswordSchema,
  updateMeSchema,
  verifyEmailSchema,
  type AuthResponse,
} from "@koinonia/shared";
import { CLIENT_HEADER, SESSION_DAYS, sessionCookie } from "../app";
import { hashPassword, hashToken, needsRehash, newToken, verifyPassword } from "../lib/crypto";
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
  // IP addresses it comes from. Kept in the database so every API instance sees the same count.
  const lockedOut = async (email: string) => {
    const entry = await prisma.loginThrottle.findUnique({ where: { email } });
    return Boolean(entry && entry.resetAt > now() && entry.count >= MAX_FAILED_LOGINS);
  };
  const recordFailure = async (email: string) => {
    const at = now();
    const fresh = { count: 1, resetAt: new Date(at.getTime() + LOCKOUT_MS) };
    const { count } = await prisma.loginThrottle.updateMany({
      where: { email, resetAt: { gt: at } },
      data: { count: { increment: 1 } },
    });
    if (!count) await prisma.loginThrottle.upsert({ where: { email }, create: { email, ...fresh }, update: fresh });
    // Housekeeping: forget lockouts that ended.
    await prisma.loginThrottle.deleteMany({ where: { resetAt: { lte: at } } });
  };
  const clearFailures = (email: string) => prisma.loginThrottle.deleteMany({ where: { email } });

  /** Signs the caller in: the web app gets an httpOnly cookie, the iOS app gets the token. */
  async function startSession(request: FastifyRequest, reply: FastifyReply, user: User): Promise<AuthResponse> {
    const token = await createSession(prisma, user.id, now());
    if (request.headers[CLIENT_HEADER] === "web") {
      reply.header("Set-Cookie", sessionCookie(env, token));
      return { token: "", user: toUser(user) };
    }
    return { token, user: toUser(user) };
  }

  const strict = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
  // Sign-up says when an email is taken (it has to, to sign the new user straight in), so
  // it gets a much tighter limit than sign-in to make checking many addresses impractical.
  const signUpLimit = { config: { rateLimit: { max: 5, timeWindow: "10 minutes" } } };

  app.post("/auth/register", signUpLimit, async (request, reply): Promise<AuthResponse> => {
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
    return startSession(request, reply, user);
  });

  app.post("/auth/login", strict, async (request, reply): Promise<AuthResponse> => {
    const input = parse(loginSchema, request.body);
    if (await lockedOut(input.email)) throw tooMany("Too many sign-in attempts. Try again in 15 minutes.");
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    const ok = await verifyPassword(input.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !ok) {
      await recordFailure(input.email);
      throw unauthorized("That email and password don't match.");
    }
    await clearFailures(input.email);
    if (user.disabledAt) throw forbidden("This account has been disabled.");
    await prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lte: now() } } });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastSeenAt: now(),
        // Hashes made with an older, cheaper cost are upgraded while we have the password.
        ...(needsRehash(user.passwordHash) ? { passwordHash: await hashPassword(input.password) } : {}),
      },
    });
    return startSession(request, reply, user);
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
    await clearFailures(user.email);
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
    const input = parse(logoutSchema, request.body);
    await prisma.session.deleteMany({ where: { id: request.auth.sessionId } });
    // A signed-out phone must stop getting this account's push notifications.
    if (input.pushToken) {
      await prisma.pushDevice.deleteMany({ where: { userId: request.auth.user.id, token: input.pushToken } });
    }
    reply.header("Set-Cookie", sessionCookie(env, null));
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

  app.delete("/me", { preHandler: app.authenticate, ...strict }, async (request, reply) => {
    const input = parse(deleteAccountSchema, request.body);
    if (!(await verifyPassword(input.password, request.auth.user.passwordHash))) {
      throw badRequest("That password isn't right.", { password: "Incorrect" });
    }
    await prisma.user.delete({ where: { id: request.auth.user.id } });
    reply.header("Set-Cookie", sessionCookie(env, null));
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
