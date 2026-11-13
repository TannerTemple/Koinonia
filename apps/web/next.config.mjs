// When API_PROXY_TARGET is set (for example https://koinonia-api.onrender.com), the web app
// forwards /api/* to the API. The browser then only ever talks to the web app's own address,
// so the session cookie is first-party and no custom domain is needed. Pair it with
// NEXT_PUBLIC_API_URL=/api. See docs/DEPLOY.md.
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The shared package ships TypeScript source.
  transpilePackages: ["@koinonia/shared"],
  async rewrites() {
    return apiProxyTarget ? [{ source: "/api/:path*", destination: `${apiProxyTarget}/:path*` }] : [];
  },
};

export default nextConfig;
