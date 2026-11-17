# syntax=docker/dockerfile:1
#
# Koinonia web app (Next.js). Build from the repository root, because it needs packages/shared:
#
#   docker build -f apps/web/Dockerfile --build-arg API_PROXY_TARGET=https://YOUR-API -t koinonia-web .
#   docker run --rm -p 3000:3000 koinonia-web
#
# API_PROXY_TARGET is the API's public address. It is fixed when the image is BUILT (the web
# app forwards /api/* there), so changing it means building again. Nothing secret goes in here.

FROM node:22-slim AS build
RUN npm install -g pnpm@10.28.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
# "isolated" installs only what the web app needs (see the API's Dockerfile).
RUN pnpm install --frozen-lockfile --filter "@koinonia/web..." --config.node-linker=isolated

COPY packages/shared packages/shared
COPY apps/web apps/web

ARG API_PROXY_TARGET
ARG GIT_COMMIT=""
# Optional, shown on the privacy and terms pages.
ARG NEXT_PUBLIC_CONTACT_EMAIL=""
ARG NEXT_PUBLIC_OPERATOR_NAME=""
ENV API_PROXY_TARGET=$API_PROXY_TARGET GIT_COMMIT=$GIT_COMMIT \
    NEXT_PUBLIC_CONTACT_EMAIL=$NEXT_PUBLIC_CONTACT_EMAIL NEXT_PUBLIC_OPERATOR_NAME=$NEXT_PUBLIC_OPERATOR_NAME \
    NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @koinonia/web build

# ---- runtime: just the traced server, no package manager ---------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
