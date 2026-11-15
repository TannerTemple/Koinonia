# Bugs and rough edges

Found by using the app end to end as a new user and as a user with awkward data (overdue people,
very long names and notes, a birthday without a year), on the web app (desktop and phone width) and
in the mobile browser preview. Worst first. Status is as of the end of this round.

How it was tested: scripted walkthroughs that click through every flow and take a screenshot at
each step, which were then read one by one. Flows covered on both: sign up, add a person, choose
how often, log a reach-out, add a note with a follow-up date, add a prayer, mark it prayed, weekly
review, forgot and reset password.

## Bugs

| # | Where | What was wrong | Status |
| --- | --- | --- | --- |
| B1 | Mobile preview | **Every confirmation and "…" menu did nothing.** Delete a note, remove a reach-out, delete a person, the options menu on a prayer (answered, archive, edit, delete), and several messages on Profile all used the phone's native alert, which does not exist in a browser. Tapping them had no effect and showed no error. | Fixed: the app now draws its own dialog, which works the same on iPhone and in the browser. |
| B2 | Web and mobile | **A birthday saved without a year showed a made-up year** ("Nov 20, 2000") on the person's page. | Fixed: shows "Nov 20". |
| B3 | Web | **Editing a person erased a birthday that had no year.** The date box can't hold a date without a year, so it opened blank and saved blank. | Fixed: birthday is now month, day and an optional year. |
| B4 | Mobile | **Birthday had to be typed as `MM-DD` or `YYYY-MM-DD`.** Easy to get wrong, and the error only said the format was invalid. | Fixed: month, day and optional year, same as web. |
| B5 | Web | **The "Log it" button promised the wrong date.** It always said "next in 14 days", even when you chose an earlier day for the reach-out (the clock counts from the day you pick). | Fixed: the button says "Save" and the line above it gives the real next date. |
| B6 | Web and mobile | **Today could look finished when it wasn't.** With nobody due today the screen said "You're all caught up" and gave no way to see who is next beyond two weeks, so a new user with one person on a monthly rhythm saw an empty screen. | Fixed: Today always names who is next and when. |
| B7 | Mobile | **A person form error could be invisible.** A bad phone number or email was reported next to its field, far down a long form, with nothing near the Save button. | Fixed: the message is repeated above the button, and the optional section opens itself when the problem is inside it. |
| B8 | Mobile preview | **Tab labels were 10px.** | Fixed: larger labels and icons. |

| B9 | Web and mobile (server) | **"That wasn't found" after marking your only prayer answered** (or archiving or deleting it). Today and the prayer list both ask the server for today's prayer at the same moment; both tried to clear the old one and the slower request failed, which blanked the whole screen with an error. The same race could happen the first time a day's prayer was picked. | Fixed on the server, with a test that fires simultaneous requests. |
| B10 | Mobile | **Call, Text and Email looked broken for a person with no phone or email**: three greyed-out buttons with no explanation. | Fixed: the row is replaced by "Add their phone or email", which opens the form with that section open. |

## Rough edges (things that worked but confused)

| # | Where | What was confusing | Status |
| --- | --- | --- | --- |
| R1 | Web and mobile, Today | The first thing on the screen was three counters reading "0 day reach-out streak", "0 day prayer streak", "0 this week". They pushed the actual to-do list down and meant nothing to a new user. | Changed: Today is now two plain sections, **Reach out** and **Pray**. Streaks are one small line at the bottom, shown only once there is something to show. |
| R2 | Web and mobile, Today | Separate "Overdue", "Reach out today", "Follow-ups from your notes" and "Coming up" lists, in an order that put prayer in the middle. | Changed: one **Reach out** list (late first, then today), then things you wanted to ask about, then who is next. |
| R3 | Web and mobile | On a person who is due, the actions were an unlabelled alarm-clock icon and a button that said "Done" (mobile) or "Reached out" (web). | Changed: **I reached out** and **Not today**, both in words. "Not today" says when you will be reminded again. |
| R4 | Web and mobile | "Today's intention", "Add intention", "New intention", "Kind". Church vocabulary that a twelve-year-old or a newcomer may not know. | Changed: "Pray today for", "Add to prayer list", "What do you want to pray for?". The word "intention" stays only where it is explained. |
| R5 | Web and mobile, new user | A new account landed on a greeting, three zeros and two unrelated cards. Nothing said what to do first. | Changed: a "Getting started" card with three steps that tick themselves off: add a person, add something to pray for, tap "I reached out" after you talk to someone. |
| R6 | Web and mobile, add a person | Eight fields before the one that matters ("how often?"), including phone, email, relationship, birthday, usual way to reach them and last time you talked. | Changed: name and how often. Everything else is under "More details (optional)". |
| R7 | Web and mobile, add a prayer | "Details", "For someone?" and "Kind" all shown up front. | Changed: what you are praying for, and who for. The rest is under "More (optional)". |
| R8 | Mobile, notes | Four unlabelled icons under each note (tick, pin, pencil, bin). | Changed: words: "Done", "Pin", "Edit", "Delete". |
| R9 | Web | "Confirm your email" was a large banner on top of every page, above the content people came for. | Changed: one slim line, and it can be dismissed for the session. |
| R10 | Web | Text was small for older eyes (15px inputs, 12 to 13px captions). | Changed: everything is about 6% larger, and the smallest captions are a size up. |
| R11 | Web, phone width | The bottom navigation had no "add" and the Today page had no obvious way to add a person once you had one. | Changed: "Add a person" and "Add to prayer list" are always on Today. |
| R12 | Web and mobile, weekly review | For a new user it was a page of zeros and an empty chart. | Changed: a short explanation until there is a first reach-out or prayer. |
| R13 | Web and mobile | Due badges read "Due in 7 days" in some places and the list subtitle repeated the rhythm ("Every week · last today"), so one row carried three facts. | Changed: rows on Today show one line: when they are due. |
| R14 | Mobile, Prayer | The heart-shaped circle that marks a prayer as prayed had no label, and the "…" next to it did nothing in the preview (B1). | Changed: the circle is labelled "Prayed" once ticked, and the row says "Tap the circle when you've prayed" until the first time. |

## Not changed

| # | Where | What | Why |
| --- | --- | --- | --- |
| N1 | Mobile | Long names are cut with "…" in list rows. | Correct behaviour; the full name is on the person's page. |
| N2 | Web | The browser's own date box is used for "when" on a reach-out and a note follow-up. | It is the platform's control and works with keyboards and screen readers; the mobile app has its own calendar. |
| N3 | Mobile preview | Call, Text and Email buttons do nothing useful in a desktop browser. | They open the phone's dialer and messages on a real iPhone. |
