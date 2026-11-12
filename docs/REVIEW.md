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

## Low (not changed; listed so they are known)

| # | Finding | Why it was left |
| --- | --- | --- |
| L1 | Sign-up answers "already registered" for a known email. | Standard trade-off for sign-up that signs you straight in; it is rate-limited. Reset and verification never reveal it. |
| L2 | Deleting your account needs only a valid session, not the password. | Wants a small UI change on both clients; worth doing before launch. |
| L3 | The login lockout lives in memory. | Correct for one API instance. Move to the database or Redis when there are several. |
| L4 | Web keeps the session token in `localStorage`. | Readable by any injected script. Acceptable with no third-party scripts; an httpOnly cookie is the stronger design if the web app grows. |
| L5 | Push tokens stay registered after sign-out. | A signed-out phone could still get that account's digest push. Remove the device on logout once push is switched on. |
| L6 | Logging a reach-out is three writes without a transaction. | A crash in between leaves the due date stale until the next change; it self-heals. |
| L7 | The digest loads every user each tick and marks the day before sending. | Fine at small scale; batch and retry when there are thousands of users. |
| L8 | Calendar feed secret sits in the URL (and so in access logs) and in the database unhashed. | Inherent to subscribe-able calendar URLs; the user can rotate it. |
| L9 | scrypt uses Node's default cost (N=16384). | Reasonable today; raise it (with rehash on sign-in) as hardware moves. |
| L10 | Member name search lets any signed-in user browse discoverable names. | By design (decision 13); users can switch discoverability off. |
