import { createHash, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { loadEnv } from "../src/env";
import { MICROSOFT_CONSUMER_TENANT } from "../src/signin/providers";
import { createMockProviders } from "../src/providers";
import { prisma, resetDb, signUp } from "./helpers";

/**
 * Sign in with Google, Microsoft and Apple, against fake providers that do what the real
 * ones do: publish keys, check PKCE at the token endpoint, and sign real ID tokens.
 */

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherRsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ec = generateKeyPairSync("ec", { namedCurve: "P-256" }); // the provider's signing key (Apple signs with ES256)
const appleClientKey = generateKeyPairSync("ec", { namedCurve: "P-256" }); // the .p8 key Apple gives you

const b64 = (v: unknown) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
function jwt(claims: Record<string, unknown>, key: KeyObject, alg: "RS256" | "ES256", kid: string) {
  const input = `${b64({ alg, kid, typ: "JWT" })}.${b64(claims)}`;
  const sig = alg === "RS256" ? sign("RSA-SHA256", Buffer.from(input), key) : sign("SHA256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `${input}.${sig.toString("base64url")}`;
}
const jwk = (key: KeyObject, kid: string, alg: string) => ({ ...createPublicKey(key).export({ format: "jwk" }), kid, alg, use: "sig" });

/** What the next ID token will say; tests change it before finishing a sign-in. */
let next: { claims: Record<string, unknown>; signWith?: "other" };
const seen: { url: string; body: URLSearchParams }[] = [];

const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (url === "https://www.googleapis.com/oauth2/v3/certs" || url === "https://login.microsoftonline.com/common/discovery/v2.0/keys") return json({ keys: [jwk(rsa.privateKey, "rsa1", "RS256")] });
  if (url === "https://appleid.apple.com/auth/keys") return json({ keys: [jwk(ec.privateKey, "ec1", "ES256")] });
  const body = new URLSearchParams(String(init?.body ?? ""));
  seen.push({ url, body });
  const issued = { exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000), ...next.claims };
  // PKCE: the verifier must hash to the challenge sent at the start.
  const challenge = createHash("sha256").update(body.get("code_verifier") ?? "").digest("base64url");
  if (challenge !== pending.challenge) return json({ error: "invalid_grant" }, 400);
  if (url === "https://oauth2.googleapis.com/token") return json({ id_token: jwt({ ...issued, iss: "https://accounts.google.com", aud: "google-client", nonce: pending.nonce, ...next.claims }, next.signWith === "other" ? otherRsa.privateKey : rsa.privateKey, "RS256", "rsa1") });
  if (url === "https://login.microsoftonline.com/common/oauth2/v2.0/token") {
    const tid = (next.claims.tid as string) ?? MICROSOFT_CONSUMER_TENANT;
    return json({ id_token: jwt({ ...issued, iss: `https://login.microsoftonline.com/${tid}/v2.0`, aud: "ms-client", tid, nonce: pending.nonce, ...next.claims }, rsa.privateKey, "RS256", "rsa1") });
  }
  if (url === "https://appleid.apple.com/auth/token") {
    // Apple checks the client secret: a JWT signed with the key you downloaded from Apple.
    const [h, p, s] = (body.get("client_secret") ?? "..").split(".");
    const ok = verify("SHA256", Buffer.from(`${h}.${p}`), { key: appleClientKey.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s ?? "", "base64url"));
    const secret = JSON.parse(Buffer.from(p ?? "", "base64url").toString() || "{}");
    if (!ok || secret.iss !== "TEAM123" || secret.sub !== "app.koinonia.web" || secret.aud !== "https://appleid.apple.com") return json({ error: "invalid_client" }, 400);
    return json({ id_token: jwt({ ...issued, iss: "https://appleid.apple.com", aud: "app.koinonia.web", nonce: pending.nonce, ...next.claims }, ec.privateKey, "ES256", "ec1") });
  }
  return json({ error: "unexpected" }, 404);
}) as typeof fetch;

const env = loadEnv({
  ...process.env,
  SIGNIN_PROVIDERS: "google,microsoft,apple",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  MICROSOFT_CLIENT_ID: "ms-client",
  MICROSOFT_CLIENT_SECRET: "ms-secret",
  APPLE_CLIENT_ID: "app.koinonia.web",
  APPLE_TEAM_ID: "TEAM123",
  APPLE_KEY_ID: "KEY123",
  APPLE_PRIVATE_KEY: appleClientKey.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
});
let app: Awaited<ReturnType<typeof buildApp>>;
let pending: { state: string; nonce: string; challenge: string; cookie: string };

