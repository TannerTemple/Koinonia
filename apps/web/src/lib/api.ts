import { createApiClient } from "@koinonia/shared";

let unauthorizedHandler: (() => void) | null = null;
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * The web session is an httpOnly cookie set by the API, so no script on the page (ours or
 * an injected one) can read the token. Nothing is kept in localStorage.
 */
export const api = createApiClient({
  baseUrl: API_URL,
  cookieSession: true,
  onUnauthorized: () => unauthorizedHandler?.(),
});

/** Earlier versions kept the token in localStorage; make sure none is left behind. */
export function dropLegacyToken() {
  try {
    window.localStorage.removeItem("koinonia.token");
  } catch {
    /* storage unavailable */
  }
}
