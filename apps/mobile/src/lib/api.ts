import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createApiClient } from "@koinonia/shared";

const TOKEN_KEY = "koinonia.token";
let cachedToken: string | null | undefined;

// The browser preview has no Keychain; it falls back to localStorage.
const storage =
  Platform.OS === "web"
    ? {
        get: async () => globalThis.localStorage?.getItem(TOKEN_KEY) ?? null,
        set: async (value: string) => globalThis.localStorage?.setItem(TOKEN_KEY, value),
        remove: async () => globalThis.localStorage?.removeItem(TOKEN_KEY),
      }
    : {
        get: () => SecureStore.getItemAsync(TOKEN_KEY),
        set: (value: string) => SecureStore.setItemAsync(TOKEN_KEY, value),
        remove: () => SecureStore.deleteItemAsync(TOKEN_KEY),
      };

/** The session token lives in the iOS Keychain (Android Keystore), cached in memory. */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (cachedToken === undefined) cachedToken = await storage.get().catch(() => null);
    return cachedToken;
  },
  async set(token: string | null) {
    cachedToken = token;
    await (token ? storage.set(token) : storage.remove()).catch(() => undefined);
  },
};

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";
/** Where the web app lives; the privacy policy and terms are pages there. */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => unauthorizedHandler?.(),
});
