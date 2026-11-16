# Test on a real iPhone: 10 minutes

Everything here is something that could **not** be run while building, because it needs a real
phone: notifications, the address book, the Keychain, the keyboard, and the notch and home-bar
areas. The rest of the app was exercised end to end in a browser preview.

Tick each box. If one fails, note the number and what you saw; that is enough to fix it.

## Before you start (once)

- [ ] The API is reachable from the phone over `https://` (deployed per [DEPLOY.md](DEPLOY.md)).
- [ ] You installed a **TestFlight build** made with `eas build --profile production`
      ([APP_STORE.md](APP_STORE.md)). Not Expo Go: notifications at a set time and the badge
      need a real build.
- [ ] The phone is not in Low Power Mode or a Focus that silences notifications.
- [ ] Have a second way to see the time (a watch), for the reminder test.

## 1. First launch and sign-up (1 min)

- [ ] 1.1 The splash screen shows the logo on dark blue, then the sign-in screen. No white flash.
- [ ] 1.2 Tap **New here? Create an account**. The keyboard does not cover the field you are
      typing in, and the **Create account** button can be reached by scrolling.
- [ ] 1.3 After signing up, the **Welcome** screens appear. The dots at the top are below the
      notch / Dynamic Island, not under it.
- [ ] 1.4 On "Who do you want to stay close to?", add one person by name. They appear in the list
      with a tick.

## 2. Contact import (2 min)

- [ ] 2.1 On the same step tap **Import from my contacts**. iOS asks for permission, and the
      message reads: *"Koinonia reads your contacts only when you choose to import people you
      want to stay in touch with."*
- [ ] 2.2 Choose **Allow Full Access** (or "Select Contacts…" and pick a few). Your contacts
      appear, sorted by name, each with a phone number or email under it.
- [ ] 2.3 If you chose only some contacts, a blue note says so and offers Settings.
- [ ] 2.4 Search for someone by part of their **phone number**. They are found.
- [ ] 2.5 Tick two people and tap **Add 2 people**. It says "2 people added".
- [ ] 2.6 Import the **same two again**. It says they were already in your list and skipped.
- [ ] 2.7 A contact saved with only a first and last name (no "full name") shows up in the list.

If you tapped **Don't Allow** in 2.1: the screen should say Koinonia can't see your contacts and
offer **Open Settings**, which opens the Koinonia page in Settings.

## 3. Notification permission (1 min)

- [ ] 3.1 Continue the welcome. The reminders step explains what will be sent **before** any iOS
      prompt appears.
- [ ] 3.2 Tap **Turn on reminders**. Only now does the iOS prompt appear. Tap **Allow**.
- [ ] 3.3 Finish the welcome and land on **Today**. No card asking about reminders is shown
      (they are already on).
- [ ] 3.4 Profile → **Notifications on this iPhone** is switched on.

If you tapped **Not now** in 3.2: Today should show a card "Want a reminder on this phone?" once
you have at least one person, and **Not now** on that card should make it go away for good.

## 4. A reminder actually arrives (3 min, mostly waiting)

- [ ] 4.1 People → open someone → the pencil → **More details** → "What time should the reminder
      come?" The choices read 7:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM, 8:00 PM.
- [ ] 4.2 Make someone **due today with a reminder in the next couple of minutes**. The quickest
      way: Add a person → name "Test Reminder" → **Custom** → 1 day → More details → "When did you
      last talk?" → yesterday → and for the time, change the phone's clock instead of waiting:
      Settings → General → Date & Time → turn off Set Automatically → set the time to **8:58 AM**.
      (Their reminder is at the default, 9:00 AM.)
- [ ] 4.3 Open Koinonia once (so it re-plans), then **lock the phone**.
- [ ] 4.4 At 9:00 a notification arrives: **"Reach out to Test Reminder"**.
- [ ] 4.5 The Koinonia icon shows a **red badge** with the number of people due.
- [ ] 4.6 **Tap the notification.** The app opens on **Test Reminder's page**, not on Today.
- [ ] 4.7 Swipe the app away completely (app switcher → swipe up). Repeat 4.2 to 4.4 with the
      clock at 8:58 the next day, and tap the notification while the app is **closed**. It still
      opens that person's page.
- [ ] 4.8 On their page tap **I reached out** → **Save**. Go to the Home Screen: the **badge
      number went down** (or disappeared).
- [ ] 4.9 Set the clock back to **Set Automatically**.

## 5. Staying signed in (1 min)

- [ ] 5.1 Swipe the app away and open it again. You are still signed in, straight to Today.
- [ ] 5.2 Restart the phone, open the app. Still signed in.
- [ ] 5.3 Profile → **Sign out**. Open the app again: it shows sign-in, and the icon badge is gone.
- [ ] 5.4 Sign back in. Your people are all there.

## 6. Keyboard and screen edges (1 min)

- [ ] 6.1 Open a person → **Add note**. Type several lines. The text you are typing stays above
      the keyboard, and **Save note** can be reached.
- [ ] 6.2 On Today, People and Pray, the title is clear of the clock and the notch, and the last
      row is clear of the tab bar and the home bar.
- [ ] 6.3 The tab bar shows **Today, People, Pray, Profile** with icons, and the current tab is
      highlighted.
- [ ] 6.4 Tap a date field (a note's "Remind me about this"). The calendar opens centred, and
      tapping outside it closes it.
- [ ] 6.5 Tap **Delete** on a note. A confirmation appears with **Cancel** and **Delete**.
- [ ] 6.6 Turn on Dark Mode (Control Centre). Every screen is readable; no white boxes.
- [ ] 6.7 Settings → Display → Text Size → largest. Buttons still show their whole label.

## 7. Bad signal (1 min)

- [ ] 7.1 Open a person → **Add note** → type something → turn on **Airplane Mode** → **Save
      note**. An error says Koinonia can't be reached, and **your text is still there**.
- [ ] 7.2 A dark strip near the bottom says "Can't reach Koinonia" with **Try again**.
- [ ] 7.3 Close the note screen, open **Add note** again. It says "We kept what you were writing
      last time" and the text is back.
- [ ] 7.4 Turn Airplane Mode off → **Save note**. It saves, once (check the person's page shows
      the note one time, not twice), and the strip goes away.

## 8. Things that open other apps (30 seconds)

- [ ] 8.1 On a person with a phone number: **Call** opens the Phone app with their number;
      **Text** opens Messages.
- [ ] 8.2 "Not sure what to say?" → tap a suggestion. Messages opens with that text filled in.
- [ ] 8.3 Profile → **Export my data** → **Everything (one file)**. The share sheet opens; "Save
      to Files" or Mail receives the text.
- [ ] 8.4 Profile → **Privacy Policy** opens the web page in Safari.

## If something fails

| What you see | Most likely cause |
| --- | --- |
| No iOS prompt for notifications at 3.2 | It was answered before on this phone. Delete the app and reinstall to test the first-time path. |
| No notification at 4.4 | Notifications off (Profile shows the switch off), a Focus mode, or the app was not opened after changing the clock. |
| Notification arrives but tapping opens Today | Report it: the link inside the notification is not being followed. |
| No badge at 4.5 | Settings → Notifications → Koinonia → **Badges** is off. |
| Import shows "Couldn't read your contacts" | Report the exact message on that screen. |
| Signed out after a restart (5.2) | Report it: the Keychain is not keeping the session. |
| Sign-in fails with "Can't reach Koinonia" | The API address in `apps/mobile/eas.json` is wrong or not `https://`. |
| Keyboard covers the field (1.2, 6.1) | Report which screen. |
