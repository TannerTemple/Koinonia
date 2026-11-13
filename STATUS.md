# Koinonia — Status

_Last updated: end of the third unattended round (low review findings, browser runs of the account screens, contact import)._

> Everything is pushed to `claude/great-turing-vdjm45`; the open pull request against `main` includes it.

## After `git pull`, run exactly this

There is one new database migration since the last round (`login_throttle_calendar_hash`; two since the first build) and no new dependencies. Run the install anyway: it generates the Prisma client for you.

```bash
pnpm install
```

```bash
pnpm db:up
```

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

If `apps/api/.env` does not exist yet (fresh clone), create it before `pnpm db:migrate`:

```bash
cp .env.example apps/api/.env
```

`pnpm db:seed` only replaces the demo accounts (`@koinonia.app`); accounts you registered yourself are kept. Optional new setting in `.env`: `TRUST_PROXY=true`, only if the API runs behind a reverse proxy.

## What changed in this round (third)

| Step | Result |
| --- | --- |
| 1. Low review findings | All ten addressed; see the table at the end of [docs/REVIEW.md](docs/REVIEW.md). Eight are fixed outright. Two are narrowed rather than removed, because removing them changes how the app works: sign-up still says when an email is taken (now behind a 5-per-10-minutes limit), and members can still be found by name (now only by the start of a first or last name). |
| 2. Browser runs | **Web:** sign-up, staying signed in, the verification link, sign-out, forgot password, reset password (including a too-short password and a reused link), sign-in with the new password, the calendar link and account deletion all pass in a headless browser. **Mobile preview:** the confirm-email card, verifying with a pasted code (wrong code, then right code), sign-out, resetting with a pasted code, sign-in with the new password and account deletion all pass. No app bugs were found. One gap is listed below. |
| 3. Contact import | Reworked on mobile, added on web, and the duplicate matching on the server was fixed. Details below. |

**What changed for you as a user**

- **Web sign-in uses a cookie now.** You will be signed out of the web app once after pulling; sign in again. Nothing is kept in the browser's local storage any more.
- **Deleting an account asks for the password** on web and mobile.
- **The calendar link is shown once**, when you create it. Existing links keep working, but they can't be displayed again; "Make a new link" replaces the old one.
- **Existing passwords keep working.** They are re-hashed at a stronger setting the next time each person signs in.
- **Finding members by name** needs at least 3 letters and matches the start of a first or last name.

**Contact import: what was wrong and what changed**

- Any failure while reading the address book was reported as "Koinonia can't see your contacts", with a button to Settings, even when permission was fine. Failures now show what went wrong and offer "Try again"; a real refusal offers "Allow access" or "Open Settings" as appropriate.
- Contacts saved with only a first and last name, or only a company, were dropped. They are now included.
- The same person was added twice when the phone number was written differently (`+1 312 555 0112` and `312-555-0112`). Numbers are now compared by their last 10 digits.
- Two different people with the same name could not both be imported. They can now, as long as each has a phone or email to tell them apart.
- More than 500 selected people silently disabled the button. Any number can be imported now, sent in batches.
- Added: "Select all", search by phone or email, a note when iOS is sharing only some contacts, and the mobile or primary number is preferred over the first one listed.
- **New on web:** People → Import reads a vCard (.vcf) file exported from iCloud, Google Contacts or Outlook. The browser preview of the mobile app uses the same file import, since a browser has no address book.
- Checked in a browser on web and in the mobile preview with a sample file: the right people were added with phone, email, birthday and rhythm, and the one already in the list was skipped. **Reading the real iPhone address book is still untested** (it needs a device); the conversion from address-book entries is covered by unit tests.

Tests: 140 now (API 95, shared 31, mobile 14).


## What changed in the second round

| Step | Result |
| --- | --- |
| 1. Setup fix | `pnpm install` now generates the Prisma client (API `postinstall`), and `db:migrate` regenerates it. A fresh clone works with only the commands above. |
| 2. Code review | [docs/REVIEW.md](docs/REVIEW.md). Two high findings fixed (phone search leaked full numbers; sign-in limit could be bypassed and had no per-account lockout), four medium fixed. Ten low findings listed, not changed. Ownership of every endpoint confirmed and now covered by `isolation.test.ts`. |
| 3. Mobile flows | Add note, add intention, log reach-out and mark prayed all work in the browser preview, each confirmed against the API. No app bugs; the earlier failures were test selectors. |
| 4. Password reset + email verification | API, web and mobile. Tokens are stored hashed, work once, and expire (reset 1 hour, verification 3 days). "Forgot password" answers the same for any email. A reset signs out every device. Emails go through the mock (printed in the API log in development). |
| 5. Date picker | A month calendar replaces the quick choices on mobile for note follow-ups, reach-out day and "last talked". Checked in the browser preview. |
| 6. Weekly review | `GET /v1/review/weekly`; "Your week" screen on web (`/review`) and mobile, opened from the "this week" tile on Today. People reached, reach-outs, prayers, day by day, streaks, each next to the previous 7 days. |
| 7. Tests | 121 tests now (was 70): API 85, shared 26, mobile 10. New: cross-user isolation, account recovery, weekly review, login lockout, rate limits, races, input a client must not set, the shared API client, the Resend / Twilio / Expo adapters with HTTP stubbed, hashing. |

**How to try account recovery locally:** register on the web app, then look in the terminal running `pnpm dev` for `[mock email]`; it prints the confirmation link and code. "Forgot password?" on the sign-in page prints a reset link the same way.

## What's done and working

