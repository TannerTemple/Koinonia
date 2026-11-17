# Deploying Koinonia: Neon + Render + Vercel

> **In a hurry?** [TONIGHT.md](TONIGHT.md) is the same deployment as a one-page checklist. This
> file is the reference: every variable, why it is there, and the optional extras.

| Piece | Host | What it is |
| --- | --- | --- |
| Database | **Neon** | PostgreSQL. Two connection strings: pooled (`DATABASE_URL`) and direct (`DIRECT_URL`). |
| API | **Render** | `apps/api` as a Docker web service, Starter instance, health-checked, redeployed on every push. |
| Web app | **Vercel** | `apps/web` (Next.js), redeployed on every push. |
| iPhone app | EAS / App Store | Built separately; it only needs the API's address. See [APP_STORE.md](APP_STORE.md). |

> **What was and wasn't tested.** The API was installed, built and started exactly as the Dockerfile
> does it (clean filtered install, build, migrations through `DIRECT_URL`, production start, both
> health checks), and the web app was run against it through the proxy described below, in a real
> browser. Three things could not be done in the build environment: building the Docker image itself
> (it blocks the Debian package mirrors; two attempts), connecting to a real Neon database, and
> deploying to Render or Vercel (no accounts may be created). `render.yaml` was checked for valid
> syntax only. Button names on the three dashboards change; where a label differs from what is
> written here, look for the nearest equivalent. Expect to adjust a setting or two the first time.

## Every environment variable, and where it goes

Variables marked **you choose** are addresses you only know after the service exists; the steps
below tell you when.

### On Render (the API)

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Neon **pooled** connection string | Host contains `-pooler`. Used by the running API. |
| `DIRECT_URL` | Neon **direct** connection string | Host has no `-pooler`. Used only to apply migrations when the API starts. |
| `WEB_URL` | `https://YOUR-WEB.vercel.app` | **You choose.** The web app's address. Goes into the links in emails, and is the browser origin allowed to call the API. Added by hand in step 4. |
| `CORS_ORIGINS` | do not set | Defaults to `WEB_URL`. Set it only to allow more than one origin (comma-separated, never `*`). |
| `API_PUBLIC_URL` | do not set | Defaults to the address Render gives the service. Set it only when the API has its own domain. |
| `NODE_ENV` | `production` | Set by `render.yaml`. |
| `PROXY_SECRET` | generated | Set by `render.yaml` with a random value. Copy it to the web app's `PROXY_SECRET`. |
| `TRUST_PROXY` | `1` | Set by `render.yaml`. Render has one proxy in front of the service. |
| `EMAIL_PROVIDER` | `mock`, later `resend` | Set by `render.yaml`. See "Real email". |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | from Resend | Only with `EMAIL_PROVIDER=resend`. |
| `FEEDBACK_EMAIL` | your address | Optional. "Send feedback" messages are always saved (web: Admin, at the bottom); with this set, and real email on, a copy is emailed to you. |
| `DIGEST_ENABLED`, `DIGEST_HOUR` | `false` / `8` | Set by `render.yaml`. Turn on after email works. |
| `LOG_LEVEL` | `info` | Set by `render.yaml`. |
| `PORT` | do not set | Render sets it; the API follows. |
| `COOKIE_DOMAIN`, `CRON_SECRET`, `TWILIO_*`, `PUSH_ENABLED`, `EXPO_ACCESS_TOKEN`, `DIGEST_SMS` | optional | See "Optional settings". |

### On Vercel (the web app). Read at build time: redeploy after changing one.

| Variable | Value | Notes |
| --- | --- | --- |
| `PROXY_SECRET` | the same value as on Render | Optional but recommended: gives each web visitor their own rate limit. Render generates it (koinonia-api → Environment → `PROXY_SECRET` → reveal and copy). |
| `API_PROXY_TARGET` | `https://YOUR-API.onrender.com` | **The only one required.** The web app forwards `/api/*` here. The build stops with a plain message if it is missing. |
| `NEXT_PUBLIC_API_URL` | do not set | Defaults to `/api` when `API_PROXY_TARGET` is set. See "Why `/api`" below. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | your contact address | Shown on the privacy and terms pages. |
| `NEXT_PUBLIC_OPERATOR_NAME` | your name or company | Shown on the privacy and terms pages. |