beforeAll(async () => {
  app = await buildApp({ prisma, providers: createMockProviders(), env, rateLimit: false, fetch: fakeFetch });
});
beforeEach(async () => {
  await resetDb();
  seen.length = 0;
  next = { claims: {} };
});
afterAll(async () => {
  await app.close();
});

/** Step 1: the button. Returns where the browser is sent. */
async function start(provider: string, client = "web") {
  const res = await app.inject({ url: `/v1/auth/oauth/${provider}/start?client=${client}&tz=America/Chicago` });
  expect(res.statusCode).toBe(302);
  const to = new URL(res.headers.location as string);
  const cookie = String(res.headers["set-cookie"]).match(/koinonia_oauth=([^;]+)/)![1]!;
  pending = { state: to.searchParams.get("state")!, nonce: to.searchParams.get("nonce")!, challenge: to.searchParams.get("code_challenge")!, cookie };
  return to;
}

/** Step 2: the provider sends the browser back. */
async function back(provider: string, opts: { method?: "GET" | "POST"; cookie?: string | null; state?: string; extra?: Record<string, string> } = {}) {
  const params = { state: opts.state ?? pending.state, code: "the-code", ...opts.extra };
  const cookie = opts.cookie === null ? undefined : `koinonia_oauth=${opts.cookie ?? pending.cookie}`;
  const res =
    opts.method === "POST"
      ? await app.inject({ method: "POST", url: `/v1/auth/oauth/${provider}/callback`, payload: new URLSearchParams(params).toString(), headers: { "content-type": "application/x-www-form-urlencoded", ...(cookie ? { cookie } : {}) } })
      : await app.inject({ url: `/v1/auth/oauth/${provider}/callback?${new URLSearchParams(params)}`, headers: cookie ? { cookie } : {} });
  expect(res.statusCode).toBe(302);
  const location = new URL(res.headers.location as string);
  const cookies = ([] as string[]).concat(res.headers["set-cookie"] ?? []);
  const session = cookies.join(";").match(/koinonia_session=([^;]+)/)?.[1];
  return { location, session, params: Object.fromEntries(location.searchParams) };
}

const me = (session: string) => app.inject({ url: "/v1/me", cookies: { koinonia_session: session }, headers: { "x-koinonia-client": "web" } });

describe("starting a sign-in", () => {
  it("sends the browser to the provider with PKCE, a state and a nonce, and remembers the browser", async () => {
    const to = await start("google");
    expect(to.origin + to.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(to.searchParams)).toMatchObject({ client_id: "google-client", response_type: "code", scope: "openid email profile", code_challenge_method: "S256", redirect_uri: "http://localhost:4000/v1/auth/oauth/google/callback" });
    expect(pending.state.length).toBeGreaterThan(20);
    const stored = await prisma.oAuthState.findMany();
    expect(stored).toHaveLength(1);
    // Only hashes of the secrets are kept.
    expect(JSON.stringify(stored)).not.toContain(pending.state);
    expect(JSON.stringify(stored)).not.toContain(pending.cookie);
  });

  it("asks Apple to post back, and Microsoft for any kind of account", async () => {
    expect((await start("apple")).searchParams.get("response_mode")).toBe("form_post");
    expect((await start("microsoft")).pathname).toBe("/common/oauth2/v2.0/authorize");
  });

  it("does not exist for a provider that is not switched on", async () => {
    const off = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv({ ...process.env, SIGNIN_PROVIDERS: "google", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" }), rateLimit: false });
    expect((await off.inject({ url: "/v1/auth/oauth/apple/start" })).statusCode).toBe(404);
    expect((await off.inject({ url: "/v1/config" })).json().signIn.providers).toEqual(["google"]);
    await off.close();
    const none = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv(process.env), rateLimit: false });
    expect((await none.inject({ url: "/v1/auth/oauth/google/start" })).statusCode).toBe(404);
    expect((await none.inject({ url: "/v1/config" })).json().signIn.providers).toEqual([]);
    await none.close();
  });
});

