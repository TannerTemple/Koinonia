/**
 * The small part of OpenID Connect that "Sign in with Google / Microsoft / Apple" needs:
 * PKCE, checking an ID token's signature against the provider's published keys, and the
 * signed "client secret" Apple asks for. Built on node:crypto, no extra dependency.
 */
import { createHash, createPrivateKey, createPublicKey, randomBytes, sign, verify, type JsonWebKey, type KeyObject } from "node:crypto";

export const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");
export const randomUrlSafe = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** PKCE: the verifier stays here; the challenge goes to the provider. */
export function pkce() {
  const verifier = randomUrlSafe(48);
  return { verifier, challenge: b64url(createHash("sha256").update(verifier).digest()) };
}

export interface IdClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  /** Microsoft: the directory (tenant) the account belongs to. */
  tid?: string;
  /** Microsoft: the email's domain owner verified it (optional claim). */
  xms_edov?: boolean | string;
}

export class TokenError extends Error {}

interface Jwk extends JsonWebKey {
  kid?: string;
  alg?: string;
}

/** Fetches and remembers a provider's public keys for an hour; fetches again for an unknown key id. */
export function jwksCache(fetchImpl: typeof fetch, now: () => Date) {
  const cache = new Map<string, { at: number; keys: Jwk[] }>();
  return async (url: string, kid: string | undefined): Promise<Jwk[]> => {
    const hit = cache.get(url);
    const fresh = hit && now().getTime() - hit.at < 3_600_000;
    if (fresh && (!kid || hit.keys.some((k) => k.kid === kid))) return hit.keys;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new TokenError(`could not fetch the provider's keys (${res.status})`);
    const keys = ((await res.json()) as { keys?: Jwk[] }).keys ?? [];
    cache.set(url, { at: now().getTime(), keys });
    return keys;
  };
}

/**
 * Checks an ID token: signature (RS256 or ES256) by one of the provider's keys, issuer,
 * audience, expiry (with two minutes' leeway) and nonce. Returns its claims, or throws.
 */
export async function verifyIdToken(
  token: string,
  opts: { keys: (kid: string | undefined) => Promise<Jwk[]>; issuer: (iss: string, claims: IdClaims) => boolean; audience: string; nonce: string; now: Date },
): Promise<IdClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new TokenError("not a signed token");
  const [h, p, sig] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: IdClaims;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
  } catch {
    throw new TokenError("unreadable token");
  }
  if (header.alg !== "RS256" && header.alg !== "ES256") throw new TokenError(`unexpected algorithm ${header.alg}`);

  const keys = await opts.keys(header.kid);
  const candidates = keys.filter((k) => (!header.kid || k.kid === header.kid) && (!k.alg || k.alg === header.alg));
  const data = Buffer.from(`${h}.${p}`);
  const signature = Buffer.from(sig, "base64url");
  const ok = candidates.some((jwk) => {
    try {
      const key: KeyObject = createPublicKey({ key: jwk, format: "jwk" });
      return header.alg === "RS256" ? verify("RSA-SHA256", data, key, signature) : verify("SHA256", data, { key, dsaEncoding: "ieee-p1363" }, signature);
    } catch {
      return false;
    }
  });
  if (!ok) throw new TokenError("signature does not match the provider's keys");

  const now = Math.floor(opts.now.getTime() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!opts.issuer(claims.iss, claims)) throw new TokenError("wrong issuer");
  if (!aud.includes(opts.audience)) throw new TokenError("token was made for another app");
  if (typeof claims.exp !== "number" || claims.exp < now - 120) throw new TokenError("token has expired");
  if (typeof claims.sub !== "string" || !claims.sub) throw new TokenError("token has no subject");
  if (claims.nonce !== opts.nonce) throw new TokenError("token does not belong to this sign-in");
  return claims;
}

/** Signs a short JWT with an ES256 key in PEM (.p8) form. Apple's "client secret". */
export function signEs256Jwt(header: Record<string, unknown>, payload: Record<string, unknown>, pem: string): string {
  const key = createPrivateKey(pem.includes("BEGIN") ? pem : pem.replace(/\\n/g, "\n"));
  const input = `${b64url(JSON.stringify({ alg: "ES256", typ: "JWT", ...header }))}.${b64url(JSON.stringify(payload))}`;
  const signature = sign("SHA256", Buffer.from(input), { key, dsaEncoding: "ieee-p1363" });
  return `${input}.${b64url(signature)}`;
}

/** "true" (Apple) and true (Google) both count; anything else does not. */
export const isTrue = (v: unknown) => v === true || v === "true";