### In the iPhone app (`apps/mobile/eas.json`, used by EAS builds)

| Variable | Value | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | `https://YOUR-API.onrender.com` | The phone calls the API directly. Must be `https://`. |
| `EXPO_PUBLIC_WEB_URL` | `https://YOUR-WEB.vercel.app` | For the privacy and terms links inside the app. |

### On your own computer (unchanged)

`apps/api/.env` keeps `DATABASE_URL` pointing at local Postgres. You do not need `DIRECT_URL`
locally: it defaults to `DATABASE_URL`.

### Why `/api`

The web app signs you in with a cookie, and browsers only send that cookie to the site that set
it. `something.vercel.app` and `something.onrender.com` are unrelated sites to a browser, so if the
web app called the Render address directly you would be signed out on every page load. Instead the
web app forwards everything under `/api/` to Render behind the scenes:

```
browser ──► https://YOUR-WEB.vercel.app/api/v1/...  ──►  https://YOUR-API.onrender.com/v1/...
iPhone app ──────────────────────────────────────────►  https://YOUR-API.onrender.com/v1/...
```

If you own a domain you can skip the forwarding: see "Using your own domain".

## Before you start

1. **Merge the pull request** on GitHub so that `main` contains this code. (To deploy without
   merging, choose the branch `claude/great-turing-vdjm45` wherever a step says `main`.)
2. Have accounts on neon.tech, render.com and vercel.com. Sign in to each with GitHub.
3. Render's Starter instance is paid (a few dollars a month; check render.com/pricing). Neon and
   Vercel have free tiers that are enough to start.
4. Open a text file to paste four things into as you go: the two Neon strings, the Render address,
   the Vercel address.

## Step 1. Neon: create the database and copy two connection strings

1. Go to **console.neon.tech**. Click **New Project** (or **Create project**).
2. **Project name:** `koinonia`. **Postgres version:** leave the default (16 or newer).
   **Region:** pick the one nearest Render's Oregon region, for example **AWS US West (Oregon)**.
   Click **Create**.