describe("coming back from the provider", () => {
  it("makes a new account from a verified Google email and signs the browser in", async () => {
    await start("google");
    next.claims = { sub: "g-111", email: "Pat@Example.com", email_verified: true, name: "Pat Walker" };
    const { location, session, params } = await back("google");
    expect(location.origin + location.pathname).toBe("http://localhost:3000/signed-in");
    expect(params).toEqual({ method: "google", new: "1" });
    expect(session).toBeTruthy();
    const user = (await me(session!)).json();
    expect(user).toMatchObject({ email: "pat@example.com", name: "Pat Walker", emailVerified: true, hasPassword: false, timezone: "America/Chicago" });
    expect(await prisma.identity.findMany()).toEqual([expect.objectContaining({ provider: "google", subject: "g-111", email: "pat@example.com" })]);
    // The token request carried the PKCE verifier and the secret.
    expect(seen[0]!.body.get("client_secret")).toBe("google-secret");
  });

  it("signs the same person into the same account next time, by the provider's id, not the email", async () => {
    await start("google");
    next.claims = { sub: "g-111", email: "pat@example.com", email_verified: true };
    const first = await back("google");
    await start("google");
    // Their Google email changed; the permanent id did not.
    next.claims = { sub: "g-111", email: "pat.new@example.com", email_verified: true };
    const second = await back("google");
    expect(second.params).toEqual({ method: "google" });
    expect((await me(second.session!)).json().id).toBe((await me(first.session!)).json().id);
    expect(await prisma.user.count()).toBe(1);
  });

  it("links to an existing account only when that account's email was confirmed", async () => {
    const existing = await signUp(app, { name: "Maria", email: "maria@example.com" });
    await start("google");
    next.claims = { sub: "g-222", email: "maria@example.com", email_verified: true };
    expect((await back("google")).params).toEqual({ method: "google", error: "link_unconfirmed" });
    expect(await prisma.identity.count()).toBe(0);

    await prisma.user.update({ where: { id: existing.userId }, data: { emailVerifiedAt: new Date() } });
    await start("google");
    const linked = await back("google");
    expect(linked.params).toEqual({ method: "google" });
    expect((await me(linked.session!)).json()).toMatchObject({ id: existing.userId, hasPassword: true });
  });

  it("never uses an email the provider has not verified", async () => {
    await signUp(app, { email: "victim@example.com" });
    await prisma.user.updateMany({ data: { emailVerifiedAt: new Date() } });
    await start("google");
    next.claims = { sub: "g-333", email: "victim@example.com", email_verified: false };
    expect((await back("google")).params).toEqual({ method: "google", error: "email_unverified" });
    await start("google");
    next.claims = { sub: "g-444", email: "someone.new@example.com", email_verified: false };
    expect((await back("google")).params.error).toBe("email_unverified");
    expect(await prisma.identity.count()).toBe(0);
  });

  it("trusts Microsoft emails only from personal accounts or a directory that proved the domain", async () => {
    await start("microsoft");
    next.claims = { sub: "m-1", email: "boss@contoso.com", tid: "72f988bf-86f1-41af-91ab-2d7cd011db47" };
    expect((await back("microsoft")).params.error).toBe("email_unverified");

    await start("microsoft");
    next.claims = { sub: "m-2", email: "boss@contoso.com", tid: "72f988bf-86f1-41af-91ab-2d7cd011db47", xms_edov: true };
    expect((await back("microsoft")).params).toEqual({ method: "microsoft", new: "1" });

    await start("microsoft");
    next.claims = { sub: "m-3", email: "pat@outlook.com", tid: MICROSOFT_CONSUMER_TENANT };
    expect((await back("microsoft")).params).toEqual({ method: "microsoft", new: "1" });
  });

  it("refuses a Microsoft token whose issuer is not the directory it claims", async () => {
    await start("microsoft");
    next.claims = { sub: "m-4", email: "pat@outlook.com", tid: MICROSOFT_CONSUMER_TENANT, iss: "https://login.microsoftonline.com/someone-else/v2.0" };
    expect((await back("microsoft")).params.error).toBe("failed");
  });

  it("handles Apple's form post, its signed client secret and the name it sends only once", async () => {
    await start("apple");
    next.claims = { sub: "001234.abcd", email: "x7k2@privaterelay.appleid.com", email_verified: "true" };
    const { params, session } = await back("apple", { method: "POST", extra: { user: JSON.stringify({ name: { firstName: "Ana", lastName: "Reyes" }, email: "x7k2@privaterelay.appleid.com" }) } });
    expect(params).toEqual({ method: "apple", new: "1" });
    expect((await me(session!)).json()).toMatchObject({ name: "Ana Reyes", email: "x7k2@privaterelay.appleid.com" });
  });

  it("asks for an email if the provider sent none", async () => {
    await start("apple");
    next.claims = { sub: "001234.efgh", email_verified: "true" };
    expect((await back("apple", { method: "POST" })).params.error).toBe("no_email");
  });

  it("says 'cancelled' when the person backs out at the provider", async () => {
    await start("google");
    expect((await back("google", { extra: { error: "access_denied", code: "" } })).params).toEqual({ method: "google", error: "cancelled" });
  });

  it("refuses a disabled account", async () => {
    await start("google");
    next.claims = { sub: "g-555", email: "pat@example.com", email_verified: true };
    await back("google");
    await prisma.user.updateMany({ data: { disabledAt: new Date() } });
    await start("google");
    expect((await back("google")).params.error).toBe("disabled");
  });
});

