import type { PrismaClient, User } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { BRAND, SIGN_IN_PROVIDERS, SIGN_IN_PROVIDER_LABELS, oauthExchangeSchema, type AuthResponse, type SignInProvider } from "@koinonia/shared";
import { hashPassword, hashToken, newToken } from "../lib/crypto";
import { parse, unauthorized } from "../lib/errors";
import { safeError } from "../lib/log";
import { randomUrlSafe, pkce, type IdClaims } from "../lib/oidc";
import { toUser } from "../lib/serialize";
import { callbackBase, createSignInProviders, mockCode } from "../signin/providers";
import { createSession } from "./auth";
import { sessionCookie } from "../app";

const ATTEMPT_MS = 10 * 60_000;
const BROWSER_COOKIE = "koinonia_oauth";
const HANDOFF_MS = 2 * 60_000;

type Outcome = { user: User; created: boolean } | { error: "email_unverified" | "no_email" | "link_unconfirmed" | "disabled" };

/**
 * Who this provider account is, here. In order:
 *  1. Already linked (same provider, same permanent id): that account.
 *  2. The provider vouches for the email, and an account with that email exists whose email
 *     was confirmed: link and sign in. (If that account's email was never confirmed, someone
 *     else may have typed it at sign-up, so it is not handed over.)
 *  3. The provider vouches for the email and nobody has it: a new account.
 * An email the provider does not vouch for is never used.
 */
export async function resolveIdentity(prisma: PrismaClient, p: { provider: SignInProvider; claims: IdClaims; emailVerified: boolean; name?: string; timezone?: string | null; now: Date }): Promise<Outcome> {
  const linked = await prisma.identity.findUnique({ where: { provider_subject: { provider: p.provider, subject: p.claims.sub } }, include: { user: true } });
  if (linked) {
    if (linked.user.disabledAt) return { error: "disabled" };
    await prisma.identity.update({ where: { id: linked.id }, data: { lastUsedAt: p.now } });
    return { user: linked.user, created: false };
  }

  const email = p.claims.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "no_email" };
  if (!p.emailVerified) return { error: "email_unverified" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.disabledAt) return { error: "disabled" };
    if (!existing.emailVerifiedAt) return { error: "link_unconfirmed" };
    await prisma.identity.create({ data: { userId: existing.id, provider: p.provider, subject: p.claims.sub, email, createdAt: p.now, lastUsedAt: p.now } });
    return { user: existing, created: false };
  }

  const name = (p.name || p.claims.name || [p.claims.given_name, p.claims.family_name].filter(Boolean).join(" ") || email.split("@")[0]!).trim().slice(0, 80);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        timezone: p.timezone || "UTC",
        // Nobody knows this password; "Forgot password" or Settings can set a real one.
        passwordHash: await hashPassword(randomUrlSafe(32)),
        passwordSet: false,
        emailVerifiedAt: p.now,
        lastSeenAt: p.now,
        identities: { create: { provider: p.provider, subject: p.claims.sub, email, createdAt: p.now, lastUsedAt: p.now } },
      },
    });
    return { user, created: true };
  } catch (err) {
    // Two tabs finishing at once: the other one made the account; use it.
    if ((err as { code?: string }).code === "P2002") return resolveIdentity(prisma, p);
    throw err;
  }
}

