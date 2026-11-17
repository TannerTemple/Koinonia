# Running the beta

Four things: an email to invite testers, how to add them in TestFlight, five questions to ask
them, and a script for watching someone sign up. Where a line says `[YOUR NAME]` or
`[WEB ADDRESS]`, fill it in.

What is already built for this:

- **A public page** at `[WEB ADDRESS]/beta`: what the app is, and a form to ask for an invite.
  Emails are stored only when the person ticks the consent box.
- **The list of requests**: web app → **Admin** → **Beta invite requests**, with a
  **Copy iPhone emails** button and a **Remove** button for anyone who asks to be taken off.
- **Invite a friend**: Settings (web) or Profile (phone). It shares a short message with the
  public page's address.
- **Send feedback or report a problem**: Settings / Profile. You read them on Admin.
- **Numbers**: Admin → **Beta metrics** ([METRICS.md](METRICS.md)).

## 1. The invite email

Send it yourself, from your own address, to people you know. Personal beats polished.

> **Subject:** Would you try something I've been building?
>
> Hi [NAME],
>
> I've been building a small app called Koinonia. It does three things: reminds me to reach out
> to the people I care about, remembers what we talked about, and keeps the list of people I've
> said I'd pray for.
>
> I'd love for you to be one of the first to try it. It's free, it takes about two minutes to
> set up, and nothing you write in it is shared with anyone.
>
> **On an iPhone:** install Apple's free TestFlight app, then tap this link: [TESTFLIGHT LINK]
> **On anything else:** use it in your browser at [WEB ADDRESS]
>
> All I ask: use it for two weeks, then answer five short questions. If something is confusing
> or broken, there's a "Send feedback" button in the app, or just reply to this email. Blunt is
> helpful.
>
> Thank you,
> [YOUR NAME]

Two weeks later, to the same people:

> **Subject:** Five questions about Koinonia
>
> Hi [NAME], thank you for trying Koinonia. Would you answer these five? One line each is
> plenty. [the five questions below, or a link to your form]

## 2. Adding testers in TestFlight

You need the Apple Developer Program ($99 a year) and a build uploaded with
`eas build --profile production` then `eas submit` (see [APP_STORE.md](APP_STORE.md)).

**People you know (up to 100, no review): internal testers.** Only for people you are willing to
add to your developer team.

1. appstoreconnect.apple.com → **Users and Access** → **+** → their Apple ID email, role
   **Customer Support** or **Developer** → **Invite**. They accept by email.
2. **Apps** → Koinonia → **TestFlight** → **Internal Testing** → **+** next to the group → tick
   them → **Add**.

**Everyone else (up to 10,000): external testers.** This is the normal route for a beta.

1. **Apps** → Koinonia → **TestFlight** → **External Testing** → **+** → name the group
   `Beta` → **Create**.
2. In the group: **Builds** → **+** → choose the build → fill in **What to Test** (two
   sentences: "Add three people you want to stay close to. Add something to pray for.") →
   **Submit for Review**. The first build of a version goes through Apple's beta review, usually
   about a day. Later builds of the same version usually do not.
3. Add people one of two ways:
   - **By email:** **Testers** → **+** → **Add New Testers** → paste the addresses (Admin →
     Beta invite requests → **Copy iPhone emails**) → **Add**. Each gets an email from TestFlight.
   - **By link:** **Public Link** → **Enable Public Link** → set a tester limit (say 50) →
     copy the link. This is the `[TESTFLIGHT LINK]` for the email above. Anyone with the link can
     join until the limit is reached.
4. A build stops working for testers **90 days** after upload. Upload a new one before then.

Check these numbers and labels in App Store Connect when you do it; Apple changes them.
([TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/overview-of-testflight/))

## 3. Five questions

Ask after two weeks. A Google or Microsoft Form, or just the email. Keep it to these five; more
questions get fewer answers.

1. **How would you feel if you could no longer use Koinonia?** Very disappointed / Somewhat
   disappointed / Not disappointed.
   *(The one that matters most. If four in ten say "very disappointed", you have something.)*
2. **What is the main thing you use it for?** (one line)
3. **Was there a moment you were confused or stuck? What were you trying to do?**
4. **What almost made you stop using it, or did?**
5. **If you could change or add one thing, what would it be?**

Optional sixth, only for people who answered "very disappointed": **Who else should have this?**
Those are your next invitations.

Read the answers next to Admin → Beta metrics. Someone who says "love it" but never came back in
week 4 is being polite; someone who complains and opens it daily is your best tester.

## 4. Watching someone sign up

The most useful half hour you will spend. Do it with two or three people, one at a time, in
person or on a video call with their screen shared. You are testing the app, not them.

**Before.** Use a fresh account (theirs, not yours). Have a notebook. Do not demo anything first.

**Say this, more or less word for word:**

> "I'm going to ask you to try something I've built. I'm not testing you; I'm finding out where
> the app is confusing, so anything that trips you up is exactly what I need to see. Please
> think out loud: say what you're looking at and what you expect to happen. I'm going to stay
> quiet and I won't help, even if you ask, which will feel rude. It isn't. Ready?"

**Then give them three tasks, one at a time, and nothing else:**

1. "Here's the link. Get yourself set up."
   *(Watch: where they hesitate at sign-up; whether they read or skip the welcome; whether they
   add a person there.)*
2. "Think of someone you've been meaning to call. Make the app remind you about them."
   *(Watch: can they find Add a person; do they understand "how often"; do they open More
   details and regret it.)*
3. "Imagine you just got off the phone with them. Tell the app."
   *(Watch: do they find "I reached out"; do they write a note; do they understand what happens
   next.)*

If there is time: "Someone asked you to pray for them. Put that somewhere you'll see it."

**While they do it:**

- Say nothing. Count to ten before you answer a question, and then answer with "What would you
  expect?" or "What would you try?"
- Write down, with the time: every pause longer than three seconds, every wrong tap, every
  sentence that starts "Oh, I thought...", and the exact words they use for things ("my
  people", "check in"). Their words are better labels than yours.
- Do not explain, defend or apologise. If they are truly stuck for a full minute, move to the
  next task.

**Afterwards, ask three things:**

1. "What was that app for, in your own words?"
2. "What was the most confusing moment?"
3. "Would you open it again tomorrow? What for?" *(Listen to the second half.)*

**The same day,** write up the three biggest stumbles. Anything two different people stumbled
on is the next thing to fix. Then check Admin → Beta metrics a week later to see whether they
came back.

## Housekeeping

- **Someone asks to be removed from the invite list:** Admin → Beta invite requests → **Remove**.
- **Consent:** the public form stores an email only with the box ticked, and records when.
  Use those addresses for the beta and nothing else.
- **Before inviting strangers:** real email must be on (so "Forgot password" works), the legal
  pages must be finished, and `pnpm smoke` must pass against the live site.
