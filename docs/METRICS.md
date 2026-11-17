# Beta metrics: how to read them

Web app → **Admin** → **Beta metrics** (admins only).

Everything on the page is a **count**. Making it reads sign-up dates, the dates people were
added, and the days on which a reach-out or prayer was logged. It never reads a name, a note, a
prayer or a contact detail, and no outside tracking service is involved. Screen and action
counts are stored per day with no account attached, so they cannot be traced back to anyone.

## The five numbers at the top

| Tile | Meaning | What good looks like in a small beta |
| --- | --- | --- |
| **Accounts** | Everyone who has signed up. | Whatever you invited. |
| **Activated** | Share who added **3 or more people within 7 days** of signing up. | Above half. Below that, the first minutes are the problem: watch someone sign up (docs/BETA.md). |
| **Back in week 1** | Of those who have had the chance: share who logged a reach-out or prayer on **days 7 to 13** after signing up. | A third or more. |
| **Back in week 4** | The same for **days 28 to 34**. This is the number that says whether the app is worth keeping. | Typical apps keep about one in twenty people at a month. One in four of your testers would be a strong result. |
| **Active this week** | People who logged a reach-out or prayer since Monday, whenever they joined. | Growing, or at least flat, week to week. |

"Who have had the chance" matters: someone who joined nine days ago cannot yet have come back
in week 4, so they are left out of that percentage until their window has passed.

## Week by week

Each row is a **cohort**: the people who signed up in the week starting that Monday (weeks are
Monday to Sunday, in UTC). Read across a row to follow that group.

- **Signed up**: how many joined that week.
- **Added 3 people in week 1**: of them, how many were activated.
- **Came back in week 1 / week 4**: of them, how many were active in those windows. "too early"
  means the window has not finished for everyone in the row; "(2 so far)" is how many already
  have.
- **Active that week**: different from the rest of the row. It counts everyone active during
  that calendar week, from any cohort.

With ten testers every person is ten percentage points, so read the "3 of 8" part, not just the
percentage.

## What people do, and screens opened

Totals for the last 30 days, split between the web app and the phone app.

- **What people do** counts actions that succeeded: "Logged a reach-out", "Prayed", "Wrote a
  note", "Added a person" and so on. If "Added a person" is high and "Logged a reach-out" is
  near zero, people set up and never came back to use it.
- **Screens opened** counts visits per screen. `:id` stands for any person, note or prayer: the
  count never says which. A screen nobody opens is a candidate to remove; a screen opened far
  more than the action behind it (many visits to the reach-out screen, few reach-outs logged) is
  a place people give up.

Counting starts when this version is deployed; there is no history before it.

## What it cannot tell you

- **Why.** Numbers show where people stop; only watching or asking shows why. Pair this page
  with the feedback list on Admin and the five questions in docs/BETA.md.
- **Who.** By design. If you need to follow up with one person, ask them.
- **Small differences.** With a handful of testers, one person on holiday moves every number.

## Where the numbers come from

`GET /v1/admin/metrics` (admin only). The calculation is `packages/shared/src/metrics.ts`;
counts are stored in the `UsageCount` table, written by the API after each successful action and
by the apps each time a screen opens.
