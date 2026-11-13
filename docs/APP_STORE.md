# Getting Koinonia onto the App Store

Everything needed to go from this repository to TestFlight and then App Review: a checklist, the
exact commands, the listing text, and the answers to Apple's privacy questions.

> **Not yet done by anyone.** No build has been made with EAS and nothing has been submitted; the
> iPhone app has only been bundled (`expo export`) and run in a browser preview. Apple and Expo
> change their screens and requirements often. Where this guide and what you see disagree, trust
> what you see. Sizes and limits below were correct when written; App Store Connect shows the
> current ones.

## Checklist

### Accounts and one-time setup

- [ ] **Apple Developer Program** membership ($99 per year, developer.apple.com/programs). Approval
      can take a day or two.
- [ ] **Expo account** (free, expo.dev).
- [ ] A Mac is **not** required: EAS builds in the cloud. An iPhone is needed to test.
- [ ] The API and web app are deployed ([DEPLOY.md](DEPLOY.md)) and real email is on (step 5 there).
      Apple's reviewer must be able to sign in, and the privacy policy must be reachable.

### In the code (each is one small edit)

- [ ] **Bundle identifier.** `apps/mobile/app.json` → `expo.ios.bundleIdentifier` is the placeholder
      `com.koinonia.app`. Change it to one you own, in reverse-domain form, for example
      `com.yourname.koinonia`. It can never be changed after the first upload.
- [ ] **Server addresses.** `apps/mobile/eas.json` → replace both `REPLACE-WITH-YOUR-...` values in
      the `preview` and `production` profiles with your API address and your web app address
      (no trailing slash).
- [ ] **Legal pages.** Fill in every placeholder in `apps/web/src/lib/legal.ts`, have the text
      reviewed, set `LEGAL_DRAFT = false`, and redeploy the web app.
- [ ] Commit and push those changes.

### Before submitting for review

- [ ] The app runs on a real iPhone from TestFlight, and you have walked every flow once:
      sign up, add a person, import from contacts, note with a follow-up date, intention,
      "I reached out", "I prayed", notifications on, forgot password, confirm email, weekly review,
      delete account.
