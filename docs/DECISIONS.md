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