| Milestone | State | How it was verified |
| --- | --- | --- |
| 1. Scaffold | Done | `pnpm check` (lint + typecheck + tests) passes |
| 2. Backend core | Done | 95 API tests against real PostgreSQL, 31 shared-logic tests |
| 3. Web app core | Done | Production build; full flow run in a headless browser (desktop light, phone dark) with no console errors |
| 4. iOS app core | Done, see caveat | Typecheck, lint, 14 unit tests, `expo export --platform ios` succeeds; screens and the main flows run in a browser preview |
| 5. Nice-to-haves | Done (three) | Calendar feed covered by API tests; starters and birthdays seen in the browser runs |
| 6. Polish | Done | Empty, loading and error states on every screen; labels and roles on controls; README |

**Must-haves from the brief**

1. **Scheduled reminders.** Each person has their own rhythm (every 3 days, weekly, 2 or 4 weeks, any number of days, or none). Today shows overdue, due today and coming up. "Reached out" restarts the clock; snooze pushes it without pretending. Reminders reach you three ways: the Today screen, local notifications scheduled on the iPhone at 9am, and a daily server digest (email / push / optional SMS).
2. **Prayer list.** Intentions, optionally linked to a person; "people I said I'd pray for" separate from personal ones; mark prayed once a day; answered and archived; one special intention each day, chosen by you or suggested (the one that has waited longest).
3. **Personal notes.** Notes on each person, pinning, and a follow-up date ("ask how the interview went") that surfaces on Today and as a reminder.

**Also built:** email + password accounts with password reset and email verification, weekly review, admin role (web: usage stats, promote / disable members), find members by name / exact email / phone and add them, import from the phone's address book (iOS app), reach-out and prayer streaks, call / text / email shortcuts, conversation starters, birthdays, private calendar (.ics) feed, light and dark themes, account deletion.

## Stubbed, unfinished, or not verified

- **iOS app has not been run on a simulator or device** (none available here). It typechecks, bundles for iOS, and its screens and main flows (sign-in, sign-up, add person, add note, add intention, log reach-out, mark prayed, date picker, weekly review) ran in a browser preview with no errors. Expect small layout fixes on a real iPhone.
- **The mobile forgot-password screen was opened but its "Send reset email" button was not pressed in the preview.** My test picked the wrong element twice (the button's name also contains "email"), so I stopped there under the two-attempt rule. The screen renders correctly, the request behind it is covered by API tests, and the reset screen that follows it was run and works.
- **Reset and verification links open the web app.** In the iPhone app you paste the code from the same email. Opening the app straight from the email (universal links) needs a real domain and Apple setup.
- **Unverified accounts are not restricted**; they see a "Confirm your email" banner (decision 33).
- **Web and API must share a domain in production** (for example `app.example.com` and `api.example.com`, with `COOKIE_DOMAIN=.example.com`), because the web session is now a same-site cookie (decision 39). Locally nothing changes.
- **Native-only features are untested at runtime:** local notifications, reading the address book for contact import (expo-contacts), Keychain storage, haptics, the native tab bar.
- **Email, SMS and push run on mocks** that log what they would send. Real adapters for Resend, Twilio and Expo push are written but have never been called against the real services.
- **Daily digest is off by default** (`DIGEST_ENABLED=false`).
- **No Sign in with Apple / Google. No way to change your email address.**
- **Web import reads vCard (.vcf) files only**, not CSV.
- **Snooze on mobile still uses fixed choices** ("Tomorrow", "Next week"); the calendar picker covers follow-ups, reach-out day and "last talked". Birthday is still typed.
- **Admin is web only.**
- **Android** is configured but untried.

## Run it locally (fresh clone)

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

1. **Review the pull request.**
2. **Run the iOS app on a Mac**: `pnpm dev:mobile`, press `i`. Notifications and contact import need a development build rather than Expo Go: `npx expo run:ios` in `apps/mobile`, or `eas build --profile development --platform ios`.
3. **On the phone, walk the flows once** (add person, note with a follow-up date, intention, reach-out, pray, forgot password, confirm email, weekly review) and fix anything that looks off.
4. **Choose the real bundle identifier.** `com.koinonia.app` in `apps/mobile/app.json` is a placeholder; it must be one you register with Apple.
5. **Apple and EAS**: Apple Developer Program ($99/yr), `eas init` (adds the project id that push registration needs), `eas build --platform ios`, `eas submit`. App Store listing needs a privacy policy URL, screenshots, and the contacts and notifications usage answers.
6. **Host the API and database**: any Node host plus managed Postgres. Set `DATABASE_URL`, `CORS_ORIGINS`, `WEB_URL`, `API_PUBLIC_URL`; run `pnpm db:migrate`; build with `pnpm --filter @koinonia/api build`. Host the web app (for example Vercel) with `NEXT_PUBLIC_API_URL`.
7. **Keys, only when you want real delivery** (all listed in `.env.example`): `RESEND_API_KEY` + `EMAIL_FROM` for email, the three `TWILIO_*` values for SMS, `PUSH_ENABLED=true` for push, then `DIGEST_ENABLED=true`.
8. **Make yourself admin** on a real database: `UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';`

## Suggested next features

- Sign in with Apple; change email address
- Home-screen widget and lock-screen "who's due" on iOS
- Share an intention with the person you're praying for ("I prayed for you today")
- Groups (family, small group) with shared prayer lists
- Per-person reminder time; calendar picker for snooze and birthday
- CSV import on web; merge duplicates
- Liturgical touches: saint of the day, novena tracking, rosary intentions
- Weekly review as a Sunday email or push; month and year views

See [docs/PLAN.md](docs/PLAN.md), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/REVIEW.md](docs/REVIEW.md) and [README.md](README.md).
