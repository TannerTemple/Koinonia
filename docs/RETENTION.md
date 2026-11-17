# Keeping people coming back

_Merged into `claude/great-turing-vdjm45`. Every feature below is on by default and can be
switched off on its own: see "Turning things off"._

## The starting point: why you keep or drop apps

| What you said | What it means for Koinonia |
| --- | --- |
| You drop apps that are **too complex** | Every addition below is one line or one card on Today. No new tab, no new settings, nothing to learn. |
| You drop apps you **can do without your phone** or on paper | Paper cannot remind you, cannot remember what Mom said in March, and cannot tap to text her. Those three are the app; they are what the features below make more visible. |
| You keep apps because **"I'll need that in the future"** and to **save your progress** | Show what has been built up, so leaving feels like losing something: totals, and memories that only exist here. |
| Food apps: **points** | Milestones, not points. Points for praying would cheapen it; a quiet "7 days in a row. Well done." does the same job honestly. |
| Bank apps: **check so you don't get penalised** | The red badge and "who is waiting" already do this. The streak line adds a gentle version: there is something to keep. |
| Hallow: **good content and streaks** | A word for today, and a prayer streak that is visible on Today instead of buried in Profile. |
| ESPN, Slack, email: **something new, quickly** | Today now has something different every day (the word, sometimes a memory) even when nobody is due. |
| Claude, Gemini, Maps: **a quick answer** | The memory card answers "what did we talk about last time?" before you ask. |
| Magisterium AI: **Google / Apple / Microsoft sign-in, "used last time"** | The sign-in screen now remembers you ("Welcome back, Pat", email filled in, a "Used last time" tag). The buttons themselves need your accounts; see "Not built". |

## What is built on this branch

All of it works on web and in the phone app, from one shared set of rules
(`packages/shared/src/keep.ts`) so both always agree.

1. **A prayer streak that forgives one missed day a week.** Missing a single day no longer
   resets it; missing two in a row, or twice in a week, does. Today says so kindly: "You missed
   yesterday, and that's all right. Pray today to keep your 3 days going."
2. **Weeks in a row staying in touch.** Reaching out is a weekly rhythm, not a daily one, so it
   is counted in weeks: "4 weeks in a row staying in touch."
3. **The streak line sits under the greeting on Today**, one or two sentences, and only when
   there is something to say. A brand-new account sees nothing.
4. **Milestones** at 3, 7, 14, 30, 50, 100, 200 and 365 days: the line adds "Well done."
5. **An evening nudge on the iPhone**, 8:00 PM, only when a streak of two or more days has not
   been kept yet today: "Keep your 5 days of prayer going. One minute for 'Mom's knee recovery'
   is enough." Praying cancels it.
6. **A memory.** If you reached out to someone a year, six months, three months, a month or a
   week ago today, Today shows it with what you wrote down: "A month ago: You reached out to
   Mom. 'She got the all-clear from the doctor.' How are they now?" Tapping opens their page.
7. **A word for today.** One short verse on friendship, love or prayer, the same for everyone
   that day, with one small thing to do ("Someone far away would love to hear from you."). 36
   verses, cycling.
8. **What you have built up.** One sentence at the bottom of Today: "Since March 2026: 42
   reach-outs, 118 prayers, 3 answered."
9. **"Used last time" on sign-in.** After signing out, the screen greets you by first name with
   your email filled in and partly hidden, and a "Not you?" link that forgets it. Only your first
   name and email are kept on the device, never the password.

Today's order is unchanged where it matters: Reach out and Pray are still the first two things.
The memory, the word and the totals sit underneath them.

## Turning things off

Each feature has a name. Put the names you do not want, separated by commas, in the API's
`FEATURES_OFF` setting, and restart the API (on Azure:
`az containerapp update -g koinonia -n koinonia-api --set-env-vars FEATURES_OFF=memory,dailyWord`).
The web app and the phone app follow the API; nothing needs rebuilding. A name that is not on
this list stops the API at start with a message listing the real ones.

| Name | Switches off |
| --- | --- |
| `prayerStreak` | The prayer streak line under the greeting (and with it the 8pm reminder) |
| `weekStreak` | The "weeks in a row staying in touch" line |
| `milestones` | The "Well done." at 3, 7, 14, 30, 50, 100, 200 and 365 days |
| `memory` | The memory card |
| `dailyWord` | A word for today |
| `totals` | The "Since March 2026: ..." line |
| `streakNudge` | The 8:00 PM iPhone reminder only |
| `lastSignIn` | "Welcome back, Pat" and "Used last time" on the sign-in screens |

