// When API_PROXY_TARGET is set (for example https://koinonia-api.onrender.com), the web app
// forwards /api/* to the API. The browser then only ever talks to the web app's own address,
// so the session cookie is first-party and no custom domain is needed. Pair it with
// NEXT_PUBLIC_API_URL=/api. See docs/DEPLOY.md.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

const production = process.env.NODE_ENV === "production";

// Where the browser is allowed to send data: this site, plus the API when it is called directly.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const apiOrigin = /^https?:\/\//.test(apiUrl) ? new URL(apiUrl).origin : "";

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
  async rewrites() {
    return apiProxyTarget ? [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }] : [];
  },
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
