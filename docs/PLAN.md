# Koinonia — Build Plan

Requirements live in [BRIEF.md](./BRIEF.md). Decisions are logged in [DECISIONS.md](./DECISIONS.md).

## Product in one paragraph

Koinonia helps busy people keep the relationships they mean to keep. You add people, give each a
reach-out rhythm (every 3 days, weekly, every 2 or 4 weeks, anything), and the app tells you who is
due, overdue or coming up. Each person carries notes (what to ask about, when to follow up) and can
be linked to prayer intentions. A prayer page lists who you promised to pray for, lets you mark
prayers prayed, and picks (or lets you choose) one special intention for each day. Streaks reward
showing up.

## Architecture

```
koinonia/
├─ apps/
│  ├─ api/      Fastify REST API · Prisma · PostgreSQL · session-token auth · Vitest
│  ├─ web/      Next.js (App Router) · Tailwind · TanStack Query
│  └─ mobile/   Expo (React Native) · Expo Router · TanStack Query · iOS first
├─ packages/
│  └─ shared/   zod schemas · TS types · typed API client · cadence/streak logic · design tokens
└─ docs/        BRIEF · PLAN · DECISIONS
```

- **One source of truth for contracts**: `packages/shared` holds zod schemas. The API validates
  with them, the client is typed from them, web and mobile both call the same `createApiClient()`.
- **Business logic that must agree everywhere** (next-due date, due status, streaks) is pure
  functions in `packages/shared`, unit tested once.
- **API layering**: `routes/*` (HTTP + validation) → `services/*` (logic) → Prisma. Outside services
  (email, SMS, push) sit behind interfaces in `apps/api/src/providers` with console/in-memory mocks.
- **Auth**: email + password (scrypt), opaque bearer session tokens stored hashed in the DB,
  revocable, 30-day sliding expiry. Roles: `USER`, `ADMIN`.
- **Reminders**: three layers — (1) the home screen is always computed live from due dates,
  (2) the iOS app schedules local notifications on the device for each due date,
  (3) the API runs a daily digest job through the mock email/SMS/push providers.

## Data model