3. On the project dashboard click **Connect** (top right).
4. In the dialog, make sure **Connection pooling** is switched **on**. Click **Copy** (or "Copy
   snippet"). Paste it into your text file and label it `DATABASE_URL`. Check that the host part
   contains `-pooler`, like this:

   ```
   postgresql://neondb_owner:PASSWORD@ep-cool-name-123456-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require
   ```

5. In the same dialog switch **Connection pooling off**. Copy again, paste, and label it
   `DIRECT_URL`. Same string, but the host has **no** `-pooler`:

   ```
   postgresql://neondb_owner:PASSWORD@ep-cool-name-123456.us-west-2.aws.neon.tech/neondb?sslmode=require
   ```

6. Both must end with `?sslmode=require` (other parameters after it, such as `&channel_binding=require`,
   are fine). Treat both strings like passwords.

You do not create any tables. The API creates and updates them each time it starts.

## Step 2. Render: create the API from the Blueprint

The repository contains `render.yaml`, which describes the service (Docker, Starter instance,
health check, auto-deploy), so most settings are filled in for you.

1. Go to **dashboard.render.com**. Click **New +** (top right) → **Blueprint**.
2. If asked, click **Connect GitHub** and give Render access to the `Koinonia` repository.
3. Pick the **Koinonia** repository from the list.
4. **Blueprint Name:** `koinonia`. **Branch:** `main`.
5. Render shows one service, **koinonia-api**, and asks for two values. Paste them without quotes:

   | Field | What to paste |
   | --- | --- |
   | `DATABASE_URL` | the **pooled** Neon string |
   | `DIRECT_URL` | the **direct** Neon string |

6. Click **Deploy Blueprint** (or **Apply**). Render asks for a payment method if you have none,
   because the Starter instance is paid.
7. Click the **koinonia-api** service to watch the build log. The first build takes 5 to 10
   minutes. A good start ends like this:

   ```
   3 migrations found in prisma/migrations
   All migrations have been successfully applied.
   Server listening at http://0.0.0.0:10000
   ```

   (The number of migrations grows over time. On later deploys the middle line reads
   `No pending migrations to apply.`)
8. At the top of the service page is its address, something like
   `https://koinonia-api.onrender.com` (Render adds a suffix if the name is taken). Paste it into
   your text file as **the Render address**.
9. The API works out its own public address from Render; there is nothing to set.
10. Check it from your computer. Both must answer with `"ok":true`:

    ```bash
    curl https://koinonia-api.onrender.com/health
    ```

    ```bash
    curl https://koinonia-api.onrender.com/health/ready
    ```

    `/health` only says the program is running. `/health/ready` also proves it reached the database.
    If it says `"database":"down"`, `DATABASE_URL` is wrong.

**What the Blueprint set up, so you can check it under Settings:** Runtime **Docker**; Dockerfile
Path `./apps/api/Dockerfile`; Docker Build Context Directory `.`; Instance Type **Starter**;
Health Check Path `/health/ready`; Auto-Deploy **On Commit** for the branch you chose.

**Prefer to click it together without the Blueprint?** New + → **Web Service** → pick the
repository → Language **Docker** → Branch `main` → Root Directory *empty* → Dockerfile Path
`./apps/api/Dockerfile` → Instance Type **Starter** → under **Advanced**: Health Check Path
`/health/ready`, Docker Build Context Directory `.`, Auto-Deploy **Yes** → add every variable from
the Render table above → **Create Web Service**.

## Step 3. Vercel: create the web app

1. Go to **vercel.com/new**.
2. Under **Import Git Repository** find `Koinonia` and click **Import**. (If it is not listed,
   click **Adjust GitHub App Permissions** and allow the repository.)
3. **Project Name:** `koinonia`. **Framework Preset:** Next.js (detected).
4. **Root Directory:** click **Edit**, choose `apps/web`, click **Continue**.
5. Leave **Build and Output Settings** alone.
6. Open **Environment Variables** and add these, one at a time (Key, Value, **Add**):

   | Key | Value |
   | --- | --- |
   | `API_PROXY_TARGET` | the Render address, e.g. `https://koinonia-api.onrender.com` (required) |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | the address people should write to |
   | `NEXT_PUBLIC_OPERATOR_NAME` | your name or company |

7. Click **Deploy**. It takes 2 to 4 minutes.
8. When it finishes, click **Continue to Dashboard**. Under **Domains** is the address, for example
   `https://koinonia.vercel.app` (Vercel changes the name if it is taken). Paste it into your text
   file as **the Vercel address**. Use the short production address, not one of the long
   per-deployment ones.
9. Vercel deploys the repository's default branch to production. To deploy another branch instead:
   **Settings** → **Environments** → **Production** → **Branch Tracking** → choose the branch.

## Step 4. Tell the API the web app's real address

1. Render → **koinonia-api** → **Environment**.
2. **Add Environment Variable**: `WEB_URL` = the Vercel address, with `https://`.
3. Leave `CORS_ORIGINS` unset; it follows `WEB_URL`.
4. **Save Changes**. Wait for the redeploy to finish (a minute or two).
5. Open **Logs**. Near the start, lines beginning with a warning tell you about any setting that is
   still wrong for a public site. Right now you should see only the one about `EMAIL_PROVIDER=mock`.

## Step 5. First sign-in and your admin account

1. Open the Vercel address. Click **Create an account** and sign up with your real email.
2. You should land on Today and stay signed in when you reload the page. (If reloading signs you
   out, see "If something goes wrong".)
3. Make yourself an admin, from the Koinonia folder on your computer, with your email and the
   **direct** Neon string:

   ```bash
   pnpm make-admin you@example.com --db "postgresql://...your DIRECT_URL..."
   ```

   It changes that one account and nothing else, and running it twice is harmless.
4. Reload the web app. **Admin** appears in the menu.
5. Check the whole deployment from outside (it makes and deletes a throwaway account):

   ```bash
   pnpm smoke https://YOUR-API.onrender.com https://YOUR-WEB.vercel.app
   ```

Never run `pnpm db:seed` against this database: it creates demo accounts with published passwords,
and it refuses any database that is not on your own computer. The production-safe counterpart,
`pnpm db:seed:prod --db "..."`, creates nothing: it reports whether migrations are applied, how
many accounts and admins exist, and whether any demo accounts slipped in.

## Step 6. Real email (needed for "Forgot password")

Until this is done, password reset and email confirmation send nothing.

1. Create an account at **resend.com**.
2. **Domains** → **Add Domain** → enter a domain you own → add the DNS records it lists at your
   domain registrar → wait for **Verified**. (No domain? Resend's test sender
   `onboarding@resend.dev` only delivers to your own Resend account's address: enough to try it,
   not for real users.)
3. **API Keys** → **Create API Key** → Permission **Sending access** → **Add**. Copy the key now;
   it is shown once.
4. Render → **koinonia-api** → **Environment** → set or add:

   | Key | Value |
   | --- | --- |
   | `EMAIL_PROVIDER` | `resend` |
   | `RESEND_API_KEY` | the key (starts with `re_`) |
   | `EMAIL_FROM` | `Koinonia <hello@yourdomain.com>` (an address on the verified domain) |
   | `EMAIL_REPLY_TO` | optional: where replies should go |

5. **Save Changes**. If the key is missing or the sender is still an `example.com` address, the API
   refuses to start and the log names the setting.
6. Test it: on the web app's sign-in page click **Forgot password?**, enter your email, and check
   your inbox. If nothing arrives, search the Render logs for `auth email failed` and look at
   **Emails** in the Resend dashboard.

## Step 7. Daily reminder email (optional)

Once email works: Render → Environment → set `DIGEST_ENABLED` to `true` → Save. The API then checks
every 15 minutes and emails each person who has someone due, once a day at `DIGEST_HOUR` (8) in
their own timezone. A Starter instance stays awake, so nothing else is needed.

## Step 8. Point the iPhone app at the API

Edit `apps/mobile/eas.json`. In both the `preview` and `production` profiles set:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://koinonia-api.onrender.com",
  "EXPO_PUBLIC_WEB_URL": "https://koinonia.vercel.app"
}
```

Commit and push. The phone talks to the API directly with a token, so `CORS_ORIGINS` does not need
to change. Then follow [APP_STORE.md](APP_STORE.md).

## After this: updating

Push to the deployed branch. Render rebuilds the API and applies new database migrations as it
starts; a deploy only goes live once `/health/ready` answers, so a broken build leaves the old
version running. Vercel rebuilds the web app. Nothing to run by hand.

## Using your own domain

With a domain you can drop the forwarding and let the browser call the API directly. The two
addresses must be subdomains of the same domain.

1. Vercel → project → **Settings** → **Domains** → add `app.example.com`. Render → service →
   **Settings** → **Custom Domains** → add `api.example.com`. Add the DNS records each shows.
2. Vercel variables: `NEXT_PUBLIC_API_URL` = `https://api.example.com`; delete `API_PROXY_TARGET`;
   redeploy.
