/**
 * "Sign in with Google / Microsoft / Apple". Each provider is OpenID Connect with the
 * authorization-code flow and PKCE; what differs is the addresses, how the issuer looks, how
 * "this email is verified" is said, and Apple's signed client secret.
 *
 * OAUTH_MOCK=true (never in production) replaces all three with a page on this API that
 * pretends to be the provider, so the whole flow can be tried without developer accounts.
 */
import { SIGN_IN_PROVIDERS, type SignInProvider } from "@koinonia/shared";
import type { Env } from "../env";
import { isTrue, jwksCache, signEs256Jwt, TokenError, verifyIdToken, type IdClaims } from "../lib/oidc";

export interface ProviderAdapter {
  id: SignInProvider;
  /** Where to send the browser. */
  authorizeUrl(p: { redirectUri: string; state: string; nonce: string; challenge: string }): string;
  /** Trades the code for an ID token and checks it. */
  claims(p: { code: string; redirectUri: string; verifier: string; nonce: string }): Promise<IdClaims>;
  /** Whether the provider vouches that the person owns this email address. */
  emailVerified(claims: IdClaims): boolean;
}

/** Microsoft's directory for personal accounts (Outlook.com, Hotmail, Xbox...). */
export const MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

const query = (base: string, params: Record<string, string>) => `${base}?${new URLSearchParams(params)}`;

async function tokenRequest(fetchImpl: typeof fetch, url: string, body: Record<string, string>): Promise<string> {
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !json.id_token) throw new TokenError(`token request refused (${res.status} ${json.error ?? ""})`.trim());
  return json.id_token;
}

export function createSignInProviders(env: Env, deps: { fetch?: typeof fetch; now: () => Date }): Map<SignInProvider, ProviderAdapter> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;
  const keys = jwksCache(fetchImpl, deps.now);
  const enabled = enabledProviders(env);
  const out = new Map<SignInProvider, ProviderAdapter>();

  for (const id of enabled) {
    if (env.OAUTH_MOCK) {
      out.set(id, mockProvider(id, env));
      continue;
    }
    if (id === "google") {
      const clientId = env.GOOGLE_CLIENT_ID!;
      out.set(id, {
        id,
        authorizeUrl: (p) =>
          query("https://accounts.google.com/o/oauth2/v2/auth", { client_id: clientId, redirect_uri: p.redirectUri, response_type: "code", scope: "openid email profile", state: p.state, nonce: p.nonce, code_challenge: p.challenge, code_challenge_method: "S256", prompt: "select_account" }),
        claims: async (p) => {
          const idToken = await tokenRequest(fetchImpl, "https://oauth2.googleapis.com/token", { grant_type: "authorization_code", code: p.code, redirect_uri: p.redirectUri, client_id: clientId, client_secret: env.GOOGLE_CLIENT_SECRET!, code_verifier: p.verifier });
          return verifyIdToken(idToken, { keys: (kid) => keys("https://www.googleapis.com/oauth2/v3/certs", kid), issuer: (iss) => iss === "https://accounts.google.com" || iss === "accounts.google.com", audience: clientId, nonce: p.nonce, now: deps.now() });
        },
        emailVerified: (c) => isTrue(c.email_verified),
      });
    }
    if (id === "microsoft") {
      const clientId = env.MICROSOFT_CLIENT_ID!;
      out.set(id, {
        id,
        authorizeUrl: (p) =>
          query("https://login.microsoftonline.com/common/oauth2/v2.0/authorize", { client_id: clientId, redirect_uri: p.redirectUri, response_type: "code", response_mode: "query", scope: "openid email profile", state: p.state, nonce: p.nonce, code_challenge: p.challenge, code_challenge_method: "S256", prompt: "select_account" }),
        claims: async (p) => {
          const idToken = await tokenRequest(fetchImpl, "https://login.microsoftonline.com/common/oauth2/v2.0/token", { grant_type: "authorization_code", code: p.code, redirect_uri: p.redirectUri, client_id: clientId, client_secret: env.MICROSOFT_CLIENT_SECRET!, code_verifier: p.verifier, scope: "openid email profile" });
          return verifyIdToken(idToken, {
            keys: (kid) => keys("https://login.microsoftonline.com/common/discovery/v2.0/keys", kid),
            // Each directory signs as itself; the issuer must name the directory the token says it is from.
            issuer: (iss, c) => typeof c.tid === "string" && /^[0-9a-f-]{36}$/.test(c.tid) && iss === `https://login.microsoftonline.com/${c.tid}/v2.0`,
            audience: clientId,
            nonce: p.nonce,
            now: deps.now(),
          });
        },
        // Work and school directories let administrators type any email onto an account, so
        // only personal accounts, or a directory that proved it owns the domain, count.
        emailVerified: (c) => c.tid === MICROSOFT_CONSUMER_TENANT || isTrue(c.xms_edov),
      });
    }
    if (id === "apple") {
      const clientId = env.APPLE_CLIENT_ID!;
      out.set(id, {
        id,
        authorizeUrl: (p) =>
          // Apple only shares name and email with response_mode=form_post.
          query("https://appleid.apple.com/auth/authorize", { client_id: clientId, redirect_uri: p.redirectUri, response_type: "code", response_mode: "form_post", scope: "name email", state: p.state, nonce: p.nonce, code_challenge: p.challenge, code_challenge_method: "S256" }),
        claims: async (p) => {
          const at = Math.floor(deps.now().getTime() / 1000);
          const clientSecret = signEs256Jwt({ kid: env.APPLE_KEY_ID }, { iss: env.APPLE_TEAM_ID, iat: at, exp: at + 300, aud: "https://appleid.apple.com", sub: clientId }, env.APPLE_PRIVATE_KEY!);
          const idToken = await tokenRequest(fetchImpl, "https://appleid.apple.com/auth/token", { grant_type: "authorization_code", code: p.code, redirect_uri: p.redirectUri, client_id: clientId, client_secret: clientSecret, code_verifier: p.verifier });
          return verifyIdToken(idToken, { keys: (kid) => keys("https://appleid.apple.com/auth/keys", kid), issuer: (iss) => iss === "https://appleid.apple.com", audience: clientId, nonce: p.nonce, now: deps.now() });
        },
        // Apple's private-relay addresses are verified too: they forward to the real inbox.
        emailVerified: (c) => isTrue(c.email_verified),
      });
    }
  }
  return out;
}

