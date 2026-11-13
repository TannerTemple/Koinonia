# Koinonia — Status

_Last updated: end of the fourth unattended round (deployment readiness, real email adapter, legal pages, App Store guide, hosted security pass)._

> Everything is pushed to `claude/great-turing-vdjm45`; the open pull request against `main` includes it.

## After `git pull`, run exactly this

No new database migration and no new dependencies this round. Run the install anyway (it regenerates the Prisma client; the schema gained a second connection setting). Your local `apps/api/.env` needs no changes: `DIRECT_URL` defaults to `DATABASE_URL`.

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

## What changed in this round (fourth)

| Step | Result |
| --- | --- |
| 1. Deployment readiness | [docs/DEPLOY.md](docs/DEPLOY.md): click-by-click for **Neon + Render + Vercel**, with every environment variable and which service it goes in. `apps/api/Dockerfile`, `render.yaml` (Docker web service, Starter, health check, auto-deploy), health checks (`/health`, and `/health/ready` which also checks the database), and Prisma now takes a pooled `DATABASE_URL` plus a direct `DIRECT_URL` for migrations. |
| 2. Real email | Resend adapter behind `EMAIL_PROVIDER=resend`; mock stays the default. Retries temporary failures, times out, never retries a rejected request, and its errors contain no recipient or message. With the switch on, a missing key or placeholder sender stops the API at start. `pnpm --filter @koinonia/api email:test you@example.com` sends one message through whatever is configured. |
| 3. Privacy policy and terms | Draft pages at `/privacy` and `/terms`, linked from sign-up, Settings and the iPhone app. They describe what the code actually does with contacts, notes and prayer intentions, and how account deletion works. |
| 4. App Store guide | [docs/APP_STORE.md](docs/APP_STORE.md): checklist, listing copy (within Apple's length limits), App Privacy answers, review notes, and the EAS build, submit and TestFlight commands. `apps/mobile/eas.json` added; app version set to 1.0.0. |
| 5. Hosted security pass | Fifteen findings fixed, eight left with reasons: second half of [docs/REVIEW.md](docs/REVIEW.md). Main ones below. |

**Hosted security pass, the main fixes**

- **Logs:** request logs recorded search terms (`/users/search?q=someone@example.com`). They now hold the path only, and errors are reduced to a scrubbed one-line summary.
- **CORS:** `CORS_ORIGINS` is validated when the API starts; a `*`, a path or a typo stops the deploy with a clear message.
- **Wrong-for-production settings** (localhost addresses, proxy trust off, mock email) are listed as warnings at the top of the API log.
- **Rate limits:** `TRUST_PROXY` is now a hop count (`1` on Render), so limits work per visitor and a made-up forwarded address is ignored.
- **Inbox flooding:** one reset email and one confirmation email per account per minute. The test for this found and fixed a race.
- **Web headers:** Content-Security-Policy, HSTS and related headers in production builds; the whole web account flow was re-run against a production build with no violations.
- **One-time links:** reset and confirmation pages send no referrer, are not cached, and remove the secret from the address bar.
- **Member search by email** only finds confirmed addresses.

**One thing to know about hosting.** On Vercel, `NEXT_PUBLIC_API_URL` is `/api`, not the Render address. The web app forwards `/api/*` to Render (`API_PROXY_TARGET`), because a browser will not keep a sign-in cookie between a `vercel.app` site and an `onrender.com` site. DEPLOY.md explains it where the variable is listed, and how to drop the forwarding if you use your own domain.

Tests: 164 now (API 119 plus 2 opt-in live email tests that are skipped by default, shared 31, mobile 14).


## What changed in the third round

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
| 2. Backend core | Done | 119 API tests against real PostgreSQL, 31 shared-logic tests |
| 3. Web app core | Done | Production build; full flow run in a headless browser (desktop light, phone dark) with no console errors |
| 4. iOS app core | Done, see caveat | Typecheck, lint, 14 unit tests, `expo export --platform ios` succeeds; screens and the main flows run in a browser preview |
| 5. Nice-to-haves | Done (three) | Calendar feed covered by API tests; starters and birthdays seen in the browser runs |
| 6. Polish | Done | Empty, loading and error states on every screen; labels and roles on controls; README |

**Must-haves from the brief**

1. **Scheduled reminders.** Each person has their own rhythm (every 3 days, weekly, 2 or 4 weeks, any number of days, or none). Today shows overdue, due today and coming up. "Reached out" restarts the clock; snooze pushes it without pretending. Reminders reach you three ways: the Today screen, local notifications scheduled on the iPhone at 9am, and a daily server digest (email / push / optional SMS).
2. **Prayer list.** Intentions, optionally linked to a person; "people I said I'd pray for" separate from personal ones; mark prayed once a day; answered and archived; one special intention each day, chosen by you or suggested (the one that has waited longest).
3. **Personal notes.** Notes on each person, pinning, and a follow-up date ("ask how the interview went") that surfaces on Today and as a reminder.

**Also built:** email + password accounts with password reset and email verification, weekly review, privacy and terms pages, deployment files and guides, admin role (web: usage stats, promote / disable members), find members by name / exact email / phone and add them, import from the phone's address book (iOS app), reach-out and prayer streaks, call / text / email shortcuts, conversation starters, birthdays, private calendar (.ics) feed, light and dark themes, account deletion.

## Stubbed, unfinished, or not verified

- **iOS app has not been run on a simulator or device** (none available here). It typechecks, bundles for iOS, and its screens and main flows (sign-in, sign-up, add person, add note, add intention, log reach-out, mark prayed, date picker, weekly review) ran in a browser preview with no errors. Expect small layout fixes on a real iPhone.
- **The mobile forgot-password screen was opened but its "Send reset email" button was not pressed in the preview.** My test picked the wrong element twice (the button's name also contains "email"), so I stopped there under the two-attempt rule. The screen renders correctly, the request behind it is covered by API tests, and the reset screen that follows it was run and works.
- **Reset and verification links open the web app.** In the iPhone app you paste the code from the same email. Opening the app straight from the email (universal links) needs a real domain and Apple setup.
- **Unverified accounts are not restricted**; they see a "Confirm your email" banner (decision 33).
- **Nothing has been deployed.** DEPLOY.md and `render.yaml` have not been followed on real Neon, Render or Vercel accounts (none may be created here). `render.yaml` was checked for valid syntax only. A pooled Neon connection has not been tried.
- **The Docker image was not built.** Two attempts failed at `apt-get` because the build environment blocks Debian's package mirrors. The same steps (clean filtered install, build, migrations through `DIRECT_URL`, production start, both health checks) were run successfully outside Docker.
- **The Resend adapter has never talked to Resend.** It is covered by 9 tests with the network stubbed; the build environment cannot reach api.resend.com. Run the opt-in live test (command at the top of `apps/api/test/resend.test.ts`) or `email:test` once you have a key.
- **The privacy policy and terms are drafts, not legal advice.** They show a "Draft" banner and [BRACKETED] placeholders (operator name, contact address, governing law, hosting region, backup retention, liability cap) until you fill in `apps/web/src/lib/legal.ts`, have them reviewed, and set `LEGAL_DRAFT = false`.
- **No EAS build or App Store submission has been made.** `eas.json` and the commands in APP_STORE.md are untested, and `eas.json` holds placeholder server addresses.
- **Screen labels on Neon, Render, Vercel, Resend, Expo and App Store Connect are from memory** and change often; prices and free-tier terms too.
- **Native-only features are untested at runtime:** local notifications, reading the address book for contact import (expo-contacts), Keychain storage, haptics, the native tab bar.
- **Email, SMS and push run on mocks by default.** Email switches to Resend with `EMAIL_PROVIDER=resend`. The Twilio and Expo push adapters are written and unit-tested with the network stubbed, but have never been called for real.
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

1. **Merge the pull request** (or deploy its branch).
2. **Deploy** by following [docs/DEPLOY.md](docs/DEPLOY.md) top to bottom: Neon, then Render, then Vercel, then real email. About an hour the first time. Tell me where a step did not match what you saw and I will correct the guide.
3. **Finish the legal pages**: fill in `apps/web/src/lib/legal.ts`, get them reviewed, set `LEGAL_DRAFT = false`.
4. **Ship to TestFlight** by following [docs/APP_STORE.md](docs/APP_STORE.md): choose the real bundle identifier, put the server addresses in `apps/mobile/eas.json`, `eas init`, build, submit.
5. **On the phone, walk the flows once** (the list is in APP_STORE.md) and send me anything that looks off. The iPhone app has still never run on a device.
6. **Turn on two-factor sign-in** on GitHub, Neon, Render, Vercel, Resend, Expo and Apple before real people's data is in there.

## Suggested next features

- Sign in with Apple; change email address
- Home-screen widget and lock-screen "who's due" on iOS
- Share an intention with the person you're praying for ("I prayed for you today")
- Groups (family, small group) with shared prayer lists
- Per-person reminder time; calendar picker for snooze and birthday
- CSV import on web; merge duplicates
- Liturgical touches: saint of the day, novena tracking, rosary intentions
- Weekly review as a Sunday email or push; month and year views

See [docs/PLAN.md](docs/PLAN.md), [docs/DECISIONS.md](docs/DECISIONS.md), [docs/REVIEW.md](docs/REVIEW.md), [docs/DEPLOY.md](docs/DEPLOY.md), [docs/APP_STORE.md](docs/APP_STORE.md) and [README.md](README.md).
