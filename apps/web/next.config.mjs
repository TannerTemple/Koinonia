// When API_PROXY_TARGET is set (for example https://koinonia-api.onrender.com), the web app
// forwards /api/* to the API (src/app/api/[...path]/route.ts). The browser then only ever talks to the web app's own address,
// so the session cookie is first-party and no custom domain is needed. Pair it with
// NEXT_PUBLIC_API_URL=/api. See docs/DEPLOY.md.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Shown on feedback messages so a report can be matched to the code that was running.
// The one place names and default addresses live.
const brand = JSON.parse(readFileSync(new URL("../../packages/shared/brand.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT)?.slice(0, 7);
const appVersion = commit ? `${pkg.version} (${commit})` : pkg.version;

const tidy = (value) => value?.trim().replace(/^(["'])(.*)\1$/, "$2").trim().replace(/\/+$/, "") || undefined;
const apiProxyTarget = tidy(process.env.API_PROXY_TARGET);

const production = process.env.NODE_ENV === "production";

// Where the browser sends API calls. With a proxy target, that is this site's own /api,
// so API_PROXY_TARGET is the only variable a Vercel project needs.
const apiUrl = tidy(process.env.NEXT_PUBLIC_API_URL) ?? (apiProxyTarget ? "/api" : brand.defaultApiUrl);
const apiOrigin = /^https?:\/\//.test(apiUrl) ? new URL(apiUrl).origin : "";

// A hosted build with the wrong address looks fine and then cannot sign anyone in.
// Stop the build instead, and say what to set.
function buildProblem() {
  if (apiProxyTarget && !/^https?:\/\/[^/\s]+$/.test(apiProxyTarget)) {
    return `API_PROXY_TARGET must be the API's address and nothing else, like https://koinonia-api.onrender.com. It is "${apiProxyTarget}".`;
  }
  if (apiUrl.startsWith("/") && !apiProxyTarget) {
    return `NEXT_PUBLIC_API_URL is "${apiUrl}" but API_PROXY_TARGET is not set. Add API_PROXY_TARGET with the API's address, like https://koinonia-api.onrender.com.`;
  }
  if (!apiUrl.startsWith("/") && !/^https?:\/\/[^\s]+$/.test(apiUrl)) {
    return `NEXT_PUBLIC_API_URL must be /api or an address starting with https://. It is "${apiUrl}".`;
  }
  if ((process.env.VERCEL || process.env.NEXT_OUTPUT === "standalone") && !process.env.ALLOW_LOCAL_API && /\/\/(localhost|127\.0\.0\.1)/.test(apiProxyTarget ?? apiUrl)) {
    return apiProxyTarget
      ? `API_PROXY_TARGET is "${apiProxyTarget}", which is your own computer, not the hosted API. Set it to the API's address, like https://koinonia-api.onrender.com.`
      : "API_PROXY_TARGET is not set, so this site would look for the API on localhost. Add API_PROXY_TARGET with the API's address, like https://koinonia-api.onrender.com.";
  }
  return null;
}
const problem = buildProblem();
if (problem) {
  throw new Error(`\n\n${brand.name} web cannot be built: ${problem}\nOn Vercel: Project > Settings > Environment Variables, then Deployments > Redeploy. In Docker: pass --build-arg API_PROXY_TARGET=https://...\n`);
}

// Next.js needs inline scripts and styles, so this policy cannot stop every injected script.
// What it does guarantee: scripts and fonts load only from this site, data can be sent only
// to this site and the API, the pages cannot be framed, and forms cannot post elsewhere.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Never tell other sites which page a visitor came from.
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // The development server needs eval and websockets, so the strict rules are production-only.
  ...(production
    ? [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      ]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@koinonia/shared"],
  poweredByHeader: false,
  // For Docker (Azure Container Apps): a self-contained server in .next/standalone. Vercel
  // does its own packaging, so this is opt-in through NEXT_OUTPUT=standalone.
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone", outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)) } : {}),
  // Hands the address worked out above to the pages (it is read as NEXT_PUBLIC_API_URL).
  env: { NEXT_PUBLIC_API_URL: apiUrl, NEXT_PUBLIC_APP_VERSION: appVersion, API_PROXY_TARGET_BUILT: apiProxyTarget ?? "" },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // These addresses carry a one-time secret: send no referrer at all and keep them out of caches.
      {
        source: "/:page(reset-password|verify-email)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
