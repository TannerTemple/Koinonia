# Koinonia — Status

_Last updated: end of the unattended build (all six milestones)._

> **Not pushed yet.** This session only had read access to GitHub: every `git push` (and the GitHub API) returned 403, so the work is committed locally on `claude/great-turing-vdjm45` and no pull request could be opened. Fix: install the Claude GitHub App on `TannerTemple/Koinonia` (or reconnect GitHub in claude.ai settings), then ask the session to push and open the PR.

## What's done and working

| Milestone | State | How it was verified |
| --- | --- | --- |
| 1. Scaffold | Done | `pnpm check` (lint + typecheck + tests) passes |
| 2. Backend core | Done | 47 endpoint tests against real PostgreSQL, 17 shared-logic tests |
| 3. Web app core | Done | Production build; full flow run in a headless browser (desktop light, phone dark) with no console errors |
| 4. iOS app core | Done, see caveat | Typecheck, lint, 6 unit tests, `expo export --platform ios` succeeds; screens run in a browser preview |
| 5. Nice-to-haves | Done (three) | Calendar feed covered by API tests; starters and birthdays seen in the browser runs |
| 6. Polish | Done | Empty, loading and error states on every screen; labels and roles on controls; README |

**Must-haves from the brief**

1. **Scheduled reminders.** Each person has their own rhythm (every 3 days, weekly, 2 or 4 weeks, any number of days, or none). Today shows overdue, due today and coming up. "Reached out" restarts the clock; snooze pushes it without pretending. Reminders reach you three ways: the Today screen, local notifications scheduled on the iPhone at 9am, and a daily server digest (email / push / optional SMS).
2. **Prayer list.** Intentions, optionally linked to a person; "people I said I'd pray for" separate from personal ones; mark prayed once a day; answered and archived; one special intention each day, chosen by you or suggested (the one that has waited longest).
3. **Personal notes.** Notes on each person, pinning, and a follow-up date ("ask how the interview went") that surfaces on Today and as a reminder.

**Also built:** email + password accounts, admin role (web: usage stats, promote / disable members), find members by name / exact email / phone and add them, import from the phone's address book (iOS app), reach-out and prayer streaks, call / text / email shortcuts, conversation starters, birthdays, private calendar (.ics) feed, light and dark themes, account deletion.

## Stubbed, unfinished, or not verified

- **iOS app has not been run on a simulator or device** (none available here). It typechecks, bundles for iOS, and its screens were run in a browser preview: sign-in, all four tabs, person detail, sign-up, and adding a person all worked with no errors. The automated run of the remaining steps in that preview (add note, add intention, log reach-out, pray) was stopped because the test's selectors kept hitting hidden stacked screens — a test problem, not an observed app bug — so **those four mobile flows are unverified at runtime**. They call the same API endpoints the web app exercises successfully. Expect small layout fixes on a real iPhone.
- **Native-only features are untested at runtime:** local notifications, contact import (expo-contacts), Keychain storage, haptics, the native tab bar.
- **Email, SMS and push run on mocks** that log what they would send. Real adapters for Resend, Twilio and Expo push are written but have never been called against the real services.
- **Daily digest is off by default** (`DIGEST_ENABLED=false`).
- **No password reset, no email verification, no Sign in with Apple / Google.**
- **Web has no address-book import** (manual add, or use the iOS app).
- **Dates on mobile use quick choices** ("Tomorrow", "Next week", "~2 weeks ago") instead of a calendar picker.
- **Admin is web only.**
- **Android** is configured but untried.

## Run it locally

Needs Node 20+, pnpm 10, and PostgreSQL 16 (Docker is the easy way).

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
cp .env.example apps/api/.env
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

API on :4000 and web on :3000 together:

```bash
pnpm dev
```

iOS app (in a second terminal; press `i` for the simulator, or scan the QR code with a development build):

```bash
pnpm dev:mobile
```

Mobile UI in a browser, no Xcode needed:

```bash
pnpm --filter @koinonia/mobile web
```

Everything that guards a commit:

```bash
pnpm check
```

Demo sign-ins after seeding: `demo@koinonia.app` / `koinonia-demo` and `admin@koinonia.app` / `koinonia-admin`.

On a physical phone, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your computer's LAN address (for example `http://192.168.1.20:4000`).

## What you need to do next

1. **Give the session push access**, push the branch, open the PR, review it.
2. **Run the iOS app on a Mac**: `pnpm dev:mobile`, press `i`. Notifications and contact import need a development build rather than Expo Go: `npx expo run:ios` in `apps/mobile`, or `eas build --profile development --platform ios`.
3. **Walk the four unverified mobile flows** (add note, add intention, log reach-out, pray) and fix anything that looks off.
4. **Choose the real bundle identifier.** `com.koinonia.app` in `apps/mobile/app.json` is a placeholder; it must be one you register with Apple.
5. **Apple and EAS**: Apple Developer Program ($99/yr), `eas init` (adds the project id that push registration needs), `eas build --platform ios`, `eas submit`. App Store listing needs a privacy policy URL, screenshots, and the contacts and notifications usage answers.
6. **Host the API and database**: any Node host plus managed Postgres. Set `DATABASE_URL`, `CORS_ORIGINS`, `WEB_URL`, `API_PUBLIC_URL`; run `pnpm db:migrate`; build with `pnpm --filter @koinonia/api build`. Host the web app (for example Vercel) with `NEXT_PUBLIC_API_URL`.
7. **Keys, only when you want real delivery** (all listed in `.env.example`): `RESEND_API_KEY` + `EMAIL_FROM` for email, the three `TWILIO_*` values for SMS, `PUSH_ENABLED=true` for push, then `DIGEST_ENABLED=true`.
8. **Make yourself admin** on a real database: `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`

## Suggested next features

- Password reset and email verification; Sign in with Apple
- Home-screen widget and lock-screen "who's due" on iOS
- Share an intention with the person you're praying for ("I prayed for you today")
- Groups (family, small group) with shared prayer lists
- Calendar date picker on mobile; per-person reminder time
- Import on web (vCard / CSV); merge duplicates
- Liturgical touches: saint of the day, novena tracking, rosary intentions
- Weekly review ("you reached 9 people this week")

See [docs/PLAN.md](docs/PLAN.md), [docs/DECISIONS.md](docs/DECISIONS.md) and [README.md](README.md).