| Entity | Key fields |
| --- | --- |
| **User** | email, passwordHash, name, phone?, role, timezone, discoverable, digestEnabled, disabledAt |
| **Session** | tokenHash, userId, expiresAt, lastUsedAt |
| **Contact** | userId, name, phone?, email?, relationship?, birthday?, cadenceDays?, preferredChannel, lastContactedAt?, nextDueAt?, snoozedUntil?, linkedUserId?, archivedAt? |
| **Interaction** | contactId, userId, channel, summary?, occurredAt — a logged reach-out |
| **Note** | contactId, userId, body, pinned, followUpAt? — "what / when to reach out" |
| **PrayerIntention** | userId, contactId? (linked person), title, details?, kind (PROMISED / PERSONAL / THANKSGIVING), status (ACTIVE / ANSWERED / ARCHIVED), prayedCount, lastPrayedAt?, answeredAt? |
| **PrayerLog** | intentionId, userId, day (YYYY-MM-DD in user's timezone) |
| **DailyIntention** | userId, day, intentionId, chosenByUser — the special intention of the day |
| **PushDevice** | userId, token, platform |

Streaks (reach-out streak, prayer streak) are derived from Interaction / PrayerLog days — no
counters to drift.

## API surface (all JSON, `/v1`)

- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `GET /me`, `PATCH /me`, `DELETE /me`
- Home: `GET /home` — overdue / due today / upcoming, follow-ups, today's intention, streaks
- Weekly review: `GET /review/weekly` — last 7 days next to the 7 before
- Contacts: `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id`, `POST /contacts/import`,
  `POST /contacts/:id/reach-out`, `POST /contacts/:id/snooze`, `GET /contacts/:id/interactions`
- Notes: `GET/POST /contacts/:id/notes`, `PATCH/DELETE /notes/:id`
- Prayer: `GET/POST /intentions`, `PATCH/DELETE /intentions/:id`, `POST /intentions/:id/pray`,
  `GET /prayer/today`, `PUT /prayer/today`
- People lookup: `GET /users/search?q=` (name / email / phone), add a found user as a linked contact
- Devices: `POST /devices`
- Admin: `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/:id`
- Calendar (nice-to-have): `GET /calendar.ics?token=`
- Export: `GET /me/export` (JSON), `GET /me/export/<table>.csv`

## Screens

| Screen | Web route | Mobile route |
| --- | --- | --- |
| Sign in / Sign up | `/login`, `/register` | `/(auth)/login`, `/(auth)/register` |
| Today (home): overdue, due, upcoming, follow-ups, today's intention, streaks | `/` | `/(tabs)/` |
| People list + search/filter | `/people` | `/(tabs)/people` |
| Add / edit person (cadence picker) | `/people/new`, `/people/[id]/edit` | `/contact/new`, `/contact/[id]/edit` |
| Person detail: contact info, quick actions (call/text/email), log reach-out, snooze, notes, linked intentions, history | `/people/[id]` | `/contact/[id]` |
| Import contacts | `/people/import` (vCard file) | `/contact/import` (address book) |
| Find people on Koinonia | `/people/find` | `/contact/find` |
| Prayer: today's intention, promised list, pray/answer, add | `/prayer` | `/(tabs)/prayer` |
| Profile & settings: streaks, timezone, reminders, theme, sign out | `/settings` | `/(tabs)/profile` |
| Admin: stats + users | `/admin` | — (web only) |

## Milestones

### 1. Scaffold
- [x] Docs: BRIEF, PLAN, DECISIONS, STATUS
- [x] pnpm workspace, shared tsconfig, ESLint, Prettier, Vitest
- [x] Root commands: `pnpm dev`, `pnpm check` (lint + typecheck + test)
- [x] `.env.example`

### 2. Backend core
- [x] Prisma schema + migration (PostgreSQL)
- [x] Shared schemas, cadence + streak logic (unit tested)
- [x] Auth (register / login / logout / me), roles
- [x] Contacts, reach-outs, snooze, import
- [x] Notes with follow-up dates
- [x] Prayer intentions, pray log, daily intention
- [x] Home endpoint, user search, admin
- [x] Provider interfaces + mocks (email, SMS, push), daily digest job
- [x] Seed script with demo data
- [x] Tests for each endpoint

### 3. Web app core
- [x] Design system (Marian blue / forest, light + dark)
- [x] Auth pages, app shell (responsive)
- [x] Today, People, Person detail, Add/Edit, Prayer, Settings, Admin, Find people
- [x] Production build passes

### 4. iOS app core
- [x] Expo app, theme, auth with secure token storage
- [x] Tabs: Today, People, Prayer, Profile
- [x] Person detail, add/edit, notes, reach-out, snooze
- [x] Import from device contacts
- [x] Local notifications for due reach-outs
- [x] Typecheck, lint, `expo export` for iOS succeeds

### 5. Nice-to-haves
- [x] Calendar feed (.ics) of upcoming reach-outs
- [x] Conversation starters and invite sharing
- [x] Birthdays on Today

### 6. Polish
- [x] Empty / loading / error states
- [x] Accessibility pass
- [x] README, final STATUS

### 7. Second round
- [x] Fresh clone works with only the documented commands (Prisma client generated on install)
- [x] Code review (`docs/REVIEW.md`); high and medium findings fixed
- [x] Four mobile flows verified
- [x] Password reset and email verification (API, web, mobile; mock email)
- [x] Calendar date picker on mobile
- [x] Weekly review (`GET /review/weekly`, web `/review`, mobile `/review`)
- [x] Tests for isolation, recovery, review, client, providers, hardening

### 8. Third round
- [x] Ten low review findings addressed (see `docs/REVIEW.md`)
- [x] Web and mobile account screens run in a browser
- [x] Contact import reworked on mobile, added on web (`/people/import`), duplicate matching fixed

### 9. Fourth round
- [x] Deployment: Dockerfile, `render.yaml`, health checks, `DIRECT_URL`, `docs/DEPLOY.md` (Neon + Render + Vercel)
- [x] Resend email adapter behind `EMAIL_PROVIDER`
- [x] Draft privacy policy and terms (`/privacy`, `/terms`)
- [x] `docs/APP_STORE.md` and `apps/mobile/eas.json`
- [x] Hosted-environment security pass (second half of `docs/REVIEW.md`)

### 10. Fifth round
- [x] End-to-end walkthrough on web and the mobile preview; findings in `docs/BUGS.md`, fixed
- [x] Today rebuilt around two sections, "Reach out" and "Pray"; getting-started card for new accounts
- [x] Shorter forms, plain wording, worded buttons, larger web text, better empty states

### 11. Sixth round
- [x] iPhone reminders: per-person time, re-planned on change, tap opens the person, badge, permission after an explanation
- [x] Expo push behind `PUSH_PROVIDER`; Resend already behind `EMAIL_PROVIDER`
- [x] First-run welcome on web and mobile
- [x] Export (JSON and CSV); deletion verified table by table
- [x] Write rate limits, optional Sentry, indexes, pagination
- [x] Mobile timeouts, retries, offline notice, drafts
- [x] People list filters, favorites, groups
- [x] CI workflow (passing on GitHub)
- [x] `docs/TEST_ON_PHONE.md`; icon and splash requirements in `docs/APP_STORE.md`

### 12. Seventh round
- [x] Startup checks in plain English; three values on Render, one on Vercel; API-only Docker install
- [x] `pnpm smoke`, `pnpm make-admin`, `pnpm db:seed:prod`
- [x] `docs/TONIGHT.md`
- [x] iPhone file export, drafts for person and reach-out forms, web reminder time, CI once per change
- [x] Feedback screen (web and mobile), Admin > Feedback, optional `FEEDBACK_EMAIL`
- [x] Fresh-clone first-run pass

### 13. Eighth round
- [x] Azure guide and web Dockerfile
- [x] Admin beta metrics (counts only)
- [x] Public /beta page, consented invite list, invite a friend, docs/BETA.md
- [x] brand.json: one-place naming, rename check
- [x] Retention merged, each feature behind FEATURES_OFF
- [x] Security review 2 (docs/REVIEW2.md)
- [x] Sign in with Google, Microsoft, Apple (off by default)
- [x] Legal pages finished as drafts with highlighted blanks
