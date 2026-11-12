import { createApiClient } from "@koinonia/shared";

const TOKEN_KEY = "koinonia.token";

export const tokenStore = {
  get(): string | null {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) window.localStorage.setItem(TOKEN_KEY, token);
      else window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode: stay signed in for this page only */
    }
  },
};

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = createApiClient({
  baseUrl: API_URL,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => unauthorizedHandler?.(),
});
