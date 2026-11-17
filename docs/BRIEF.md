# Part A — The app (brief, saved word for word)

> Source: "App Build Brief — Unattended Claude Build", Nov 12, 2026, @Tanner Temple.
> This file is the requirements source of truth. Typos are preserved on purpose.

## The idea

| Question | Your answer |
| --- | --- |
| App name (or "your call") | Koinonia, Koinonia is a Greek word (κοινωνία) meaning "communion," "fellowship," "joint participation," or "partnership". In a Catholic and Christian context, it describes the deep spiritual bond uniting believers with Jesus Christ and with one another. |
| The idea in 2–4 sentences | The idea is high level to keep people in touch with each other, that is the main use case of the app. There are apps that make sure people continue to network with each other and reach out to each other but this app would help remind people to reach out to each other, with the intention to keep those bonds between people who intend to keep them but can easily forget because of busyness and life. I want to make it as integrated as possible as well as create a feature to also include notes of the person and what/when to reach out. Also, I want a page/feature to include prayer intentions, people you said youd pray for and people to pray for etc, this should be easy to follow with the ability to also choose the person to pray for each day (a special intention each day). |

Reach out app

- include reminders on different intervals --> I want the functionality to remind the user to reach out to their contacts on different intervals. Some people every 3 days, some every week, 2, 4 etc. This should be set by the user.
  - Include page of people to pray for

| Question | Your answer |
| --- | --- |
| What problem does it solve? | Busy people who mean well to stay connected but have no easy way to remember |
| Who is it for? Be specific | Busy people first. With the additonal use case for religious people, especially Catholic/Christians |
| What makes it different from what already exists? | This doesn't exist in a non business way. It has real use case and future in the personal dimension. |

## Features

| Question | Your answer |
| --- | --- |
| Must-have features, ranked (#1 = most important) | 1. BR-scheduled-reminders 2. BR-prayer-list 3. BR-personal-notes |
| Nice-to-haves, only if time allows | Open to ideas but core app first. Open to connecting to messages or social media or email if necessary |
| Explicitly out of scope (don't build these) | Not exactly sure, i can check after to see if i dont want it so commit early commit often |
| Types of users / roles (e.g. regular user, admin) | Regular user and admin only things I can think of |

## How it works

| Question | Your answer |
| --- | --- |
| Walk through the main flow step by step (e.g. sign up → create X → share with friend → …) | Account sign up on ios/android app or online account. share with friend or can look up name or phone number something like this |
| What does the user see on the home screen? | Maybe the upcoming reaches (soonest people to reach out to, or current or past due) |
| Main "things" the app stores (e.g. users, posts, trips, workouts) and what each one has | Users, notes, prayer intentions, and gamify it w streaks and similar that always helps |
| Outside services it needs (payments, maps, AI, email, notifications, calendar…)? They'll be stubbed until you add keys | Email, text, calendar maybe. No AI at fist or payments or maps |
| Sign-in method (email + password, Google, Apple, or your call) | Whatever is best practice |

## Look and feel

| Question | Your answer |
| --- | --- |
| Vibe in 3 words (e.g. clean, playful, premium) | 3 words: Crisp, Concrete, Clean but not minimal like AI crap apps, include substances |
| Colors or brand you have in mind | Marian Blue or Lush Forest |
| Apps whose design you like, and what about them | i like hallow app UI |
| Light mode, dark mode, or both | both |

## Platforms and tech

| Question | Your answer |
| --- | --- |
| Which matters most if time runs short: web, iOS, or equal? | ios first matters |
| Tech stack preference (or "your call") | Have a set architecture and structure and should be followable the commits and PRs |
| Anything existing to use: repo, designs, links, data | Repo is connected |
| Business model (free, subscription, one-time, none) — affects screens like paywalls | Should be free or low cost to start but can host and pay for dev costs |

## Done means

| Question | Your answer |
| --- | --- |
| When you land, what would make you say "this worked"? | The core functionality. I can set reminders for people either on app or not and have notes and their contact info synced or added. Also includes prayer page with specific intentions linked |
| Hard no's: anything Claude must not do | Nothing atm |
| Anything else it should know | NA |

---

# Part B — Build instructions (summary of the standing rules)

- Fully unattended: never ask, never wait. Decide, log one line in `docs/DECISIONS.md`, move on.
- Usage is limited: working software over explanations, rewrites and polish. Few/no subagents.
- Default stack: TypeScript pnpm monorepo — `apps/api` (Node REST, Prisma, Postgres / SQLite for dev+tests, validation, auth), `apps/web` (Next.js + Tailwind), `apps/mobile` (Expo + Expo Router, iOS first), `packages/shared` (types, validation schemas, typed API client), seed script with realistic demo data.
- Milestones, in order, each finished + tested + committed + pushed before the next:
  1. Scaffold  2. Backend core  3. Web app core  4. iOS app core  5. Nice-to-haves  6. Polish
- After every milestone: update `STATUS.md`, tick `docs/PLAN.md`.
- Tests, lint, typecheck pass at every commit. If a fix takes more than a few attempts: stub cleanly, note in `STATUS.md`, continue.
- No real secrets or paid services; every outside service behind an interface with a working mock; keys listed in `.env.example`.
- No deploys, no accounts on outside services.
- Low on usage: stop new work, finish/stub current milestone, commit, push, write final `STATUS.md`.
- At the end: `STATUS.md` (done / stubbed / run commands / next steps for owner / suggested features), final commit + push, open a PR to `main` linking `STATUS.md`.