3. Render variables: `WEB_URL` = `https://app.example.com`, `CORS_ORIGINS` = `https://app.example.com`,
   `API_PUBLIC_URL` = `https://api.example.com`, and add `COOKIE_DOMAIN` = `.example.com`.
4. `apps/mobile/eas.json`: `EXPO_PUBLIC_API_URL` = `https://api.example.com`,
   `EXPO_PUBLIC_WEB_URL` = `https://app.example.com`.

## Optional settings (Render)

| Variable | What it does |
| --- | --- |
| `COOKIE_DOMAIN` | Only with your own domain, e.g. `.example.com`. |
| `CRON_SECRET` | 24+ random characters. Enables `POST /v1/jobs/digest` (header `X-Cron-Secret`) so an outside scheduler can run the digest. Only useful on an instance that sleeps; Starter does not. |
| `DIGEST_SMS` | `true` also texts the digest. Needs the three Twilio values. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | Switch SMS from mock to Twilio when all three are set. |
| `PUSH_ENABLED`, `EXPO_ACCESS_TOKEN` | `PUSH_ENABLED=true` sends push notifications through Expo. |
| `LOG_LEVEL` | `debug`, `info`, `warn` or `error`. |

## About `TRUST_PROXY=1`

Render's proxy tells the API each visitor's address. `1` means "believe that one proxy and nobody
else", which is what rate limiting needs. To confirm: open the Render logs, make a request from
your phone on mobile data, and compare `remoteAddress` in the log line with your phone's public IP.
If the log shows the same unfamiliar address for everyone, raise the number to `2`.

