import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const KEY_LENGTH = 64;
/** Cost before it was stored in the hash ("scrypt$salt$hash"). */
const LEGACY_LOG_N = 14;
/**
 * scrypt work factor as log2(N). 17 is the OWASP-recommended minimum (N=2^17, r=8, p=1).
 * SCRYPT_LOG_N lowers it for tests only.
 */
export const SCRYPT_LOG_N = Math.min(20, Math.max(14, Number(process.env.SCRYPT_LOG_N) || 17));

function scrypt(password: string, salt: Buffer, length: number, logN: number): Promise<Buffer> {
  const options: ScryptOptions = { N: 2 ** logN, r: 8, p: 1, maxmem: 256 * 2 ** logN * 8 };
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, length, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

function parseHash(stored: string): { logN: number; salt: Buffer; hash: Buffer } | null {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt") return null;
  const [logN, saltB64, hashB64] = parts.length === 4 ? [Number(parts[1]), parts[2], parts[3]] : [LEGACY_LOG_N, parts[1], parts[2]];
  if (!saltB64 || !hashB64 || !Number.isInteger(logN) || logN < 10 || logN > 20) return null;
  return { logN, salt: Buffer.from(saltB64, "base64"), hash: Buffer.from(hashB64, "base64") };
}

/** scrypt with a per-password salt, stored as "scrypt$<log2 N>$<salt>$<hash>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT_LOG_N);
  return `scrypt$${SCRYPT_LOG_N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed || parsed.hash.length === 0) return false;
  const actual = await scrypt(password, parsed.salt, parsed.hash.length, parsed.logN);
  return timingSafeEqual(parsed.hash, actual);
}

/** True when a stored hash was made with a weaker cost than today's and should be redone at sign-in. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  return !parsed || parsed.logN < SCRYPT_LOG_N;
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
