# Sign in with Google, Microsoft and Apple

All three are built and **off** until you switch them on. Each needs an account with that
company and about 15 minutes. Do them one at a time; each works on its own.

**What was tested here:** the whole flow against fake providers that publish keys and sign real
tokens exactly as the real ones do (26 tests), and in a real browser with the built-in pretend
providers. **Not tested:** against the real Google, Microsoft or Apple (no developer accounts
were used), and on a real iPhone. Their consoles get rearranged often; if a button below is
named slightly differently, pick the closest.

## How it behaves

- **The buttons** ("Continue with Apple / Google / Microsoft") appear on the sign-in and
  create-account screens of the web and iPhone apps, only for the providers you switch on.
- **"Used last time"**: after someone signs in, that button is marked and moved to the top on
  that browser or phone. Email sign-in shows "Used last time" next to the email instead.
- **New people** get an account straight away (name and email from the provider; the email
  counts as confirmed). They have no password; Settings offers "Set a password", and deleting
  the account asks them to type DELETE instead of a password.
- **Existing accounts are linked by verified email only.** If someone with an email account
  later taps "Continue with Google" using the same address, they reach the same account,
  **provided** Google confirmed the address *and* the existing account had confirmed its email.
  An address the provider has not verified is never used. Microsoft work or school accounts
  only count when Microsoft says the directory owns the email's domain. After the first time,
  the link is by the provider's own permanent account id, so a changed email does not matter.

## The address you register everywhere ("redirect URI")

Each provider asks where to send people back. It must match **exactly**:

| Provider | Hosted (your real web address) |
| --- | --- |
| Google | `https://YOUR-WEB-ADDRESS/api/v1/auth/oauth/google/callback` |
| Microsoft | `https://YOUR-WEB-ADDRESS/api/v1/auth/oauth/microsoft/callback` |
| Apple | `https://YOUR-WEB-ADDRESS/api/v1/auth/oauth/apple/callback` |

