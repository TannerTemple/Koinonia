# syntax=docker/dockerfile:1
#
# Koinonia API. Build from the repository root, because the API needs packages/shared:
#
#   docker build -f apps/api/Dockerfile -t koinonia-api .
#   docker run --rm -p 4000:4000 --env-file apps/api/.env koinonia-api
#
# On start the container applies any new database migrations, then serves on $PORT (4000).

FROM node:22-slim AS base
# Prisma's query engine needs OpenSSL; ca-certificates lets it reach TLS-only databases.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@10.28.0
WORKDIR /app

# ---- install + build -------------------------------------------------------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
# The API's postinstall runs `prisma generate`, which needs the schema.
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter "@koinonia/api..."

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @koinonia/api build

# ---- runtime ---------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=4000
# node_modules stays whole: the Prisma CLI is needed at start to apply migrations.
COPY --from=build --chown=node:node /app/node_modules /app/node_modules
COPY --from=build --chown=node:node /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build --chown=node:node /app/apps/api/prisma /app/apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
WORKDIR /app/apps/api
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["sh", "-c", "node /app/node_modules/prisma/build/index.js migrate deploy && node dist/server.js"]
