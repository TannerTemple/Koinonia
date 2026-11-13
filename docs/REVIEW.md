# Code review

Reviewed as a senior engineer would before a first release: the whole API (`apps/api/src`), the shared
schemas and client, and how web and mobile hold credentials. Ranked by severity. "Fixed" means fixed
in this branch, with a test where one is named.

## What was checked and found sound

- **Ownership.** Every data route sits behind `authenticate` and scopes its query by the signed-in
  user's id: contacts, interactions, notes, intentions, prayer logs, daily intention, devices,
  calendar feed. Cross-links are checked too (a note or intention can only point at your own
  contact). Admin routes all sit behind `requireAdmin`. Covered by the isolation tests in
  `apps/api/test/isolation.test.ts`.
- **Validation.** Every body goes through a zod schema from `packages/shared` (unknown keys are
  dropped, lengths capped, dates and timezones checked). No raw SQL from user input.
- **Passwords.** scrypt with a per-password salt, constant-time compare, a dummy hash on unknown
  emails so timing doesn't reveal accounts. The hash never leaves the API.
- **Tokens.** 256-bit random session tokens, stored only as SHA-256; sessions expire, slide, and are
  revoked on logout, on disable, and (other sessions) on password change.

## High

| # | Finding | Status |
| --- | --- | --- |
| H1 | **Phone search leaked full phone numbers.** Searching any 7 digits matched members whose number *ended* with them and returned the whole number, so numbers could be fished out. | **Fixed**: exact number only (10+ digits also match without country code). Test in `users-admin.test.ts`. |
| H2 | **Sign-in rate limit could be sidestepped.** The only limit was 10/min per IP, and `trustProxy: true` let any client pick its own IP with an `X-Forwarded-For` header. Nothing limited guesses against one account. | **Fixed**: `TRUST_PROXY` env (off by default); per-email lockout after 8 wrong passwords for 15 minutes. Test in `auth.test.ts`. |

## Medium

| # | Finding | Status |
| --- | --- | --- |
| M1 | **Races surfaced as 500s.** Two "prayed" taps at once, or two sign-ups with one email, hit a unique index and returned "Something went wrong". Rows deleted mid-request did the same. | **Fixed**: the error handler maps Prisma unique-violation to 409 and missing-row to 404. |
| M2 | **No way back into an account** (no password reset) and unverified emails. | **Fixed** in step 4 of this round (reset + verification). A reset signs out every session. |
| M3 | **Expired sessions were never deleted**, so the table only grew. | **Fixed**: a user's expired sessions are purged when they sign in. |
| M4 | **Unbounded search strings** on contact, member and admin search. | **Fixed**: capped. |

## Low (fixed in the third round)

| # | Finding | What was done |
| --- | --- | --- |
| L1 | Sign-up answers "already registered" for a known email. | **Mitigated, not removed.** Sign-up is now limited to 5 tries per 10 minutes per address, so checking many emails is impractical. Removing it entirely means not signing people in until they confirm their email, which was decided against (decision 33). |
| L2 | Deleting your account needed only a valid session. | **Fixed**: `DELETE /me` requires the password; both apps ask for it. |
| L3 | The login lockout lived in memory. | **Fixed**: stored in the database (`LoginThrottle`), so every API instance enforces it. |
| L4 | Web kept the session token in `localStorage`. | **Fixed**: the web app signs in with an httpOnly, SameSite=Lax cookie that scripts cannot read. The API only honours the cookie together with a custom header, which blocks cross-site request forgery. The iOS app still uses a token in the Keychain. |
| L5 | Push tokens stayed registered after sign-out. | **Fixed**: sign-out unregisters the phone's push token; disabling an account removes its devices. |
| L6 | Logging a reach-out was three writes without a transaction. | **Fixed**: logging and removing a reach-out each run in one transaction. |
| L7 | The digest loaded every user each tick and marked the day before sending. | **Fixed**: users are read 200 at a time, and the day is only marked once the email was sent, so a failed send is retried. |
| L8 | Calendar feed secret sat in the database unhashed and in access logs. | **Fixed**: only a SHA-256 is stored and the link is shown once, when created; the request log redacts it. It is still part of the URL, which calendar subscriptions require. |
| L9 | scrypt used Node's default cost (N=2^14). | **Fixed**: N=2^17 (the OWASP minimum), recorded in each hash; older hashes are upgraded at the next sign-in. |
| L10 | Member name search let any signed-in user browse discoverable names. | **Tightened**: at least 3 letters, matching only the start of a first or last name, 5 results. Finding people by name still exists by design (decision 13); users can switch discoverability off. |

# Second pass: running on the public internet

A separate review of what changes once the API, database and web app are hosted: who can reach
them, what the host's logs keep, and what a mistake in configuration would expose. "Fixed" means
fixed in this branch; tests are in `apps/api/test/hardening.test.ts` unless another file is named.

## Fixed

