import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./client";

type Call = { url: string; init: RequestInit };
function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    const call = { url, init };
    calls.push(call);
    return respond(call);
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("api client", () => {
  it("sends the bearer token and JSON body to the versioned URL", async () => {
    const { fetch, calls } = fakeFetch(() => json(201, { id: "c1", name: "Ana" }));
    const api = createApiClient({ baseUrl: "http://api.test/", getToken: async () => "tok", fetch });
    const created = await api.contacts.create({ name: "Ana" });
    expect(created).toMatchObject({ id: "c1" });
    expect(calls[0]!.url).toBe("http://api.test/v1/contacts");
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.headers).toMatchObject({ Authorization: "Bearer tok", "Content-Type": "application/json" });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ name: "Ana" });
  });

  it("sends no Authorization header when signed out", async () => {
    const { fetch, calls } = fakeFetch(() => json(200, { token: "t", user: {} }));
    const api = createApiClient({ baseUrl: "http://api.test", fetch });
    await api.auth.login({ email: "a@b.co", password: "x" });
    expect(calls[0]!.init.headers).not.toHaveProperty("Authorization");
  });

  it("returns undefined for 204", async () => {
    const { fetch } = fakeFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: "http://api.test", fetch });
    await expect(api.auth.forgotPassword({ email: "a@b.co" })).resolves.toBeUndefined();
  });

  it("turns API errors into ApiError with code, message and field errors", async () => {
    const { fetch } = fakeFetch(() => json(400, { error: { code: "BAD_REQUEST", message: "Name is required", fields: { name: "Name is required" } } }));
    const api = createApiClient({ baseUrl: "http://api.test", fetch });
    const err = await api.contacts.create({ name: "" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "BAD_REQUEST", message: "Name is required", fields: { name: "Name is required" } });
  });

  it("copes with a non-JSON error body", async () => {
    const { fetch } = fakeFetch(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    const api = createApiClient({ baseUrl: "http://api.test", fetch });
    await expect(api.home()).rejects.toMatchObject({ status: 502, code: "UNKNOWN" });
  });

  it("reports a rejected token, but not a failed sign-in, as unauthorized", async () => {
    const onUnauthorized = vi.fn();
    const { fetch } = fakeFetch(() => json(401, { error: { code: "UNAUTHORIZED", message: "Please sign in." } }));
    const signedIn = createApiClient({ baseUrl: "http://api.test", getToken: () => "old", onUnauthorized, fetch });
    await expect(signedIn.home()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    const signedOut = createApiClient({ baseUrl: "http://api.test", onUnauthorized, fetch });
    await expect(signedOut.auth.login({ email: "a@b.co", password: "x" })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("explains a network failure in plain words", async () => {
    const fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof globalThis.fetch;
    const api = createApiClient({ baseUrl: "http://api.test", fetch });
    await expect(api.home()).rejects.toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("in cookie mode sends credentials and the client header, and no token", async () => {
    const onUnauthorized = vi.fn();
    const { fetch, calls } = fakeFetch(() => json(401, { error: { code: "UNAUTHORIZED", message: "Please sign in." } }));
    const api = createApiClient({ baseUrl: "http://api.test", cookieSession: true, onUnauthorized, fetch });
    await expect(api.home()).rejects.toMatchObject({ status: 401 });
    expect(calls[0]!.init.credentials).toBe("include");
    expect(calls[0]!.init.headers).toMatchObject({ "X-Koinonia-Client": "web" });
    expect(calls[0]!.init.headers).not.toHaveProperty("Authorization");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    // A wrong password at sign-in is not an expired session.
    await expect(api.auth.login({ email: "a@b.co", password: "x" })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("sends the password in the body when deleting the account", async () => {
    const { fetch, calls } = fakeFetch(() => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: "http://api.test", getToken: () => "tok", fetch });
    await api.me.delete({ password: "secret" });
    expect(calls[0]!.init.method).toBe("DELETE");
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ password: "secret" });
  });
});
