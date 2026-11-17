# Security review, round two

Assumes a public deployment: anyone on the internet can reach the API and the web app, anyone
can create an account, and accounts hold sensitive things (notes about other people, prayers,
phone numbers). Earlier passes are in [REVIEW.md](REVIEW.md).

**Result:** no critical or high issue in the app's own code. Three medium issues found and
fixed, plus one high and two critical advisories in dependencies, all fixed. Low items are
listed with the reason they were left. Everything marked "fixed" has a test.

## Findings

| # | Severity | Area | Finding | Status |
| --- | --- | --- | --- | --- |
| 1 | High (dependency) | Dependencies | `deepmerge-ts` < 8 (stack exhaustion) inside the Prisma CLI, which ships in the API image to apply migrations. Not reachable from a request, but it is in production. | **Fixed**: pinned to ^8 with a pnpm override. Migrations, client generation and the production replay all pass. |
| 2 | Critical (dev only) | Dependencies | `tinypool` (two prototype-pollution advisories) and `@vitest/mocker` (two moderate) through Vitest 3. Test tooling only, never deployed. | **Fixed**: Vitest 4.1.12. |
| 3 | Moderate / low (dev only) | Dependencies | `minimatch` (ESLint tooling), `esbuild` (tsup's dev server). Build-time only. | **Fixed**: pnpm overrides. `pnpm audit` now reports **no known vulnerabilities**. |
| 4 | Medium | Rate limits | Web traffic reaches the API through the web app, so the API saw every web visitor as one address: one visitor hammering sign-in could lock everyone else on the web out for a minute, and per-address limits did nothing per person. | **Fixed**: the web app now forwards `/api` itself and passes the visitor's address with a shared `PROXY_SECRET`; the API believes that address only with the right secret (constant-time compare), so nobody can pick their own. Without the secret set, behaviour is as before. Tests: separate buckets per vouched address; a forged secret or no secret is ignored. Added to the deploy guides and `render.yaml` (generated). |
| 5 | Medium | Privacy, enumeration | "Find people on Koinonia" matched the start of any first or last name from three letters. Anyone can make an account, so the member list (names of everyone who had not turned off discovery) could be browsed a few letters at a time, 30 searches a minute. | **Fixed**: a name search needs a first name and the start of a last name ("Maria L"); email and phone stay exact-match only (email only once confirmed). Limit lowered to 20 a minute. Residual: someone could still try common first names with every initial; each search returns at most 5 people. Turning "Let friends find me" off hides a person completely. |
| 6 | Medium | Authorization coverage | There was no test that would catch a *new* endpoint added without a sign-in check, and several new endpoints arrived this round (metrics, beta, usage, config, feedback). | **Fixed**: a test now enumerates every route the API registers and calls each without a session; anything not on a short, commented public list must answer 401. Every `/v1/admin/*` route must answer 403 to an ordinary member. Both pass for all 60+ routes. |
| 7 | Low (accepted) | Enumeration | Sign-up says "An account with that email already exists." That confirms an address has an account. | **Left**, deliberately: a clear message matters for the people this app is for, and hiding it means an emailed "you already have an account" flow that needs real email. Mitigated: 5 sign-ups per 10 minutes per visitor (now truly per visitor, see 4). Sign-in and forgot-password give identical answers for known and unknown addresses (tested). |
| 8 | Low (accepted) | Beta form | `/beta` stores an email without confirming it, so someone could put another person's address on the invite list. | **Left**: it only puts an address on a list *you* read before inviting anyone; nothing is emailed automatically. 5 per hour per visitor; you can remove anyone. Noted in BETA.md. |
| 9 | Low (accepted) | Export | "Export my data" needs a session but not the password again, so a stolen session could download everything. | **Left**: a stolen session can already read everything one page at a time. Deleting the account does ask for the password. Sessions last 30 days and end on sign-out, password change and password reset. |
| 10 | Info | Public config | `GET /v1/config` is public. | It returns only which optional features are switched on. |

## What was checked and found sound

- **Authorization on every endpoint**: sign-in required everywhere except the 11 public routes
  listed in `apps/api/test/audit.test.ts`, each with its reason; every object is fetched by
  `id` *and* owner, so another account's id answers 404 (`isolation.test.ts`); admin routes
  answer 403 to members and admins cannot change their own role.
- **Tokens**: session, reset, verification and calendar tokens are random, stored only as
  SHA-256 hashes, and compared by hash. Reset links last 1 hour and work once; verification
  links 3 days. All sessions end on a password change or reset. Forged or expired sessions
  answer 401 (tested).
- **Web session**: an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie, honoured
  only together with the `X-Koinonia-Client: web` header. That header forces a browser
  preflight, which CORS refuses for any origin but the web app, so another site cannot make a
  signed-in request (tested).
- **Passwords**: scrypt with a per-user salt; 8 wrong passwords lock that account's sign-in for
  15 minutes regardless of address.
- **Secrets in logs**: request logs carry the method, the route and a URL with the query string
  removed and calendar tokens redacted; no headers, so no `Authorization`, cookies or
  `PROXY_SECRET`. Errors are reduced to their type and a scrubbed first line. Feedback, beta
  and usage logs carry ids and counts, never message text, names or emails (tested in
  `feedback.test.ts`, `hardening.test.ts`). Startup errors name a wrong setting but never print
  its value.
- **Files and export**: export routes accept only the four known table names; CSV cells that
  start with `=`, `+`, `-` or `@` are neutralised so a spreadsheet will not run them; downloads
  are `no-store`. There are no file uploads; contact import is JSON with at most 500 people and
  a 512 KB body limit.
- **Rate limits**: every write endpoint has one (a test fails if a new one does not), with
  tighter ones on sign-in (10/min), sign-up (5/10 min), password reset, feedback (10/hour),
  beta sign-up (5/hour), people search (20/min) and export.
- **Headers**: Helmet on the API; on the web app a Content Security Policy that only allows
  scripts from the site and connections to itself, HSTS, no framing, `no-referrer` on pages that
  carry one-time tokens.
- **The web app's `/api` forwarding**: forwards only to the configured API address; drops any
  `X-Koinonia-Proxy-Secret` or client-address header a visitor sends before adding its own;
  30-second timeout.

## Not checked here

- A penetration test against the real deployment, TLS settings of Render/Azure/Vercel, and the
  hosts' own access controls. Turn on two-factor sign-in on every service account.
- The iPhone app's Keychain behaviour on a device (see [TEST_ON_PHONE.md](TEST_ON_PHONE.md)).

## Keeping it this way

- `pnpm audit` before each release. If it reports something, upgrade the direct dependency
  first; use an override in `pnpm-workspace.yaml` only when the fix is in a sub-dependency, and
  remove the override once the parent package catches up.
- When adding an endpoint: the audit test will fail until it either requires a session or is
  added to the public list with a reason.