export async function oauthRoutes(app: FastifyInstance) {
  const { prisma, env, now } = app.deps;
  const adapters = createSignInProviders(env, { fetch: app.deps.fetch, now });
  const base = callbackBase(env);
  const webUrl = env.WEB_URL.replace(/\/+$/, "");
  const secure = env.NODE_ENV === "production";
  const redirectUri = (provider: SignInProvider) => `${base}/v1/auth/oauth/${provider}/callback`;
  const providerOf = (value: string): SignInProvider | null => (SIGN_IN_PROVIDERS as readonly string[]).includes(value) ? (value as SignInProvider) : null;

  // Apple posts the result back as a form.
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string", bodyLimit: 16 * 1024 }, (_request, body, done) => {
    done(null, Object.fromEntries(new URLSearchParams(body as string)));
  });

  const browserCookie = (value: string | null) =>
    [
      `${BROWSER_COOKIE}=${value ?? ""}`,
      "Path=/",
      "HttpOnly",
      // Apple comes back with a cross-site form post, which a Lax cookie would not join.
      secure ? "SameSite=None" : "SameSite=Lax",
      `Max-Age=${value ? ATTEMPT_MS / 1000 : 0}`,
      ...(secure ? ["Secure"] : []),
    ].join("; ");
  const readCookie = (request: FastifyRequest) => {
    for (const part of (request.headers.cookie ?? "").split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === BROWSER_COOKIE) return rest.join("=");
    }
    return null;
  };

  /** Back to the app that started it, with either a success or a reason. */
  const finish = (reply: FastifyReply, client: string, provider: string, params: Record<string, string>) => {
    reply.header("Set-Cookie", browserCookie(null));
    reply.header("Cache-Control", "no-store");
    reply.header("Referrer-Policy", "no-referrer");
    const qs = new URLSearchParams({ method: provider, ...params });
    if (client === "app") return reply.redirect(`${BRAND.urlScheme}://auth?${qs}`, 302);
    return reply.redirect(params.error ? `${webUrl}/login?${qs}` : `${webUrl}/signed-in?${qs}`, 302);
  };

  const limited = { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } };

  app.get<{ Params: { provider: string }; Querystring: { client?: string; tz?: string } }>("/auth/oauth/:provider/start", limited, async (request, reply) => {
    const provider = providerOf(request.params.provider);
    const adapter = provider ? adapters.get(provider) : undefined;
    if (!provider || !adapter) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "That way of signing in is not switched on." } });
    const client = request.query.client === "app" ? "app" : "web";
    const tz = request.query.tz && /^[A-Za-z_+\-/0-9]{1,64}$/.test(request.query.tz) ? request.query.tz : null;

    const state = randomUrlSafe(24);
    const browser = randomUrlSafe(24);
    const nonce = randomUrlSafe(24);
    const { verifier, challenge } = pkce();
    await prisma.oAuthState.deleteMany({ where: { expiresAt: { lte: now() } } });
    await prisma.oAuthState.create({
      data: { stateHash: hashToken(state), browserHash: hashToken(browser), provider, client, codeVerifier: verifier, nonce, timezone: tz, createdAt: now(), expiresAt: new Date(now().getTime() + ATTEMPT_MS) },
    });
    reply.header("Set-Cookie", browserCookie(browser));
    reply.header("Cache-Control", "no-store");
    return reply.redirect(adapter.authorizeUrl({ redirectUri: redirectUri(provider), state, nonce, challenge }), 302);
  });

  const callback = async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    const input = { ...(request.query as Record<string, string>), ...((request.body as Record<string, string> | undefined) ?? {}) };
    const provider = providerOf(request.params.provider);
    const adapter = provider ? adapters.get(provider) : undefined;
    const attempt = input.state ? await prisma.oAuthState.findUnique({ where: { stateHash: hashToken(String(input.state)) } }) : null;
    const client = attempt?.client ?? "web";
    const label = request.params.provider;
    if (!provider || !adapter || !attempt || attempt.provider !== provider) return finish(reply, client, label, { error: "expired" });

    // One use, not expired, and in the browser that started it.
    const cookie = readCookie(request);
    const claimed = await prisma.oAuthState.updateMany({ where: { id: attempt.id, usedAt: null, expiresAt: { gt: now() } }, data: { usedAt: now() } });
    if (claimed.count !== 1 || !cookie || hashToken(cookie) !== attempt.browserHash) return finish(reply, client, provider, { error: "expired" });
    if (input.error) return finish(reply, client, provider, { error: input.error === "access_denied" || input.error === "user_cancelled_authorize" ? "cancelled" : "failed" });
    if (!input.code || typeof input.code !== "string") return finish(reply, client, provider, { error: "failed" });

    let outcome: Outcome;
    try {
      const claims = await adapter.claims({ code: input.code, redirectUri: redirectUri(provider), verifier: attempt.codeVerifier, nonce: attempt.nonce });
      // Apple sends the person's name once, the first time, beside the token.
      let name: string | undefined;
      if (provider === "apple" && typeof input.user === "string") {
        try {
          const n = (JSON.parse(input.user) as { name?: { firstName?: string; lastName?: string } }).name;
          name = [n?.firstName, n?.lastName].filter(Boolean).join(" ") || undefined;
        } catch {
          /* no name, then */
        }
      }
      outcome = await resolveIdentity(prisma, { provider, claims, emailVerified: adapter.emailVerified(claims), name, timezone: attempt.timezone, now: now() });
    } catch (err) {
      request.log.warn({ err: safeError(err), provider }, "outside sign-in failed");
      return finish(reply, client, provider, { error: "failed" });
    }
    if ("error" in outcome) {
      request.log.info({ provider, reason: outcome.error }, "outside sign-in refused");
      return finish(reply, client, provider, { error: outcome.error });
    }

    await prisma.user.update({ where: { id: outcome.user.id }, data: { lastSeenAt: now() } });
    request.log.info({ provider, created: outcome.created }, "outside sign-in");
    const created: Record<string, string> = outcome.created ? { new: "1" } : {};
    if (client === "app") {
      // The phone gets a one-time code through its link, and trades it for a session.
      const handoff = newToken();
      await prisma.oAuthState.update({ where: { id: attempt.id }, data: { handoffHash: hashToken(handoff), userId: outcome.user.id, expiresAt: new Date(now().getTime() + HANDOFF_MS) } });
      return finish(reply, client, provider, { code: handoff, ...created });
    }
    const token = await createSession(prisma, outcome.user.id, now());
    finish(reply, client, provider, created);
    // Two cookies: the session, and clearing the attempt's.
    reply.header("Set-Cookie", [browserCookie(null), sessionCookie(env, token)]);
    return reply;
  };

  app.get("/auth/oauth/:provider/callback", limited, callback);
  app.post("/auth/oauth/:provider/callback", limited, callback);

  // The phone app trades its one-time code for a session token.
  app.post("/auth/oauth/exchange", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request): Promise<AuthResponse> => {
    const { code } = parse(oauthExchangeSchema, request.body);
    const found = await prisma.oAuthState.findUnique({ where: { handoffHash: hashToken(code) } });
    if (!found?.userId || found.expiresAt <= now()) throw unauthorized("That sign-in has expired. Please try again.");
    // Once only.
    const taken = await prisma.oAuthState.deleteMany({ where: { id: found.id, handoffHash: found.handoffHash } });
    const user = await prisma.user.findUnique({ where: { id: found.userId } });
    if (taken.count !== 1 || !user || user.disabledAt) throw unauthorized("That sign-in has expired. Please try again.");
    return { token: await createSession(prisma, user.id, now()), user: toUser(user) };
  });

  // ---- Pretend provider, for trying the flow locally (OAUTH_MOCK=true, never in production) ----
  if (env.OAUTH_MOCK && env.NODE_ENV !== "production") {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    app.get<{ Querystring: Record<string, string> }>("/auth/oauth/mock/authorize", async (request, reply) => {
      const q = request.query;
      const provider = providerOf(q.provider ?? "");
      if (!provider || !q.redirect_uri?.startsWith(base) || !q.state || !q.nonce) return reply.code(400).send("bad request");
      const label = SIGN_IN_PROVIDER_LABELS[provider];
      reply.header("Content-Type", "text/html; charset=utf-8").header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
      return `<!doctype html><meta name="viewport" content="width=device-width"><title>Pretend ${label}</title>
<body style="font:18px system-ui;max-width:28rem;margin:2rem auto;padding:0 1rem">
<h1>Pretend ${label}</h1><p>This page stands in for ${label} while trying ${esc(BRAND.name)} locally. It is never available in production.</p>
<form method="get" action="${esc(base)}/v1/auth/oauth/mock/approve">
<input type="hidden" name="provider" value="${provider}"><input type="hidden" name="redirect_uri" value="${esc(q.redirect_uri)}">
<input type="hidden" name="state" value="${esc(q.state)}"><input type="hidden" name="nonce" value="${esc(q.nonce)}">
<p><label>Email<br><input name="email" type="email" required style="font:inherit;width:100%"></label></p>
<p><label>Name<br><input name="name" style="font:inherit;width:100%"></label></p>
<p><label>Account id at ${label}<br><input name="sub" placeholder="leave empty to use the email" style="font:inherit;width:100%"></label></p>
<p><label><input type="checkbox" name="verified" value="1" checked> ${label} has confirmed this email</label></p>
<p><button style="font:inherit;padding:.5rem 1rem">Continue</button> <button name="cancel" value="1" formnovalidate style="font:inherit;padding:.5rem 1rem">Cancel</button></p>
</form></body>`;
    });
    app.get<{ Querystring: Record<string, string> }>("/auth/oauth/mock/approve", async (request, reply) => {
      const q = request.query;
      if (!q.redirect_uri?.startsWith(base)) return reply.code(400).send("bad request");
      const back = new URL(q.redirect_uri);
      back.searchParams.set("state", q.state ?? "");
      if (q.cancel) back.searchParams.set("error", "access_denied");
      else back.searchParams.set("code", mockCode({ sub: q.sub || `mock-${q.email}`, email: q.email, email_verified: q.verified === "1", name: q.name || undefined, nonce: q.nonce }));
      return reply.redirect(back.toString(), 302);
    });
  }
}
