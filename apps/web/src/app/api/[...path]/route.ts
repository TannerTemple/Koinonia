import type { NextRequest } from "next/server";

/**
 * Forwards /api/* to the API, so the browser only ever talks to this site (which keeps the
 * session cookie first-party). Done here rather than with a rewrite so that the visitor's own
 * address can be passed along: without it the API sees every web visitor as one address and
 * they all share one rate limit.
 *
 * The address is only believed by the API when it comes with PROXY_SECRET, a value known to
 * this server and the API and to nobody else.
 */
export const dynamic = "force-dynamic";

// Set when the image or site was built (see next.config.mjs); a runtime value wins.
const target = () => (process.env.API_PROXY_TARGET || process.env.API_PROXY_TARGET_BUILT || "").replace(/\/+$/, "");

/** The address our own host says the request came from: the last entry is the one it added. */
function visitorAddress(request: NextRequest): string {
  const raw = request.headers.get("x-forwarded-for")?.split(",").pop() ?? request.headers.get("x-real-ip") ?? "";
  const address = raw.trim().replace(/^\[([^\]]+)\](:\d+)?$/, "$1").replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
  return /^[0-9a-fA-F:.]{3,45}$/.test(address) ? address : "unknown";
}

// Headers that describe this hop, or that a visitor must never be able to set themselves.
const DROP_REQUEST = ["host", "connection", "content-length", "accept-encoding", "x-koinonia-proxy-secret", "x-koinonia-client-ip"];
const DROP_RESPONSE = ["content-encoding", "content-length", "transfer-encoding", "connection"];

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const base = target();
  if (!base) return Response.json({ error: { code: "NOT_CONFIGURED", message: "This site has no API address. Set API_PROXY_TARGET." } }, { status: 502 });

  const { path } = await context.params;
  const url = `${base}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  for (const name of DROP_REQUEST) headers.delete(name);
  const secret = process.env.PROXY_SECRET;
  if (secret) {
    headers.set("x-koinonia-proxy-secret", secret);
    headers.set("x-koinonia-client-ip", visitorAddress(request));
  }

  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const out = new Headers(upstream.headers);
    for (const name of DROP_RESPONSE) out.delete(name);
    return new Response(upstream.status === 204 || upstream.status === 304 ? null : upstream.body, { status: upstream.status, headers: out });
  } catch {
    return Response.json({ error: { code: "UPSTREAM", message: "The API could not be reached." } }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE, forward as OPTIONS, forward as HEAD };
