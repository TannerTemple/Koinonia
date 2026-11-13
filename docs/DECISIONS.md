# Decisions

One line each: the decision and why. Newest at the bottom.

1. **Branch `claude/great-turing-vdjm45`** instead of `build/v1` — the cloud session is only permitted to push to this branch.
2. **PostgreSQL everywhere (dev, tests, prod), no SQLite** — Postgres 16 is available in the build box, and one database engine means real enums and no dev/prod drift. `docker-compose.yml` provides it locally.
3. **Prisma 6 (not the 8 release candidate that is npm `latest`)** — stable, well-documented, no RC risk.
4. **Fastify for the API** — fast, first-class TypeScript, `inject()` makes endpoint tests cheap.
5. **Auth = email + password with opaque session tokens (hashed in DB), scrypt password hashing** — best-practice baseline that works identically on web and iOS, is revocable, and needs no outside account. Sign in with Apple / Google are listed as next steps (Apple requires it only if other social logins are offered).
6. **Shared package is consumed as TypeScript source (no build step)** — fewer moving parts; Next transpiles it, Metro bundles it, the API runs/bundles it with tsx/tsup.
7. **`node-linker=hoisted` for pnpm** — the layout Expo/Metro is most reliable with in a monorepo.
8. **React 19.3.0 and TypeScript 6.0 pinned repo-wide** — match what Expo SDK 58 ships so web and mobile share one React.
9. **Streaks are derived from logs, not stored counters** — cannot drift, trivially correct after edits/deletes.
10. **A "day" is a calendar day in the user's timezone** (stored on the user, sent by the client at sign-up) — due dates and streaks should flip at the user's midnight, not UTC's.
11. **Cadence is a free number of days with presets (3, 7, 14, 28, 90…)** — the brief asks for user-set intervals; presets keep it fast.
12. **Reaching out resets the clock from the day you reached out** (not from the original due date) — matches how people think: "I talked to her today, remind me in two weeks."
13. **Contacts are private address-book entries; optionally linked to a Koinonia user found by exact email/phone or name search** — covers "look up name or phone number" without building a social network. Users can turn off discoverability.
14. **Reminders in three layers**: live Today screen, on-device local notifications in the iOS app (work with no server keys), and a server-side daily digest through mock email/SMS/push providers.
15. **Vitest for all unit/endpoint tests, including the mobile app's pure logic** — one runner; jest-expo in a pnpm monorepo is a known time sink. Mobile is additionally verified by typecheck, lint and `expo export`.
16. **Palette: Marian blue primary, lush forest for the prayer side, warm parchment surfaces, gold for streaks; serif display type** — the brief's colors, with Hallow-like depth rather than flat minimalism.
17. **Admin is web-only** — admins manage from a desk; keeps the iOS app focused.
18. **No paywall screens** — brief says free / low cost to start.
19. **A new person's first reminder is one full interval from today** (unless you say when you last talked) — importing 50 contacts shouldn't make 50 people "due today".
20. **Real adapters for Resend (email), Twilio (SMS) and Expo push are included but only switch on when their keys are set** — mocks are the default and the only ones covered by tests.
21. **Calendar integration is a private subscribe-able .ics feed** — works with Apple/Google Calendar with no OAuth or API keys.
22. **Mobile date entry uses quick choices ("Tomorrow", "Next week", "~2 weeks ago") rather than a calendar picker** — faster on a phone and avoids another native dependency that couldn't be tested here.
23. **The mobile app also runs in a browser (`expo start --web`)** — the only way to exercise its screens without a simulator; the web-only tab layout and storage fallback never ship in the iOS build.
24. **Contact import uses `expo-contacts/legacy`** — SDK 58 moved the default export to a new API; the legacy entry point is the documented, stable one.
25. **Bundle identifier `com.koinonia.app` is a placeholder** — the owner must pick one they can register with Apple.
26. **Mobile preview test automation was stopped at the owner's instruction** after the selector kept matching hidden stacked screens; the unverified flows are listed in STATUS.md.
27. **`prisma generate` runs from the API package's `postinstall` (and again after `db:migrate`)** — a fresh clone works with only the commands in STATUS.md.
28. **Login lockout is per email, in memory (8 wrong passwords → 15 minutes)** — stops password guessing across IPs with no new infrastructure; noted in REVIEW.md as something to move to shared storage when there is more than one API instance.
29. **`TRUST_PROXY` is off by default** — forwarded-IP headers are only believed when the owner says the API is behind a proxy, otherwise rate limits can be dodged.
30. **Phone search matches the exact number only** — suffix matching let members' numbers be fished out.
31. **The four mobile flows (add note, add intention, log reach-out, mark prayed) were verified in the browser preview against the live API; no app bugs found** — the earlier failures were test selectors. The throwaway script was not added to the repo (it needs Playwright, which is not a project dependency).
32. **Reset and verification emails carry a web link and the same secret as a pasteable code for the iPhone app** — works on mobile without universal links (which need a real domain and Apple setup); the code is the full 256-bit token, so it needs no guess-limiting.
33. **Unverified accounts keep full access and see a "Confirm your email" banner** — blocking a free personal app behind verification costs sign-ups; verification mainly protects password reset.
34. **Reset links last 1 hour, verification links 3 days; a new request cancels older unused ones; a reset signs out every session and marks the email verified.**
35. **Forgot-password always answers 204 and sends the email after responding** — neither the response nor its timing reveals whether an account exists.
36. **The mobile date picker is a small in-house month calendar (pure React Native), replacing the quick choices of decision 22** — no native module, so it works in Expo Go, a development build and the browser preview alike, and could be verified here; `@react-native-community/datetimepicker` could not be run without a simulator. Used for note follow-ups, reach-out day and "last talked".
37. **The weekly review compares the last 7 days (ending today) with the 7 days before, not calendar weeks** — always seven full days against seven full days, so a Monday review isn't "0 vs 9". One endpoint, `GET /v1/review/weekly`; reached from the "this week" tile on Today.
38. **Browser check of the web forgot / reset forms was dropped after two failed test runs** (the test clicked before the dev page had loaded); the API behind them is covered by tests and the gap is listed in STATUS.md.
39. **The web session is an httpOnly SameSite=Lax cookie; the API accepts it only with an `X-Koinonia-Client: web` header** — page scripts can't read the token, and another site can't forge requests because it can't send the header past CORS. Consequence: in production the web app and the API must share a registrable domain (for example `app.example.com` and `api.example.com`, with `COOKIE_DOMAIN=.example.com`). The iOS app keeps a bearer token in the Keychain.
40. **The calendar link is shown once, when created; the server keeps only its hash** — "copy link" on a phone that already has one makes a new link (after a warning) and the old one stops working.
41. **Sign-up still says when an email is taken, behind a 5-per-10-minutes limit** — hiding it would mean no sign-in until the email is confirmed (against decision 33).
42. **scrypt cost N=2^17, stored in each hash, upgraded at sign-in; `SCRYPT_LOG_N` lowers it for the test suite only.**
43. **Member name search matches the start of a first or last name, 3+ letters, 5 results** — enough to find someone you know, not enough to page through the directory.
44. **Web gets contact import from a vCard (.vcf) file; the mobile browser preview uses the same file import** — "fix the import contact feature" was not specific, so every weakness found was fixed (errors mislabelled as a permission refusal, nameless-but-real contacts dropped, duplicate matching, the 500 cap) and the feature was added where it was missing. A browser has no address book, and vCard is the one format iCloud, Google and Outlook all export.
45. **Import duplicates are matched by the last 10 digits of the phone, or the email, or the name when one side has nothing else** — numbers are written many ways; two people can share a name.
46. **The mobile forgot-password submit was left unverified after two failed test attempts** (selector matched the "Send reset email" button); noted in STATUS.md.
47. **Hosted web traffic goes through the web app: `/api/*` is forwarded to the API (`API_PROXY_TARGET`)** — the session cookie then belongs to the web app's own address, so sign-in works on free `*.vercel.app` + `*.onrender.com` addresses, which browsers treat as unrelated sites. A custom domain with two subdomains (Option B in DEPLOY.md) is the alternative. Trade-off, documented: web visitors share IP rate-limit buckets per proxy server; the per-account lockout is unaffected.
48. **Deploy guide targets Neon + Render + Vercel** — each had a free tier and deploys from GitHub with no CLI; Railway, Fly.io and plain Docker are covered briefly. Nothing was deployed (the brief forbids creating accounts).
49. **`TRUST_PROXY` is a hop count (1 on most hosts), not just on/off** — trusting every forwarded address would let a client pick its own IP on a publicly reachable API.
50. **Two health endpoints: `/health` (process up) and `/health/ready` (database reachable, 503 if not)** — hosts need the first to be cheap and the second to gate deploys; neither is rate-limited or logged.
51. **`POST /v1/jobs/digest` behind `CRON_SECRET`** — free hosts put the API to sleep, which stops the in-process digest timer; an outside scheduler can run it instead. The endpoint 404s when no secret is set.
52. **The API container applies migrations on start (`prisma migrate deploy`)** — one fewer manual step; safe because migrations are forward-only and the app is single-instance at this size.
53. **The Docker image was not built here** — two attempts failed at `apt-get` because the build sandbox blocks Debian mirrors. The same steps (filtered frozen install, build, migrate, production start, health checks) were run successfully outside Docker.
54. **The seed refuses to run when `NODE_ENV=production`** — it creates demo accounts with published passwords.
55. **Real email is an explicit switch, `EMAIL_PROVIDER=resend` (default `mock`), replacing decision 20's "on when the key is present"** — a key left in an environment should not start sending mail by accident. With the switch on, a missing key or placeholder sender stops the API at start instead of failing at the first password reset.
56. **The Resend adapter retries timeouts, 429 and 5xx (twice, with backoff and one idempotency key per message) and never retries 4xx; its errors carry the status and error type only** — no recipient, subject or body can reach the logs.
57. **The Resend adapter is tested with stubbed HTTP plus an opt-in live test (`RESEND_LIVE_TEST=1`)** — the build sandbox cannot reach api.resend.com and no account may be created, so the live path has never run.
58. **Privacy policy and terms are public web pages (`/privacy`, `/terms`) marked as drafts, with every fact the owner must supply as a visible [BRACKETED] placeholder in `apps/web/src/lib/legal.ts`** — they describe what the code actually does (checked against it); they are not legal advice and need a lawyer's review before launch. The iPhone app links to the web pages rather than carrying its own copy, so there is one text to keep true.
59. **Prayer intentions are described as sensitive information (they can reveal religious beliefs)** — the policy says so plainly, and the App Store privacy answers in APP_STORE.md declare it.
