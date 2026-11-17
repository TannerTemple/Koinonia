# Tonight: deploy Koinonia in about an hour

Do the steps in order. Each one ends with **what success looks like**; do not go on until you
see it. Button names on Neon, Render and Vercel change now and then; if one differs slightly,
pick the closest. The long version with explanations is [DEPLOY.md](DEPLOY.md); you should not
need it tonight.

Open a text file now. You will collect four things in it:

```
DATABASE_URL  =
DIRECT_URL    =
API address   =
Web address   =
```

| Step | Time |
| --- | --- |
| 1. Get the code and run it on your computer | 10 min |
| 2. Neon (database) | 5 min |
| 3. Render (API) | 15 min, mostly waiting |
| 4. Vercel (web app), then tell Render about it | 10 min |
| 5. Smoke test | 2 min |
| 6. Make yourself admin | 2 min |
| 7. iPhone in Expo Go | 10 min |

---

## 1. Get the code and run it locally (10 min)

1. On GitHub, open the pull request
   [TannerTemple/Koinonia#1](https://github.com/TannerTemple/Koinonia/pull/1). Check it shows a
   green tick, then click **Merge pull request** → **Confirm merge**. (Render and Vercel deploy
   `main`, so the code has to be there.)
2. In a terminal, in the Koinonia folder:

```bash
git checkout main
```

```bash
git pull
```

```bash
pnpm install
```

3. Start the local database (Docker Desktop must be running):

```bash
pnpm db:up
```

4. Only if `apps/api/.env` does not exist yet:

```bash
cp .env.example apps/api/.env
```

5. Create the tables and start both apps:

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

6. In a **second** terminal, in the same folder:

```bash
pnpm smoke http://localhost:4000 http://localhost:3000
```

**Success:** the last line is `ALL 12 CHECKS PASSED. (1 skipped)`. Leave nothing running you do
not want: press Ctrl+C in the first terminal to stop the apps.

If this step fails, stop and fix it here. Do not deploy code that does not run locally.

---

## 2. Neon: the database (5 min)

1. Go to **console.neon.tech** → **New Project**.
2. Name `koinonia`. Region **AWS US West 2 (Oregon)** (same place as Render). **Create**.
3. Click **Connect** (top right of the project dashboard).
4. Make sure **Connection pooling** is **on**. Click **Show password**, then **Copy snippet**.
   Paste into your text file after `DATABASE_URL =`. Its host contains **`-pooler`**.
5. Switch **Connection pooling off**. Copy again. Paste after `DIRECT_URL =`. Its host has
   **no** `-pooler`.

**Success:** two lines that both start with `postgresql://`, both contain your real password
(no `****`), and differ only by `-pooler`:

```
DATABASE_URL = postgresql://neondb_owner:abc123@ep-cool-name-123456-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
DIRECT_URL   = postgresql://neondb_owner:abc123@ep-cool-name-123456.us-west-2.aws.neon.tech/neondb?sslmode=require
```

If what you copied starts with `psql '`, keep only the part between the quotes.

---

## 3. Render: the API (15 min)

1. Go to **dashboard.render.com** → **New +** → **Blueprint**.
2. Connect GitHub if asked, and pick the **Koinonia** repository. Branch **main**.
3. Blueprint name `koinonia`. Render shows one service, **koinonia-api**, and asks for **two**
   values. Paste them **without** quotes:
   - `DATABASE_URL` → your pooled string (with `-pooler`)
   - `DIRECT_URL` → your direct string (without)
4. Click **Deploy Blueprint**. (The Starter instance costs about $7 a month; Render asks for a
   card. To pay nothing tonight, open the service → **Settings** → **Instance Type** → **Free**
   afterwards; a free instance sleeps when idle and takes about a minute to wake.)
5. Click **koinonia-api** and watch **Logs**. The first build takes 5 to 10 minutes.
6. At the top of the service page is its address, like `https://koinonia-api.onrender.com`.
   Paste it into your text file after `API address =`.

**Success:** the service shows a green **Live**, the log contains
`All migrations have been successfully applied.` and a line starting `ready:`, and opening
**API address + `/health/ready`** in a browser shows `{"ok":true,"database":"up"}`.

If the deploy fails, the **last lines of the log say which setting is wrong in plain English**.
Fix it under **Environment** → **Save Changes**; Render redeploys by itself.

---

## 4. Vercel: the web app (10 min)

1. Go to **vercel.com/new** → find **Koinonia** → **Import**.
2. **Root Directory:** click **Edit** → choose **`apps/web`** → **Continue**. This is the one
   setting people miss.
3. Leave Framework (Next.js) and the build settings alone.
4. Open **Environment Variables** and add **one**:
   - Optional, recommended: Key `PROXY_SECRET`, Value copied from Render → koinonia-api →
     **Environment** → `PROXY_SECRET` (click the eye to reveal). It gives each web visitor their
     own rate limit.
   - Key `API_PROXY_TARGET`, Value your **API address** (for example
     `https://koinonia-api.onrender.com`)
5. Click **Deploy**. 2 to 4 minutes.
6. Click **Continue to Dashboard**. Under **Domains** is the short address, like
   `https://koinonia.vercel.app`. Paste it into your text file after `Web address =`.

**Success:** opening the web address shows the Koinonia sign-in page. Do not sign up yet.

Now tell the API where the web app lives:

7. Render → **koinonia-api** → **Environment** → **Add Environment Variable**:
   - Key `WEB_URL`, Value your **Web address**
8. **Save Changes** (choose "Save and deploy" if asked). Wait for **Live** again, about 2 minutes.

**Success:** the Render log's `ready:` line now shows your web address twice.

---

## 5. Smoke test (2 min)

In a terminal in the Koinonia folder, with **your** two addresses, API first:

```bash
pnpm smoke https://koinonia-api.onrender.com https://koinonia.vercel.app
```

**Success:** `ALL 14 CHECKS PASSED.` It made a throwaway account, used it, and deleted it.

Any `FAIL` line is followed by a `Fix:` line saying exactly what to change. Fix the **first**
failure, then run the command again.

---

## 6. Sign up and make yourself admin (2 min)

1. Open the web address → **Create an account** → use your real email.
2. In the terminal, with your email and your **`DIRECT_URL`** in the quotes:

```bash
pnpm make-admin you@example.com --db "postgresql://...your DIRECT_URL..."
```

**Success:** it prints `Done. <Your name> (you@example.com) is now an admin.` Reload the web
app: **Admin** is in the menu. Running it twice is harmless.

Optional health report for the hosted database (creates nothing):

```bash
pnpm db:seed:prod --db "postgresql://...your DIRECT_URL..."
```

Never run `pnpm db:seed` against Neon; it is demo data for your own computer and it refuses.

---

## 7. iPhone in Expo Go (10 min)

1. On the iPhone, install **Expo Go** from the App Store (update it if already installed).
2. Put the iPhone and the computer on the **same Wi-Fi**.
3. In the terminal, point the app at the hosted API (your two addresses):

```bash
printf 'EXPO_PUBLIC_API_URL="https://koinonia-api.onrender.com"\nEXPO_PUBLIC_WEB_URL="https://koinonia.vercel.app"\n' > apps/mobile/.env
```

```bash
cd apps/mobile
```

```bash
npx expo start -c
```

4. A QR code appears. Open the iPhone **Camera**, point it at the code, tap the yellow
   **Open in Expo Go** banner.
5. Sign in with the account from step 6.

**Success:** Today shows on the phone, and a person you add on the phone appears on the web app
after a reload.

Expo Go is fine for tonight. Reminders at a set time, the icon badge and "tap a notification to
open that person" only behave properly in a real build; that is
[TEST_ON_PHONE.md](TEST_ON_PHONE.md), for another day.

---

## The five most likely errors

| # | What you see | Fix |
| --- | --- | --- |
| 1 | Render deploy fails; log ends with `Koinonia cannot apply database migrations` or `Koinonia API cannot start` | The line under it names the variable. Nine times in ten the two Neon strings are swapped, in quotes, or `DIRECT_URL` has `-pooler` in it. Render → Environment → fix → Save Changes. |
| 2 | Vercel build fails with `No Next.js version detected`, or with `Koinonia web cannot be built` | First one: **Root Directory** is not `apps/web` (Settings → Build and Deployment → Root Directory). Second one: `API_PROXY_TARGET` is missing or mistyped (Settings → Environment Variables). Then Deployments → ⋯ → **Redeploy**. |
| 3 | Web page loads, but signing up says it can't reach Koinonia; smoke test fails at "Web app forwards /api" | `API_PROXY_TARGET` on Vercel is not exactly the API address (`https://`, no path, no typo). Fix it and **Redeploy**: Vercel only reads variables during a build. |
| 4 | Smoke test fails at "API lets browsers ... call it (CORS)" | `WEB_URL` on Render is missing or not exactly the web address. Fix → Save Changes → wait for Live. Does not block the web app itself, so you can carry on and fix it after. |
| 5 | Expo Go: "Can't reach Koinonia", or the QR code will not open | `apps/mobile/.env` has the wrong address, or Expo was started before the file existed: stop it (Ctrl+C) and run `npx expo start -c` again. If the phone cannot load the project at all (different Wi-Fi, guest network): `npx expo start -c --tunnel`. If Expo Go says the project is incompatible, update Expo Go. |

Also worth knowing:

- **The first request after a quiet spell is slow** (the database wakes up; on a free Render
  instance the API does too). Wait 30 to 60 seconds and try again before deciding it is broken.
- **"Forgot password" sends nothing yet.** Email is switched off until you set up Resend
  ([DEPLOY.md](DEPLOY.md), "Real email"). Do not forget your password tonight.
- **Testers can report problems from inside the app**: Settings (web) or Profile (phone) →
  "Send feedback or report a problem". You read them on the web under **Admin**, at the bottom.
- **Something else?** Render → Logs is the first place to look; errors there are in plain English
  and never contain passwords.

## What has and has not been tried

Tried while building: the API built and started in production mode against a real PostgreSQL
with migrations applied the way Render does it, the web app built the way Vercel does it, and
the smoke test passing against both. **Not** tried: the real Neon, Render and Vercel (no
accounts were used), the Docker build itself (its steps were replayed by hand), and the app in
Expo Go on a phone. If a step above does not match what you see, the error table is the best
guide.
