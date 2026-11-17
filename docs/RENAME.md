# Renaming the app

The name, tagline, bundle identifier, link scheme, default addresses and email sender live in
**one file: `packages/shared/brand.json`**. The web app, the API, the phone app's native
settings, the smoke test and the legal pages all read it.

A trial rename to "Koino" was run while building this: the web app built with no visible
"Koinonia" left, and the phone configuration picked up the new name, including the wording iOS
shows when asking for contacts. Then it was put back.

## The one change

Edit `packages/shared/brand.json`:

| Key | What it is | Example for a rename |
| --- | --- | --- |
| `name` | The name people see everywhere | `Koino` |
| `slug` | Lower-case, no spaces: export file names, Expo's short name | `koino` |
| `tagline`, `description` | The line under the name; the longer description on the public page | |
| `origin`, `originCaps` | The small line above the tagline on sign-in screens (the Greek word and its meaning) | keep, change or empty |
| `inviteMessage` | What "Invite a friend" sends; `{name}` and `{url}` are filled in | |
| `bundleId` | The phone app's identifier in the App Store | `com.yourname.koino` |
| `urlScheme` | The phone app's link scheme | `koino` |
| `emailSenderName`, `emailSenderAddress` | Who emails come from when `EMAIL_FROM` is not set | `Koino`, `hello@yourdomain` |
| `defaultWebUrl`, `defaultApiUrl` | Addresses used on your own computer | leave |

Then:

```bash
pnpm rename:check Koinonia
```

It lists any place the old name is still written out in code people can see. It should print
`No visible "Koinonia" left in the code.`

```bash
pnpm check
```

Rebuild and redeploy the web app and API, and make a new phone build.

## Things that file cannot change

| What | Where | Note |
| --- | --- | --- |
| **`bundleId`, once the app is on TestFlight or the App Store** | Apple | A different bundle identifier is a **different app** to Apple: new listing, testers start again, nobody is updated automatically. Decide the name and identifier **before** the first TestFlight build. Changing only the display `name` later is fine. |
| The app's name on the App Store listing | App Store Connect | Typed there by hand; must be unique on the store. |
| The icon and splash image | `apps/mobile/assets/images/` | Only if the artwork contains the name. The current ones do not. |
| Real addresses | Your host's settings | `WEB_URL`, `API_PUBLIC_URL`, `EMAIL_FROM`, `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`: these are deployment settings, not part of the name. A new domain means changing them there (docs/DEPLOY_AZURE.md). |
| Host resource names | Azure / Render / Vercel | `koinonia-api` and friends are only labels in your account. Renaming them is optional and changes the default addresses. |
| The documents in `docs/`, `README.md`, `STATUS.md` | this repository | Written for you, not shown to users. Search and replace when convenient. |
| The GitHub repository name | GitHub | Optional. |

## Deliberately left alone

These contain the old word but are never shown to anyone, and changing them would break
something:

- **`@koinonia/shared`, `@koinonia/api`, ...**: internal package names.
- **`koinonia_session` (cookie), `koinonia.token`, `koinonia.theme` and other storage keys**:
  renaming them would sign everyone out and forget their settings.
- **`X-Koinonia-Client`**: a header the apps send to the API. Old phone builds would stop
  working if it changed.
- **`@koinonia.app` demo accounts** in the local demo seed.
- **Database names and existing migrations.**

## Checking a candidate name first

Before changing anything: say it aloud to five people and ask them to type it a day later;
search the App Store for it; check the `.com`; and search the trademark register (USPTO TESS in
the US) for the same or a similar name in software. None of that was done for "Koino" here.
