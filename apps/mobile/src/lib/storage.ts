import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Small values kept on this device: flags ("seen the welcome") and unsent drafts.
 * The iPhone Keychain on a phone, localStorage in the browser preview. Never throws:
 * losing a flag or a draft must not break a screen.
 *
 * Keys may only contain letters, digits, ".", "-" and "_" (a Keychain rule).
 */
const web = Platform.OS === "web";
const clean = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");

export const kv = {
  async get(key: string): Promise<string | null> {
    try {
      return web ? (globalThis.localStorage?.getItem(clean(key)) ?? null) : await SecureStore.getItemAsync(clean(key));
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (web) globalThis.localStorage?.setItem(clean(key), value);
      else await SecureStore.setItemAsync(clean(key), value);
    } catch {
      /* storage full or unavailable */
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (web) globalThis.localStorage?.removeItem(clean(key));
      else await SecureStore.deleteItemAsync(clean(key));
    } catch {
      /* nothing to remove */
    }
  },
};

/**
 * Longer text (a draft note can be 4,000 characters). The Keychain is only dependable for
 * small values, so long text is stored in pieces.
 */
const PIECE = 1500;
export const longText = {
  async get(key: string): Promise<string | null> {
    const count = Number(await kv.get(`${key}.n`));
    if (!Number.isInteger(count) || count <= 0) return null;
    const pieces = await Promise.all(Array.from({ length: count }, (_, i) => kv.get(`${key}.${i}`)));
    return pieces.some((p) => p === null) ? null : pieces.join("");
  },
  async set(key: string, value: string): Promise<void> {
    const previous = Number(await kv.get(`${key}.n`)) || 0;
    const count = Math.ceil(value.length / PIECE);
    for (let i = 0; i < count; i++) await kv.set(`${key}.${i}`, value.slice(i * PIECE, (i + 1) * PIECE));
    await kv.set(`${key}.n`, String(count));
    for (let i = count; i < previous; i++) await kv.remove(`${key}.${i}`);
  },
  async remove(key: string): Promise<void> {
    const previous = Number(await kv.get(`${key}.n`)) || 0;
    for (let i = 0; i < previous; i++) await kv.remove(`${key}.${i}`);
    await kv.remove(`${key}.n`);
  },
};