/** Providers switched on with SIGNIN_PROVIDERS, in a fixed order. */
export function enabledProviders(env: Pick<Env, "SIGNIN_PROVIDERS">): SignInProvider[] {
  const wanted = new Set((env.SIGNIN_PROVIDERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean));
  return SIGN_IN_PROVIDERS.filter((p) => wanted.has(p));
}

/** Where the provider sends people back. Must be registered with the provider exactly. */
export function callbackBase(env: Env): string {
  if (env.OAUTH_CALLBACK_BASE) return env.OAUTH_CALLBACK_BASE.replace(/\/+$/, "");
  // Hosted, the browser talks to the API through the web app's /api, so the session cookie
  // belongs to the web app's address.
  if (env.NODE_ENV === "production") return `${env.WEB_URL.replace(/\/+$/, "")}/api`;
  return (env.API_PUBLIC_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, "");
}

// ---- The pretend provider --------------------------------------------------------------

/** The "code" the mock page hands back: the claims it was asked to sign in with. */
export const mockCode = (claims: Partial<IdClaims>) => `mock.${Buffer.from(JSON.stringify(claims)).toString("base64url")}`;

function mockProvider(id: SignInProvider, env: Env): ProviderAdapter {
  return {
    id,
    authorizeUrl: (p) => query(`${callbackBase(env)}/v1/auth/oauth/mock/authorize`, { provider: id, redirect_uri: p.redirectUri, state: p.state, nonce: p.nonce }),
    claims: async (p) => {
      if (!p.code.startsWith("mock.")) throw new TokenError("not a mock code");
      const claims = JSON.parse(Buffer.from(p.code.slice(5), "base64url").toString("utf8")) as IdClaims;
      if (claims.nonce !== p.nonce) throw new TokenError("token does not belong to this sign-in");
      return claims;
    },
    emailVerified: (c) => isTrue(c.email_verified),
  };
}