- [ ] A **demo account** exists on the production server for the reviewer (see "Review
      information"). Sign up in the app with an address you control and add a few people and
      intentions so the screens are not empty.
- [ ] Screenshots are made (see "Screenshots").
- [ ] Listing text is pasted in (see "Listing copy").
- [ ] Privacy answers are entered (see "App Privacy answers").
- [ ] Age rating questionnaire answered (all "None"; see below).

## Commands

Run these from a terminal. Each block is one command.

Install the EAS tool once:

```bash
npm install -g eas-cli
```

Go to the app and sign in to Expo:

```bash
cd apps/mobile
```

```bash
eas login
```

Link the folder to a new Expo project. This writes a project ID into `app.json`; commit that change.
Push notifications need it.

```bash
eas init
```

### Build for TestFlight and the App Store

```bash
eas build --platform ios --profile production
```

The first time, EAS asks you to sign in with your Apple ID and offers to create everything Apple
needs: the bundle identifier, a distribution certificate, a provisioning profile, and a push
notification key. Answer **yes** to each. The build takes 15 to 30 minutes on the free queue. The
build number goes up by itself every time.

### Upload it to App Store Connect

```bash
eas submit --platform ios --latest
```

The first time, this asks for your Apple ID again and offers to create the app's record in App
Store Connect; say yes and give it the name from "Listing copy". When it finishes, the build appears
in App Store Connect under **TestFlight** after Apple processes it (10 to 30 minutes; you get an
email).

To build and upload in one go next time:

```bash
eas build --platform ios --profile production --auto-submit
```

### TestFlight

1. appstoreconnect.apple.com → **Apps** → Koinonia → **TestFlight**.
2. The first build asks an export compliance question. The answer is already declared in the app
   (`ITSAppUsesNonExemptEncryption = false`: it only uses standard HTTPS), so it should not ask;
   if it does, choose "None of the algorithms mentioned above".
3. **Internal Testing** → create a group → add yourself and anyone on your Apple developer team
   (up to 100 people). No review needed; they get an invitation email.
4. On the iPhone install the **TestFlight** app from the App Store, accept the invitation, install
   Koinonia.
5. To let people outside your team test: **External Testing** → add a group → add the build. The
   first external build goes through a short Beta App Review (usually a day).

### Submit for review

1. App Store Connect → Koinonia → **Distribution** (the "App Store" tab) → the 1.0 version.
2. Fill in the listing, screenshots, privacy answers and review information from this document.
3. Under **Build**, pick the build you tested.
4. **Add for Review** → **Submit**. Review usually takes one to three days.

### Other useful commands

A build for the iOS Simulator on a Mac (talks to a server on the same Mac):

```bash
eas build --platform ios --profile simulator
```

A build you can install directly on registered iPhones without TestFlight (register each phone first
with `eas device:create`):

```bash
eas build --platform ios --profile preview
```

See and manage certificates and the push key:

```bash
eas credentials --platform ios
```

After changing only JavaScript, you still need a new build to ship it; over-the-air updates
(`expo-updates`) are not set up.

### Releasing a new version later

Raise `expo.version` in `apps/mobile/app.json` (for example `1.0.0` → `1.0.1`), commit, then build
and submit again with the two commands above.

## Listing copy

Limits: name 30 characters, subtitle 30, promotional text 170, keywords 100 (commas included),
description 4,000.

**App name** (must be unique on the store; if "Koinonia" alone is taken, use one of these)

- `Koinonia`
- `Koinonia: Stay in Touch`
- `Koinonia: Reach Out & Pray`

**Subtitle**

```
Reach out, remember, pray
```

**Promotional text** (can be changed any time without review)

```
Life gets busy and the people you love slip down the list. Koinonia reminds you who to call, remembers what to ask, and keeps the prayers you promised.
```

**Description**

```
You meant to call. You said you'd pray. Then the week happened.

Koinonia (Greek for communion, fellowship) is a quiet helper for staying close to the people who matter to you.

REACH OUT ON A RHYTHM YOU CHOOSE
• Every three days for Mom, every week for your best friend, once a month for an old roommate. Each person gets their own rhythm.
• Today shows who is overdue, who is due, and who is coming up.
• Tap "I reached out" and the clock starts again. Not a good day? Snooze without pretending.
• Call, text or email in one tap, with a few gentle openers if you don't know what to say.

REMEMBER WHAT MATTERS TO THEM
• Keep notes on each person: the new job, the kids' names, the surgery next month.
• Add a follow-up date ("ask how the interview went") and Koinonia brings it back on the right day.
• Birthdays appear before they arrive.

KEEP THE PRAYERS YOU PROMISED
• A prayer list for everyone you said you'd pray for, each intention linked to its person.
• One intention is set apart each day: choose it yourself, or let Koinonia suggest the one that has waited longest.
• Mark prayers as prayed, and mark them answered.

SMALL ENCOURAGEMENTS
• Streaks for reaching out and for praying.
• A weekly review: who you reached, how often you prayed, compared with the week before.

PRIVATE BY DESIGN
• No ads. No tracking. No selling your information.
• Your notes and intentions are visible only to you.
• Import only the contacts you pick; your address book is never uploaded.
• Delete your account and everything in it at any time, from inside the app.

Free to use. Also available on the web.
```

**Keywords**

```
keep in touch,friends,family,relationships,reminder,prayer,intentions,christian,catholic,follow up
```

**Categories:** Primary **Lifestyle**. Secondary **Productivity**.

**URLs**

| Field | Value |
| --- | --- |
| Privacy Policy URL (required) | `https://YOUR-WEB-ADDRESS/privacy` |
| Support URL (required) | A page or address where people can reach you. Simplest: `https://YOUR-WEB-ADDRESS/privacy#contact` |
| Marketing URL (optional) | `https://YOUR-WEB-ADDRESS` |
| Terms (optional "License Agreement" field, or put the link in the description) | `https://YOUR-WEB-ADDRESS/terms` |

**Copyright:** `2026 YOUR NAME`

**Price:** Free. **Availability:** start with the countries whose law you have checked the privacy
policy against.

## Screenshots

Apple requires screenshots for the large iPhone size (6.9-inch, or 6.7-inch); the smaller sizes are
generated from them. Up to ten; three to five is enough. Take them on a real phone or the Simulator
with the demo account, in light mode, with realistic but invented names.

Suggested set, in order, with a caption for each if you add text overlays:

1. **Today**: overdue, due and coming up. "Know who to reach out to today."
2. **A person**: rhythm, quick actions, notes. "Remember what matters to them."
3. **Prayer**: today's intention and the list. "Keep the prayers you promised."
4. **Weekly review.** "See your week at a glance."
5. **Add a person**: the rhythm chips. "A rhythm for each person."

Do not show real people's names, numbers or prayer intentions.

## App Privacy answers

App Store Connect → Koinonia → **App Privacy**. These match what the app and server actually do and
the privacy policy; if you change what is collected, change both.

**Do you or your third-party partners collect data from this app?** Yes.

For every type below: **Linked to the user's identity: Yes. Used for tracking: No.**
Purpose: **App Functionality** only.

| Data type (Apple's name) | Collected | What it is in Koinonia |
| --- | --- | --- |
| Contact Info → **Name** | Yes | Your name |
| Contact Info → **Email Address** | Yes | Your sign-in email |
| Contact Info → **Phone Number** | Yes | Optional phone number on your profile |
| **Contacts** | Yes | The people you add or choose to import: names, phone numbers, emails, birthdays |
| User Content → **Other User Content** | Yes | Notes, reach-out summaries, prayer intentions |
| **Sensitive Info** | Yes | Prayer intentions can reveal religious beliefs. Declaring this is the cautious, honest choice for a prayer app. |
| Identifiers → **User ID** | Yes | Your account ID |
| Identifiers → **Device ID** | Yes | The push notification token, if notifications are turned on |

Everything else: **Not collected.** In particular: Location, Health & Fitness, Financial Info,
Purchases, Browsing History, Search History, Usage Data, Diagnostics, Emails or Text Messages,
Photos or Videos, Audio, Advertising Data.

**Tracking:** the app does not track. There is no advertising or analytics SDK, so no App Tracking
Transparency prompt is needed.

If you later add crash reporting or analytics, add **Diagnostics** / **Usage Data** here and in the
privacy policy before shipping that build.

## Age rating

Answer **None** / **No** to every content question (violence, mature themes, gambling, unrestricted
web access, and so on). The app has no user-to-user messaging and shows no content from other users
beyond a name in member search. Expected result: the lowest rating (4+). The terms require users to
be 13 or older; that is your rule, not the store rating.

## Review information

Paste into **App Review Information**:

- **Sign-in required:** Yes.
- **User name / Password:** the demo account you created on the production server.
- **Contact:** your name, phone and email.
- **Notes:**

```
Koinonia helps people remember to reach out to friends and family and keep a personal prayer list.

Sign in with the demo account above. The Today tab shows who is due. Open a person to see notes, history and "I reached out".

Contacts permission: requested only when the user taps People > "Import from my contacts". The list is shown on the device and only the entries the user ticks are sent to our server; the address book is never uploaded as a whole.

Notifications: local reminders scheduled on the device for people who are due, plus an optional daily push. Requested only when the user turns reminders on in Profile.

Account creation and deletion: accounts are created in the app (Create an account). An account and all its data can be deleted in the app: Profile > Delete my account (password required).

The app has no purchases, ads, tracking or third-party sign-in.
```

## Things reviewers commonly reject, and where Koinonia stands

| Rule | Status |
| --- | --- |
| Accounts must be deletable inside the app (5.1.1(v)) | Done: Profile → Delete my account |
| A privacy policy link in the listing and inside the app (5.1.1) | Done once the web app is deployed and the draft is finalised; the app links to it from sign-up and Profile |
| Permission prompts must say why (5.1.1) | Contacts: text is in `app.json`. Notifications: asked only when the user switches reminders on in Profile. |
| Contacts used only for the stated purpose, never uploaded wholesale (5.1.2) | Done |
| "Sign in with Apple" if other social sign-ins are offered (4.8) | Not applicable: email and password only |
| App must work for the reviewer (2.1) | Needs the deployed server and the demo account |
| Placeholder content (2.1) | Remove the "Draft" banner and all [BRACKETED] text from the legal pages first |
| Minimum functionality / not a web wrapper (4.2) | Native app with notifications, contacts and Keychain |

## Known gaps to close before you rely on this

- The iPhone app has never run on a device. Expect small layout fixes after the first TestFlight
  build.
- Push notifications from the server need `PUSH_ENABLED=true` on the API and the push key EAS
  creates; they have never been sent for real. Local reminders on the phone do not depend on it.
- Password reset and email confirmation open the **web** app from the email; in the iPhone app the
  person pastes the code from the same email. Opening the app straight from the link needs
  universal links (a real domain plus an `apple-app-site-association` file).
