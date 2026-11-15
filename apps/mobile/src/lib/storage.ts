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