Example, to keep only the streaks: `FEATURES_OFF=memory,dailyWord,totals,lastSignIn`.
Locally, add the same line to `apps/api/.env`. With everything off, Today looks exactly as it
did before this work.

## Why these, and not others

- **Streaks work mainly through not wanting to lose them**, which is why the line appears before
  you have prayed, not only after. Duolingo, which has tested this more than anyone, reports
  that people who reach a 7-day streak are 3.6 times as likely to finish their course, and that
  letting people protect a streak against a missed day raised daily use. Those are the company's
  own figures, and the first is a correlation, not proof of cause.
  ([Duolingo's streak research](https://blog.duolingo.com/duolingo-streak-research/))
- **An unforgiving streak backfires.** One missed day turns "I'm on a roll" into "I've blown
  it", and that is when people stop altogether (psychologists call it the abstinence-violation
  or "what-the-hell" effect). Hence the grace day, and wording that never scolds.
- **Habits form by repeating one small action after the same cue**, and it takes a couple of
  months on average, with wide variation (Lally and colleagues, 2010, found a median of 66
  days). So the daily action has to stay tiny: one tap on "I prayed".
- **People value what they have put work into, and finish what they have visibly started**
  (the "endowed progress" effect: in Nunes and Drèze's 2006 loyalty-card study, a card that
  started with two stamps filled in was completed nearly twice as often). The totals and the
  getting-started card both lean on this.
- **Unpredictable small rewards bring people back more than predictable ones.** A memory does
  not appear every day; that is part of why it is worth opening the app to see.
- **Realistic expectations.** Typical apps keep roughly a quarter of new users the next day and
  about one in twenty after a month.
  ([benchmarks](https://getstream.io/blog/app-retention-guide), [more](https://mwm.ai/glossary/retention))
  If 30% of your first testers are still opening Koinonia weekly after a month, that is good.

The habit, endowed-progress and what-the-hell findings are from my own knowledge of the
research, not from a search done for this document; the Duolingo and benchmark figures are from
the linked pages.

## A caution

These are the same levers that make apps compulsive. Koinonia should bring someone back so
that they call their mother, not so that they open Koinonia. The rule used here: **every nudge
points at a person or a prayer, never at the app itself**, and nothing punishes a missed day. If
a feature ever makes someone feel guilty rather than glad, remove it.

## Not built, and why

| Idea | Why not yet |
| --- | --- |
| **Sign in with Apple, Google, Microsoft** | Needs your developer accounts and keys for each. Worth doing before the App Store: it removes the password, which is the biggest sign-up obstacle. Apple requires "Sign in with Apple" (or an equivalent privacy-preserving option) in any iPhone app that offers Google sign-in. The "Used last time" tag is already shaped to hold the method. |
| **Home Screen and Lock Screen widget** ("Today: call Mom") | Probably the strongest single retention feature for this app, because it works without opening it. Needs a native build and cannot be tried here. |
| **A year in review** ("In 2026 you reached out 212 times...") | Easy once there is a year of data. Do it in December. |
| **Praying together**: tell someone you prayed for them, or share one intention with a friend | The real network effect: each use invites someone. It needs careful privacy design, so it is a project of its own. |
| **A Catholic translation for the daily verse** | The verses are from the King James Version because it is free of copyright and I could quote it exactly. The Douay-Rheims is also free to use; the NABRE and RSV-CE need a licence. Swap the list in `packages/shared/src/keep.ts`. |
| **Saints' days, liturgical season, a daily reflection** | Good content, like Hallow's, but it needs an editor or a licensed source. |

## How it was checked

- 18 tests of the rules (streaks with grace, weeks, milestones, memories, the word, sign-in
  memory), 4 tests against the API with a real database, 2 for the evening nudge.
- In a real browser on web and the phone preview, with an account given three days of prayer, a
  missed day, and reach-outs a week and a month old: the forgiven-streak line, praying keeping
  the streak, the memory opening the person, the word, the totals, and "Welcome back" after
  signing out, including "Not you?".
- Not checked: the 8:00 PM notification on a real iPhone.
