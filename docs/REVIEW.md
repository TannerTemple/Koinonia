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