Browser traffic arrives through the web app, so the API would see every web visitor as the
web app's address and put them all in one rate-limit bucket. `PROXY_SECRET` fixes that: the web
app passes each visitor's own address along with the secret, and the API believes the address
only when the secret matches. Without it everything still works; web visitors just share limits.

## Backups

Neon keeps a restorable history (how far back depends on the plan: Neon console → **Backup &
Restore**). Before anything risky, take your own copy using the **direct** string:

```bash
pg_dump "YOUR_DIRECT_URL" > koinonia-backup.sql
```

## If something goes wrong

| What you see | Likely cause and fix |
| --- | --- |
| Render build fails at `pnpm install --frozen-lockfile` | `pnpm-lock.yaml` does not match a `package.json`. Run `pnpm install` locally, commit the lockfile, push. |
| Render log: `Koinonia API cannot start` or `Koinonia cannot apply database migrations` | The lines under it name each wrong variable and say what to paste instead. Fix under Environment, Save Changes. |
| Render log: `Invalid environment: ...` (anything else) | The message names the variable that is missing or malformed. |
| Render log: `P1001` / `Can't reach database server` during migrations | `DIRECT_URL` is wrong or missing `?sslmode=require`. |
| Render log: `P1002` or a timeout during migrations | `DIRECT_URL` holds the pooled string. It must be the one **without** `-pooler`. |
| Render log: `prepared statement "s0" already exists` | Add `&pgbouncer=true` to the end of `DATABASE_URL` (the pooled one). |
| Deploy stays "In progress" then fails; `/health/ready` says `"database":"down"` | `DATABASE_URL` is wrong. |
| Web app loads, but signing in does nothing | `API_PROXY_TARGET` is wrong, or the web app was not redeployed after changing it. Test: open `https://YOUR-WEB.vercel.app/api/health` in a browser; it should show `{"ok":true}`. |
| You are signed out every time you reload | `NEXT_PUBLIC_API_URL` is the Render address instead of `/api`. Fix it and redeploy the web app. |
| The iPhone app or a browser console says "blocked by CORS" | `CORS_ORIGINS` does not exactly match the address in the browser's address bar. |
| "Too many requests" for everyone at once | `TRUST_PROXY` is missing. |
| Links in emails go to the wrong place | `WEB_URL` is wrong. |
| Calendar link points to the wrong host | `API_PUBLIC_URL` is wrong. |
| Emails never arrive | `EMAIL_PROVIDER` is still `mock`, or the sender's domain is not verified in Resend. |

## Running the image yourself

```bash
docker build -f apps/api/Dockerfile -t koinonia-api .
```

```bash
docker run --rm -p 4000:4000 --env-file /path/to/production.env koinonia-api
```

`DIRECT_URL` may be left out when `DATABASE_URL` is an ordinary, unpooled Postgres address.