describe("what cannot be faked", () => {
  it("finishes only in the browser that started it", async () => {
    await start("google");
    next.claims = { sub: "g-1", email: "pat@example.com", email_verified: true };
    expect((await back("google", { cookie: "someone-elses-browser" })).params.error).toBe("expired");
    await start("google");
    expect((await back("google", { cookie: null })).params.error).toBe("expired");
    expect(await prisma.user.count()).toBe(0);
  });

  it("uses each attempt once", async () => {
    await start("google");
    next.claims = { sub: "g-1", email: "pat@example.com", email_verified: true };
    expect((await back("google")).session).toBeTruthy();
    expect((await back("google")).params.error).toBe("expired");
  });

  it("refuses an unknown state, or one started with a different provider", async () => {
    await start("google");
    expect((await back("google", { state: "made-up" })).params.error).toBe("expired");
    expect((await back("microsoft")).params.error).toBe("expired");
  });

  it("expires an attempt after ten minutes", async () => {
    await start("google");
    await prisma.oAuthState.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    next.claims = { sub: "g-1", email: "pat@example.com", email_verified: true };
    expect((await back("google")).params.error).toBe("expired");
  });

  it("refuses a token not signed by the provider, made for another app, or for another sign-in", async () => {
    for (const [claims, signWith] of [
      [{ sub: "g-1", email: "pat@example.com", email_verified: true }, "other"],
      [{ sub: "g-1", email: "pat@example.com", email_verified: true, aud: "someone-elses-app" }, undefined],
      [{ sub: "g-1", email: "pat@example.com", email_verified: true, nonce: "a-different-nonce" }, undefined],
      [{ sub: "g-1", email: "pat@example.com", email_verified: true, exp: Math.floor(Date.now() / 1000) - 3600 }, undefined],
      [{ sub: "g-1", email: "pat@example.com", email_verified: true, iss: "https://evil.example" }, undefined],
    ] as const) {
      await start("google");
      next = { claims: { ...claims }, signWith };
      expect((await back("google")).params.error).toBe("failed");
    }
    expect(await prisma.user.count()).toBe(0);
  });
});

describe("the phone app", () => {
  it("gets a one-time code through its link and trades it for a session, once", async () => {
    await start("google", "app");
    next.claims = { sub: "g-9", email: "pat@example.com", email_verified: true };
    const { location, session, params } = await back("google");
    expect(location.protocol).toBe("koinonia:");
    expect(location.host).toBe("auth");
    expect(session).toBeUndefined(); // no cookie for the phone
    expect(params).toMatchObject({ method: "google", new: "1" });

    const traded = await app.inject({ method: "POST", url: "/v1/auth/oauth/exchange", payload: { code: params.code } });
    expect(traded.statusCode).toBe(200);
    expect(traded.json()).toMatchObject({ user: { email: "pat@example.com" } });
    const token = traded.json().token as string;
    expect((await app.inject({ url: "/v1/home", headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);

    expect((await app.inject({ method: "POST", url: "/v1/auth/oauth/exchange", payload: { code: params.code } })).statusCode).toBe(401);
  });

  it("refuses a made-up or expired code", async () => {
    expect((await app.inject({ method: "POST", url: "/v1/auth/oauth/exchange", payload: { code: "x".repeat(40) } })).statusCode).toBe(401);
    await start("google", "app");
    next.claims = { sub: "g-9", email: "pat@example.com", email_verified: true };
    const { params } = await back("google");
    await prisma.oAuthState.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await app.inject({ method: "POST", url: "/v1/auth/oauth/exchange", payload: { code: params.code } })).statusCode).toBe(401);
  });
});

describe("accounts without a password", () => {
  async function googleAccount() {
    await start("google", "app");
    next.claims = { sub: "g-7", email: "pat@example.com", email_verified: true };
    const { params } = await back("google");
    const token = (await app.inject({ method: "POST", url: "/v1/auth/oauth/exchange", payload: { code: params.code } })).json().token as string;
    return (method: "POST" | "DELETE", url: string, payload: unknown) => app.inject({ method, url: `/v1${url}`, payload: payload as object, headers: { authorization: `Bearer ${token}` } });
  }

  it("cannot be signed into with a guessed password, and can set one without a current one", async () => {
    const call = await googleAccount();
    expect((await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "pat@example.com", password: "" } })).statusCode).toBe(400);
    expect((await call("POST", "/me/password", { newPassword: "a brand new password" })).statusCode).toBe(204);
    expect((await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "pat@example.com", password: "a brand new password" } })).statusCode).toBe(200);
    // Now there is one, it is required to change it.
    expect((await call("POST", "/me/password", { newPassword: "another new password" })).statusCode).toBe(400);
  });

  it("is deleted by typing DELETE, with everything it owned", async () => {
    const call = await googleAccount();
    expect((await call("DELETE", "/me", { password: "yes" })).statusCode).toBe(400);
    expect((await call("DELETE", "/me", { password: "delete" })).statusCode).toBe(204);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.identity.count()).toBe(0);
  });
});