`YOUR-WEB-ADDRESS` is the web app, for example `koinonia.vercel.app` or
`koinonia-web.<something>.azurecontainerapps.io`, with no trailing slash. (It goes through the
web app's `/api` so the sign-in cookie belongs to the web app.) If you move to your own domain,
add the new address at each provider and keep the old one until everyone has moved.

For trying Google or Microsoft on your own computer, also add
`http://localhost:4000/v1/auth/oauth/google/callback` (and `.../microsoft/callback`). Apple does
not accept `localhost`; use the pretend providers for that (end of this page).

---

## Google (15 min, free)

1. Go to **console.cloud.google.com**, sign in with the Google account that should own this.
2. Top bar → project picker → **New project** → name `Koinonia` → **Create**. Make sure it is
   selected.
3. Search for **Google Auth Platform** (older name: "OAuth consent screen") → **Get started**.
   - **App name:** Koinonia. **User support email:** yours. **Next.**
   - **Audience:** **External**. **Next.**
   - **Contact information:** your email. **Next**, agree, **Create**.
4. **Branding** (left menu): add your web address under **Authorized domains** (just the domain,
   e.g. `vercel.app` is not allowed: use your own domain if you have one; with only a
   `*.vercel.app` or `*.azurecontainerapps.io` address, leave it empty). Add links to your
   **privacy policy** (`https://YOUR-WEB-ADDRESS/privacy`) and **terms**
   (`https://YOUR-WEB-ADDRESS/terms`). **Save.**
5. **Data access** → **Add or remove scopes** → tick `openid`, `.../auth/userinfo.email` and
   `.../auth/userinfo.profile` → **Update** → **Save**. These are "non-sensitive": no Google
   review of the app is needed for them.
6. **Clients** → **Create client** → type **Web application** → name `Koinonia web` →
   **Authorized redirect URIs** → **Add URI** → the Google address from the table above (and the
   localhost one if you want to try locally) → **Create**.
7. Copy the **Client ID** and **Client secret** shown. (The secret can be seen again later in
   the client's page.)
8. **Audience** → **Publish app** → **Confirm**. Until you do, only up to 100 "test users" you
   list there can sign in.

**Settings on the API** (Render: Environment; Azure: see below):

| Name | Value |
| --- | --- |
| `SIGNIN_PROVIDERS` | `google` (add the others with commas as you set them up: `google,microsoft,apple`) |
| `GOOGLE_CLIENT_ID` | the Client ID, ending `.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | the Client secret (a secret) |

**Success:** the sign-in page shows "Continue with Google"; using it ends on Today (or the
welcome, for a new account).

## Microsoft (15 min, free)

You need a Microsoft account; the Azure portal works with the same one you host on.

1. **portal.azure.com** → search **Microsoft Entra ID** → **App registrations** →
   **New registration**.
   - **Name:** Koinonia.
   - **Supported account types:** **Accounts in any organizational directory and personal
     Microsoft accounts** (the third option, "Multitenant and personal").
   - **Redirect URI:** platform **Web**, the Microsoft address from the table above.
   - **Register.**
2. On the app's **Overview**, copy the **Application (client) ID**.
3. **Certificates & secrets** → **Client secrets** → **New client secret** → description
   `Koinonia`, expiry **24 months** → **Add**. Copy the **Value** at once (not the "Secret ID");
   it is shown only now. **Put the expiry date in your calendar**: sign-in with Microsoft stops
   the day it runs out until you make a new one.
4. **Token configuration** → **Add optional claim** → token type **ID** → tick **email** and
   **xms_edov** → **Add** (accept the prompt to add the Graph permission). `xms_edov` is how
   Microsoft says a work or school directory really owns the email's domain; without it, only
   personal Microsoft accounts can link to existing Koinonia accounts.
5. **API permissions**: check `openid`, `email` and `profile` (Microsoft Graph, delegated) are
   listed; add any missing with **Add a permission** → **Microsoft Graph** → **Delegated**.
6. Optional, later: **Branding & properties** → add your logo, home page, privacy and terms
   links, and **publisher verification** (needs a Microsoft Partner account). Until then
   Microsoft shows people "unverified" on its consent page. It still works.

**Settings on the API:**

| Name | Value |
| --- | --- |
| `SIGNIN_PROVIDERS` | add `microsoft` |
| `MICROSOFT_CLIENT_ID` | the Application (client) ID |
| `MICROSOFT_CLIENT_SECRET` | the secret's **Value** (a secret) |

## Apple (20 min; needs the Apple Developer Program, $99 a year)

You need the paid membership anyway for TestFlight. Apple calls the web version of its button
a "Services ID".

1. **developer.apple.com/account** → **Membership details**: copy your **Team ID** (10
   characters).
2. **Certificates, Identifiers & Profiles** → **Identifiers** → find (or create with **+** →
   **App IDs** → **App**) the App ID for the iPhone app, bundle ID as in
   `packages/shared/brand.json` (`bundleId`). Open it, tick **Sign In with Apple** → **Save**.
3. **Identifiers** → **+** → **Services IDs** → **Continue**.
   - **Description:** Koinonia web sign-in. **Identifier:** your bundle ID plus `.signin`, for
     example `com.koinonia.app.signin`. **Continue** → **Register**.
   - Open it, tick **Sign In with Apple** → **Configure**:
     - **Primary App ID:** the one from step 2.
     - **Domains and Subdomains:** your web address without `https://`, e.g.
       `koinonia.vercel.app`.
     - **Return URLs:** the Apple address from the table above.
     - **Next** → **Done** → **Continue** → **Save**.
4. **Keys** → **+** → name `Koinonia sign in` → tick **Sign in with Apple** → **Configure** →
   primary App ID from step 2 → **Save** → **Continue** → **Register**.
5. **Download** the key (a `.p8` file). **Apple lets you download it once.** Keep it somewhere
   safe. Copy the **Key ID** shown.

**Settings on the API:**

| Name | Value |
| --- | --- |
| `SIGNIN_PROVIDERS` | add `apple` |
| `APPLE_CLIENT_ID` | the **Services ID** from step 3 (e.g. `com.koinonia.app.signin`), not the bundle ID |
| `APPLE_TEAM_ID` | from step 1 |
| `APPLE_KEY_ID` | from step 5 |
| `APPLE_PRIVATE_KEY` | the whole contents of the `.p8` file, including the `-----BEGIN PRIVATE KEY-----` and `-----END...` lines (a secret). If your host only takes one line, replace each line break with `\n`. |

Apple shares the person's name only the very first time they use it with your app, and may hand
out a private relay address (`...@privaterelay.appleid.com`) instead of their real email. Both
are handled. To send email to relay addresses, register your sending domain under **Services**
→ **Sign in with Apple for Email Communication** in the developer account.

---

## Putting the settings on your host

**Render:** koinonia-api → **Environment** → **Add Environment Variable** for each → **Save
Changes**. Nothing changes on the web app.

**Azure** (in the terminal from [DEPLOY_AZURE.md](DEPLOY_AZURE.md)), for example Google:

```bash
az containerapp secret set -g koinonia -n koinonia-api --secrets google-secret="PASTE-THE-SECRET"
```

```bash
az containerapp update -g koinonia -n koinonia-api --set-env-vars SIGNIN_PROVIDERS=google GOOGLE_CLIENT_ID=PASTE-THE-ID GOOGLE_CLIENT_SECRET=secretref:google-secret
```

For Apple, put the `.p8` contents in a secret the same way:
`--secrets apple-key="$(cat AuthKey_XXXX.p8)"` and `APPLE_PRIVATE_KEY=secretref:apple-key`.

If a setting is missing, the API refuses to start and its log names exactly which one
("SIGNIN_PROVIDERS includes google, so GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set
too").

## On the iPhone

The buttons open the provider in Apple's secure sign-in sheet and come back to the app through
its link (`koinonia://auth`). That link only exists in a **real build** (TestFlight or a
development build), not in **Expo Go**: in Expo Go the sheet opens but cannot return. Use email
sign-in in Expo Go.

Nothing extra is needed in Xcode or `app.json` for this way of signing in. One thing to know for
App Review: Apple's rule (guideline 4.8) is that an app offering Google or Microsoft sign-in
must also offer Sign in with Apple; this app does. Reviewers occasionally ask for Apple's native
button rather than the web sheet; if that happens, the change is to use
`expo-apple-authentication` for the Apple button on iPhone (not built).

## Trying it without any accounts (your own computer)

Add to `apps/api/.env`:

```
OAUTH_MOCK=true
SIGNIN_PROVIDERS=google,microsoft,apple
```

Restart `pnpm dev`. Each button now opens a "Pretend Google/Microsoft/Apple" page where you type
any email, choose whether the provider "confirmed" it, and continue or cancel. The API refuses
to start if `OAUTH_MOCK` is on in production.

## Turning one off

Remove it from `SIGNIN_PROVIDERS` and restart. People who signed up with it keep their accounts:
they can use "Forgot password" to set a password and sign in with their email.

## If something goes wrong

| What you see | Fix |
| --- | --- |
| Google: "Error 400: redirect_uri_mismatch" | The Google redirect URI is not exactly the one in the table (check `https`, the `/api`, no trailing slash). |
| Microsoft: "AADSTS50011" | Same, for the Microsoft redirect URI (Authentication → Web → Redirect URIs). |
| Microsoft: "AADSTS7000215: Invalid client secret" | You copied the Secret ID instead of the Value, or it expired. Make a new one. |
| Apple: "invalid_client" | `APPLE_CLIENT_ID` must be the Services ID, not the bundle ID; or the Team ID, Key ID and key do not belong together. |
| Back on the sign-in page with "That took too long, or was started in another browser" | The attempt lasts 10 minutes and must finish in the browser that started it. Also happens if third-party cookies are blocked *and* the web and API addresses differ; they should not with the `/api` setup. |
| "...didn't confirm your email address" | Working as intended: that provider did not vouch for the email. Use another way to sign in. |
| "There's already an account with this email, but its email address was never confirmed" | Sign in with the password once and confirm the email (Settings shows how), then the button works. |