| # | Area | Finding | What was done |
| --- | --- | --- | --- |
| S1 | Logs | Request logs recorded full URLs, including search terms: `/users/search?q=someone@example.com`, `/contacts?q=Grandma`. Hosts keep logs for weeks. | Only the path is logged; query strings and the calendar secret never are. |
| S2 | Logs | Unexpected errors were logged whole. Database errors can quote the values of the failed query (emails, names). | Errors are reduced to type, code and a scrubbed first line (`safeError`): emails, long tokens and phone-like numbers are replaced. No stack traces. |
| S3 | Logs | The digest job (`pnpm digest`) printed every email it sent, in any environment; email-provider errors could echo the recipient. | Mock providers print only outside production. Email errors carry status and error type only (`resend.test.ts`). |
| S4 | CORS | `CORS_ORIGINS` was not validated. A `*`, a trailing slash or a typo would silently either break the web app or mean something unintended. | The API refuses to start unless it is a list of plain origins; never `*`. Preflight is answered only for listed origins (tested). |
| S5 | Configuration | Nothing flagged settings that work locally but are wrong when public. | At start in production the API logs a warning for: localhost or `http://` in `CORS_ORIGINS` / `WEB_URL`, `TRUST_PROXY` off or `true`, mock email, missing `API_PUBLIC_URL`. |
| S6 | Rate limits | `TRUST_PROXY` was on/off. On a host, "off" gives every visitor the proxy's address (one shared limit); "on" lets a client choose its own address. | It is now a hop count (`TRUST_PROXY=1`); a made-up forwarded address is ignored (tested). Health checks are exempt from limits. |
| S7 | Rate limits | Bulk import and the calendar file had only the general limit. | Import: 20 a minute. Calendar file: 60 a minute. Sign-up: 5 per 10 minutes. Sign-in, reset, verify: 10 a minute. Everything else: 300 a minute. |
| S8 | Abuse | "Forgot password" and "resend confirmation" could be called repeatedly to flood someone's inbox. | One email of each kind per account per minute; the caller gets the same answer either way (`account-recovery.test.ts`). This also closed a race the new test found. |
| S9 | Caching | API answers carried no caching instruction. With a proxy or CDN in front, personal data must never be stored along the way. | Every `/v1` response is `Cache-Control: no-store` (the calendar file keeps its own private setting). |
| S10 | Web | The web app sent no security headers. | Production builds send a Content-Security-Policy (scripts and fonts only from the site; data only to the site and the API; no framing; forms post only to the site), HSTS, `nosniff`, `X-Frame-Options: DENY`, a restrictive Permissions-Policy, and `Referrer-Policy: same-origin`. Checked by running the whole account flow against a production build with violation reporting on: none. |
| S11 | Web | Password-reset and email-confirmation links carry a one-time secret in the address. It stayed in the address bar and history, and could leak in a referrer. | Those two pages send no referrer and are not cached; the secret is removed from the address bar as soon as it is read. |
| S12 | Privacy | Anyone could sign up with someone else's email address and then be found under it in member search. | Search by email matches confirmed addresses only. |
| S13 | Secrets | The Docker image could have picked up a local `.env`. | `.dockerignore` excludes every `.env*`; the image runs as a non-root user; nothing secret is written at build time. |
| S14 | Data | Running the seed against production would create demo accounts with published passwords. | The seed refuses when `NODE_ENV=production`. |
| S15 | Availability | The largest request body was whatever the framework allowed. | Capped at 512 KB (a 500-person import is far smaller). |

## Checked and sound

- **Secrets in the repository:** none. `.env` files are git-ignored; `.env.example` holds
  placeholders only. The only passwords in the code are the two demo accounts in the seed.
- **Secrets in responses or logs:** password hashes, session tokens, reset tokens and the calendar
  secret are never returned (the calendar link once, to its owner) and never logged. The API never
  prints its environment.
- **Cookie:** `HttpOnly`, `SameSite=Lax`, and `Secure` whenever `NODE_ENV=production`. Honoured only
  together with a custom header, so another site cannot forge requests.
- **Database access:** every query goes through Prisma with parameters; there is no string-built
  SQL from user input.
- **Dependencies:** `pnpm audit --prod` reports two advisories, both in build tooling inside the
  Expo toolchain (`minimatch` under `@expo/fingerprint`). Neither is in the API or in anything
  that runs on a server or ships to users.

## Left as is, with reasons

| # | Item | Why |
| --- | --- | --- |
| R1 | The Content-Security-Policy allows inline scripts. | Next.js needs them without per-request nonces, which would make every page dynamic. The policy still blocks loading scripts from elsewhere and sending data elsewhere. |
| R2 | Rate limits are counted in memory, per API instance. | Correct for one instance. With several, each counts separately; move the counter to Redis then. The per-account sign-in lockout is already in the database. |
| R3 | With the web proxy (DEPLOY.md), web visitors share rate-limit buckets per proxy server address. | Inherent to proxying. A custom domain (Option B) removes it. Account lockout does not depend on addresses. |
| R4 | Someone who knows your email can lock your sign-in for 15 minutes by guessing wrong 8 times. | The usual cost of a lockout. A password reset lifts it immediately. |
| R5 | Request logs include the visitor's IP address. | Needed to investigate abuse. It is disclosed in the privacy policy; retention is the host's. |
| R6 | Reset and confirmation links pass through the web host's own access logs. | Unavoidable for emailed links. They work once and expire (1 hour / 3 days). |
| R7 | Data is not end-to-end encrypted; whoever operates the database can read it. | Server-side reminders and search need readable data. Stated plainly in the privacy policy. Use the host's encryption at rest (Neon has it by default) and limit who has dashboard access. |
| R8 | No automated alerting. | Use the host's alerts on `/health/ready` and on 5xx rates. |

## For the person deploying

1. Set `TRUST_PROXY=1`, `CORS_ORIGINS` and `WEB_URL` exactly as in DEPLOY.md, then read the first
   lines of the API log after a deploy: any warning there is a setting to fix.
2. Turn on two-factor sign-in for GitHub, Neon, Render, Vercel, Resend, Expo and Apple. Those
   accounts are now the keys to everyone's data.
3. Give dashboard access to as few people as possible; database and log access is access to
   personal data.
4. Never paste `DATABASE_URL`, `RESEND_API_KEY` or `CRON_SECRET` into chat, email or a commit. If one
   leaks, rotate it in the provider's dashboard and update the host's environment.
5. The iPhone app must be given an `https://` API address; iOS blocks plain `http://`.
