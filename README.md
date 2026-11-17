# Koinonia

_κοινωνία — communion, fellowship._ An app that helps busy people stay close to the people they mean to stay close to: reminders to reach out on a rhythm you set per person, notes so you remember what matters to them, and a prayer list with one intention set apart each day.

**Start with [STATUS.md](STATUS.md)** for what works, what is stubbed, and what to do next. To put it online: [docs/DEPLOY.md](docs/DEPLOY.md) (Neon, Render, Vercel) and [docs/APP_STORE.md](docs/APP_STORE.md).

## What's in the repo

```
apps/api        Fastify REST API, Prisma, PostgreSQL, session-token auth
apps/web        Next.js web app (Tailwind, TanStack Query)
apps/mobile     Expo / React Native app (Expo Router), iOS first
packages/shared zod schemas, types, typed API client, cadence + streak logic, design tokens
docs            BRIEF (requirements), PLAN (architecture, milestones), DECISIONS (choices and why)
```

Web and mobile both talk to the API through the same typed client in `packages/shared`, and the rules that must agree everywhere (when someone is next due, what counts as overdue, streaks) live there as tested pure functions.

## Quick start

Needs Node 20+, pnpm 10 and Docker (for PostgreSQL).

```bash
pnpm install
pnpm db:up
cp .env.example apps/api/.env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Web: http://localhost:3000 · API: http://localhost:4000 · sign in with `demo@koinonia.app` / `koinonia-demo` (admin: `admin@koinonia.app` / `koinonia-admin`).

iOS app: `pnpm dev:mobile`, then press `i`. To see the mobile UI in a browser instead: `pnpm --filter @koinonia/mobile web`.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | API + web together |
| `pnpm dev:mobile` | Expo dev server |
| `pnpm check` | lint + typecheck + all tests |
| `pnpm build` | production builds of API and web |
| `pnpm db:up` / `db:migrate` / `db:seed` | start Postgres, apply migrations, load demo data |
| `pnpm --filter @koinonia/api digest` | send the daily reminder digest once (for a cron job) |
| `pnpm --filter @koinonia/mobile export:ios` | bundle the iOS app (CI check) |

API tests need a `koinonia_test` database; `docker compose` creates it, and `TEST_DATABASE_URL` overrides the default.

## Outside services

None are required. Email (Resend), SMS (Twilio) and push (Expo) sit behind interfaces in `apps/api/src/providers` and default to mocks that log what they would send. Real email is switched on with `EMAIL_PROVIDER=resend` plus a key; SMS and push by their own keys. See `.env.example` and [docs/DEPLOY.md](docs/DEPLOY.md).
