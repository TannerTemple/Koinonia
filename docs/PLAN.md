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

- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /me`, `PATCH /me`, `DELETE /me`
- Home: `GET /home` — overdue / due today / upcoming, follow-ups, today's intention, streaks
- Contacts: `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id`, `POST /contacts/import`,
  `POST /contacts/:id/reach-out`, `POST /contacts/:id/snooze`, `GET /contacts/:id/interactions`
- Notes: `GET/POST /contacts/:id/notes`, `PATCH/DELETE /notes/:id`
- Prayer: `GET/POST /intentions`, `PATCH/DELETE /intentions/:id`, `POST /intentions/:id/pray`,
  `GET /prayer/today`, `PUT /prayer/today`
- People lookup: `GET /users/search?q=` (name / email / phone), add a found user as a linked contact
- Devices: `POST /devices`
- Admin: `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/users/:id`
- Calendar (nice-to-have): `GET /calendar.ics?token=`

## Screens

| Screen | Web route | Mobile route |
| --- | --- | --- |
| Sign in / Sign up | `/login`, `/register` | `/(auth)/login`, `/(auth)/register` |
| Today (home): overdue, due, upcoming, follow-ups, today's intention, streaks | `/` | `/(tabs)/` |
| People list + search/filter | `/people` | `/(tabs)/people` |
| Add / edit person (cadence picker) | `/people/new`, `/people/[id]/edit` | `/contact/new`, `/contact/[id]/edit` |
| Person detail: contact info, quick actions (call/text/email), log reach-out, snooze, notes, linked intentions, history | `/people/[id]` | `/contact/[id]` |
| Import from phone contacts | — (manual add) | `/contact/import` |
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
- [ ] Design system (Marian blue / forest, light + dark)
- [ ] Auth pages, app shell (responsive)
- [ ] Today, People, Person detail, Add/Edit, Prayer, Settings, Admin, Find people
- [ ] Production build passes

### 4. iOS app core
- [ ] Expo app, theme, auth with secure token storage
- [ ] Tabs: Today, People, Prayer, Profile
- [ ] Person detail, add/edit, notes, reach-out, snooze
- [ ] Import from device contacts
- [ ] Local notifications for due reach-outs
- [ ] Typecheck, lint, `expo export` for iOS succeeds

### 5. Nice-to-haves
- [ ] Calendar feed (.ics) of upcoming reach-outs
- [ ] Message templates / share invite
- [ ] Birthdays on Today

### 6. Polish
- [ ] Empty / loading / error states
- [ ] Accessibility pass
- [ ] README, final STATUS
