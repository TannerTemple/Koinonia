import * as SecureStore from "expo-secure-store";
import { createApiClient } from "@koinonia/shared";

const TOKEN_KEY = "koinonia.token";
let cachedToken: string | null | undefined;

/** The session token lives in the iOS Keychain (Android Keystore), cached in memory. */
export const tokenStore = {
  async get(): Promise<string | null> {
    if (cachedToken === undefined) {
      cachedToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
    }
    return cachedToken;
  },
  async set(token: string | null) {
    cachedToken = token;
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token).catch(() => undefined);
    else await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  },
};

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => unauthorizedHandler?.(),
});