describe("settings", () => {
  it("requires each listed provider's keys, and never allows pretending in production", () => {
    expect(() => loadEnv({ ...process.env, SIGNIN_PROVIDERS: "google" })).toThrow(/SIGNIN_PROVIDERS includes google, so GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set too/);
    expect(() => loadEnv({ ...process.env, SIGNIN_PROVIDERS: "facebook" })).toThrow(/"facebook", which is not one of/);
    expect(() => loadEnv({ ...process.env, NODE_ENV: "production", DATABASE_URL: "postgresql://x", WEB_URL: "https://a.example.com", OAUTH_MOCK: "true", SIGNIN_PROVIDERS: "google" })).toThrow(/OAUTH_MOCK must not be on in production/);
    expect(loadEnv({ ...process.env, OAUTH_MOCK: "true", SIGNIN_PROVIDERS: "google,apple" }).SIGNIN_PROVIDERS).toBe("google,apple");
  });

  it("sends people back to the web app's /api when hosted", async () => {
    const hosted = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv({ ...process.env, NODE_ENV: "production", DATABASE_URL: process.env.DATABASE_URL, WEB_URL: "https://app.example.com", SIGNIN_PROVIDERS: "google", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "s" }), rateLimit: false });
    const res = await hosted.inject({ url: "/v1/auth/oauth/google/start" });
    expect(new URL(res.headers.location as string).searchParams.get("redirect_uri")).toBe("https://app.example.com/api/v1/auth/oauth/google/callback");
    expect(String(res.headers["set-cookie"])).toMatch(/koinonia_oauth=[^;]+; Path=\/; HttpOnly; SameSite=None; Max-Age=600; Secure/);
    expect((await hosted.inject({ url: "/v1/config" })).json().signIn).toEqual({ providers: ["google"], startBase: "https://app.example.com/api" });
    await hosted.close();
  });
});

describe("the pretend provider (OAUTH_MOCK, local only)", () => {
  it("runs the whole flow without any developer account", async () => {
    const local = await buildApp({ prisma, providers: createMockProviders(), env: loadEnv({ ...process.env, OAUTH_MOCK: "true", SIGNIN_PROVIDERS: "google,microsoft,apple" }), rateLimit: false });
    const started = await local.inject({ url: "/v1/auth/oauth/apple/start?client=web" });
    const cookie = String(started.headers["set-cookie"]).match(/koinonia_oauth=([^;]+)/)![1];
    const page = new URL(started.headers.location as string);
    expect(page.pathname).toBe("/v1/auth/oauth/mock/authorize");
    const html = (await local.inject({ url: page.pathname + page.search })).body;
    expect(html).toContain("Pretend Apple");
    const approve = new URLSearchParams({ provider: "apple", redirect_uri: page.searchParams.get("redirect_uri")!, state: page.searchParams.get("state")!, nonce: page.searchParams.get("nonce")!, email: "mock@example.com", name: "Mock Person", verified: "1" });
    const toCallback = new URL((await local.inject({ url: `/v1/auth/oauth/mock/approve?${approve}` })).headers.location as string);
    const done = await local.inject({ url: toCallback.pathname + toCallback.search, headers: { cookie: `koinonia_oauth=${cookie}` } });
    await local.close();
    expect(done.headers.location).toBe("http://localhost:3000/signed-in?method=apple&new=1");
    expect(await prisma.user.findFirst({ where: { email: "mock@example.com" } })).toMatchObject({ name: "Mock Person", passwordSet: false });
  });

  it("is not there unless switched on", async () => {
    expect((await app.inject({ url: "/v1/auth/oauth/mock/authorize?provider=google" })).statusCode).toBe(404);
  });
});
