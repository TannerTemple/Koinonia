# Deploying Koinonia

Three pieces go online: the **database** (PostgreSQL), the **API** (`apps/api`, a Docker image) and
the **web app** (`apps/web`, Next.js). The iPhone app is separate: see [APP_STORE.md](APP_STORE.md).

This guide uses **Neon** (database), **Render** (API) and **Vercel** (web). Each had a free tier when
this was written; free tiers and menu names change, so check the provider's pricing page before you
rely on one. Other hosts are covered at the end; the settings are the same everywhere.

> **What was and wasn't tested.** The API was built and started exactly as the Dockerfile does it
> (clean install, build, `migrate deploy`, start in production mode, health checks) and the web app
> was run against it through the proxy described below. The Docker image itself could not be built
> in the build environment (it blocks the Debian package mirrors), and nothing was deployed to any
> of these hosts. Expect to adjust a setting or two the first time.

## How the pieces talk to each other

```
iPhone app ───────────────────────────────►  API  ──►  PostgreSQL
browser ──► web app (Vercel) ── /api/* ───►  API
```

The browser never calls the API directly. The web app forwards anything under `/api/` to the API
(`API_PROXY_TARGET`). That keeps the sign-in cookie on the web app's own address, so it works on a
free `*.vercel.app` address with no custom domain. (If you do have a domain, see
[Option B](#option-b-your-own-domain-no-proxy).)

## Before you start

- The code is on GitHub (it is) and the branch you want is merged or selected.
- Accounts on Neon, Render and Vercel (sign in with GitHub on each).
- 30 to 45 minutes.

Generate two random secrets now and keep them somewhere safe. Run this twice:

```bash
openssl rand -base64 32
```

Call the first one `CRON_SECRET`. (The second is spare; nothing else needs a secret you invent.)

## Step 1. Database (Neon)

1. Go to neon.tech, create a project. Name: `koinonia`. PostgreSQL version: 16 or newer. Pick the
   region closest to you.
2. On the project dashboard open **Connect** (or "Connection string").
3. **Turn connection pooling off** for the string you copy (you want the *direct* connection; its
   host name does **not** contain `-pooler`). Database migrations need the direct one.
4. Copy the string. It looks like:
   `postgresql://USER:PASSWORD@ep-something.REGION.aws.neon.tech/neondb?sslmode=require`
5. Keep it for step 2. This is `DATABASE_URL`. Treat it like a password.

You do not create tables yourself. The API creates and updates them every time it starts.

## Step 2. API (Render)

1. render.com → **New** → **Web Service** → connect your GitHub account → choose the `Koinonia`
   repository.
2. Settings:

   | Setting | Value |
   | --- | --- |
   | Name | `koinonia-api` (this becomes `https://koinonia-api.onrender.com`; if taken, pick another and use it below) |
   | Branch | `main` (or the branch you deploy) |
   | Language / Runtime | **Docker** |
   | Root Directory | leave empty |
   | Dockerfile Path | `apps/api/Dockerfile` |
   | Docker Build Context Directory | `.` |
   | Instance type | Free (sleeps when idle) or the smallest paid one (always on) |
   | Health Check Path | `/health/ready` |

3. Add **Environment Variables** (the "Production settings" table below explains each):

   | Key | Value |
   | --- | --- |
   | `DATABASE_URL` | the Neon string from step 1 |
   | `NODE_ENV` | `production` |
   | `WEB_URL` | `https://YOUR-WEB.vercel.app` (you get this in step 3; put a guess now and fix it after) |
   | `CORS_ORIGINS` | same value as `WEB_URL` |
   | `API_PUBLIC_URL` | `https://koinonia-api.onrender.com` |
   | `TRUST_PROXY` | `1` |
   | `CRON_SECRET` | the secret you generated |
   | `EMAIL_PROVIDER` | `mock` for now; step 5 switches on real email |

   Do **not** set `PORT`; Render sets it and the API follows.

4. **Create Web Service**. The first build takes several minutes. Watch the log: it should end with
   `No pending migrations to apply` or a list of applied migrations, then `Server listening`.
5. Check it. Both should answer with `"ok":true`:

   ```bash
   curl https://koinonia-api.onrender.com/health
   ```

   ```bash
   curl https://koinonia-api.onrender.com/health/ready
   ```

   `/health` only says the process is up. `/health/ready` also proves the database is reachable; if
   it answers `"database":"down"`, the `DATABASE_URL` is wrong.

## Step 3. Web app (Vercel)

1. vercel.com → **Add New** → **Project** → import the `Koinonia` repository.
2. Settings:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Next.js |
   | Root Directory | `apps/web` |
   | Build / Install commands | leave the defaults |
   | "Include files outside the root directory" | on (it is by default; the web app needs `packages/shared`) |

3. **Environment Variables**:

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `/api` |
   | `API_PROXY_TARGET` | `https://koinonia-api.onrender.com` |
   | `NEXT_PUBLIC_CONTACT_EMAIL` | the address people should write to about privacy (shown on the privacy and terms pages) |

4. **Deploy**. Note the address Vercel gives you, for example `https://koinonia-abc.vercel.app`.
5. Go back to Render → `koinonia-api` → **Environment** and set `WEB_URL` and `CORS_ORIGINS` to that
   exact address (no trailing slash). Save; Render redeploys.
6. Both variables above are read when the web app is **built**. If you change either later, redeploy
   the web app (Vercel → Deployments → Redeploy).

## Step 4. First sign-in and your admin account

1. Open the Vercel address, choose **Create an account**, sign up with your real email.
2. Make yourself an admin. In Neon open the **SQL Editor** and run (with your email):

   ```sql
   UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
   ```

3. Reload the web app; an **Admin** entry appears in the menu.

Never run `pnpm db:seed` against the production database. It creates demo accounts with published
passwords (and it refuses to run when `NODE_ENV=production`).

## Step 5. Real email (needed for password reset)

Until this is done, "Forgot password" and "Confirm your email" send nothing: the default is a mock
that discards messages in production.

1. Create an account at resend.com.
2. **Domains** → add a domain you own and add the DNS records it shows. Wait until it says verified.
   (No domain yet? Resend's test sender `onboarding@resend.dev` can only deliver to the email address
   of your own Resend account. Fine for trying it out, not for real users.)
3. **API Keys** → create a key with "Sending access". Copy it once.
4. In Render → Environment set:

   | Key | Value |
   | --- | --- |
   | `EMAIL_PROVIDER` | `resend` |
   | `RESEND_API_KEY` | the key |
   | `EMAIL_FROM` | `Koinonia <hello@yourdomain.com>` (an address on the verified domain) |
   | `EMAIL_REPLY_TO` | optional: where replies should go |

5. After the redeploy, test it from your computer. This sends one real email through whatever the
   API is configured to use:

   ```bash
   curl -X POST https://koinonia-api.onrender.com/v1/auth/forgot-password -H "Content-Type: application/json" -d '{"email":"you@example.com"}'
   ```

   It always answers with an empty 204. If the email does not arrive, look in Render's logs for a
   line containing `auth email failed`, and in Resend's dashboard under Emails.

If `EMAIL_PROVIDER=resend` is set without a key or with an `example.com` sender, the API refuses to
start and the log says which setting is missing.

## Step 6. Daily reminder digest (optional)

The digest emails each person who is due, once a day at `DIGEST_HOUR` in their own timezone.

- **Always-on instance:** set `DIGEST_ENABLED=true` on Render. The API checks every 15 minutes.
- **Free (sleeping) instance:** the timer stops while the service sleeps, so have a scheduler call
  the API instead. Leave `DIGEST_ENABLED` unset and call this every 15 to 30 minutes:

  ```bash
  curl -X POST https://koinonia-api.onrender.com/v1/jobs/digest -H "X-Cron-Secret: YOUR_CRON_SECRET"
  ```

  Any scheduler works: cron-job.org (free; add the header under "Advanced"), or a GitHub Actions
  workflow with `on: schedule` and the secret stored in the repository's Actions secrets. Running it
  more often is harmless: each person gets at most one digest a day.

## Step 7. Point the iPhone app at it

In `apps/mobile/eas.json` set `EXPO_PUBLIC_API_URL` to `https://koinonia-api.onrender.com` and
`EXPO_PUBLIC_WEB_URL` to the Vercel address, for the `preview` and `production` profiles. The phone
talks to the API directly (it uses a token, not a cookie), so nothing else changes. See
[APP_STORE.md](APP_STORE.md).

## Production settings

### API (`apps/api`)

| Variable | Required | What it does |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string. Use the direct (non-pooled) one, with `sslmode=require` on hosted databases. |
| `NODE_ENV` | yes | `production`. Turns on the `Secure` cookie flag and turns off logging of mock emails. |
| `WEB_URL` | yes | Public address of the web app. Used in the links inside emails. |
| `CORS_ORIGINS` | yes | Comma-separated browser origins allowed to call the API. In production: the web app's address only. Never `*`. |
| `API_PUBLIC_URL` | recommended | Public address of the API. Used to build the calendar feed link. |
| `TRUST_PROXY` | yes on any host | Number of proxies in front of the API (`1` on Render, Railway, Fly). Without it every visitor appears to come from one address and shares one rate limit. See the note below. |
| `PORT` | no | Port to listen on. Most hosts set it. Default 4000. |
| `EMAIL_PROVIDER` | no | `mock` (default) or `resend`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | with `resend` | Resend key and a sender on a verified domain. |
| `EMAIL_REPLY_TO` | no | Reply-To address for outgoing email. |
| `DIGEST_ENABLED` | no | `true` runs the digest timer inside the API. |
| `DIGEST_HOUR` | no | Local hour (0 to 23) to send the digest. Default 8. |
| `DIGEST_SMS` | no | `true` also texts the digest (needs Twilio). |
| `CRON_SECRET` | no | Enables `POST /v1/jobs/digest` for an outside scheduler. At least 24 characters. |
| `COOKIE_DOMAIN` | Option B only | For example `.example.com`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` | no | Switch SMS from mock to Twilio when all three are set. |
| `PUSH_ENABLED`, `EXPO_ACCESS_TOKEN` | no | `PUSH_ENABLED=true` sends push through Expo. |
| `LOG_LEVEL` | no | `info` (default), `warn`, `error`, or `debug`. |

### Web (`apps/web`), read at build time

| Variable | Required | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | yes | `/api` with the proxy; the API's full address in Option B. |
| `API_PROXY_TARGET` | with the proxy | The API's full address. The web app forwards `/api/*` there. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | recommended | Contact address shown on the privacy and terms pages. |

### About `TRUST_PROXY`

Hosts put a proxy in front of your app, and the proxy tells the app the visitor's address in a
header. `TRUST_PROXY=1` means "believe the last proxy, and nobody else". To check it is right: open
the Render logs, make a request from your phone, and compare the `remoteAddress` in the log line
with your phone's public IP address. If the log shows some other address every time, raise the
number by one.

With the web proxy, browser traffic reaches the API from Vercel's servers, so web visitors share
rate-limit buckets per Vercel server address. That is fine at small scale and the per-account
sign-in lockout (8 wrong passwords, 15 minutes) does not depend on addresses at all. Option B removes
the sharing.

## Option B: your own domain, no proxy

If you own `example.com`, you can have the browser call the API directly.

1. Vercel → project → Domains → add `app.example.com`. Render → service → Custom Domains → add
   `api.example.com`. Add the DNS records each one shows.
2. Web (Vercel): `NEXT_PUBLIC_API_URL=https://api.example.com`, and remove `API_PROXY_TARGET`.
3. API (Render): `WEB_URL=https://app.example.com`, `CORS_ORIGINS=https://app.example.com`,
   `API_PUBLIC_URL=https://api.example.com`, `COOKIE_DOMAIN=.example.com`.

The two must be subdomains of the same domain. A `*.vercel.app` web app calling a `*.onrender.com`
API directly will not stay signed in, because browsers treat those as unrelated sites.

## Updating

Push to the deployed branch. Render rebuilds the API and applies new database migrations on start;
Vercel rebuilds the web app. Nothing to run by hand.

## Backups

Neon keeps a history you can restore from (how far back depends on the plan). Before anything risky,
take your own copy:

```bash
pg_dump "YOUR_DATABASE_URL" > koinonia-backup.sql
```

## If something goes wrong

| What you see | Likely cause |
| --- | --- |
| Render build fails at `pnpm install --frozen-lockfile` | `pnpm-lock.yaml` is out of date with a `package.json`. Run `pnpm install` locally, commit the lockfile. |
| Render log: `Invalid environment: ...` | A required variable is missing or malformed. The message names it. |
| `/health/ready` says `"database":"down"` | Wrong `DATABASE_URL`, missing `sslmode=require`, or the pooled string was used. |
| Web app loads, but signing in does nothing or signs you straight out | `NEXT_PUBLIC_API_URL` is not `/api`, or `API_PROXY_TARGET` is wrong, or the web app was not redeployed after changing them. |
| "Too many requests" for everyone at once | `TRUST_PROXY` is missing. |
| First request after a while takes 30+ seconds | Free instance waking up. Use a paid instance, or accept it. |
| Emails never arrive | `EMAIL_PROVIDER` is still `mock`, or the sender domain is not verified in Resend. |
| Calendar link points to the wrong host | Set `API_PUBLIC_URL`. |

## Other hosts

The API is an ordinary Docker image that needs `DATABASE_URL` and listens on `$PORT`.

- **Railway:** New Project → Deploy from GitHub repo → in the service settings set the Dockerfile
  path to `apps/api/Dockerfile` (root directory stays `/`). Add a PostgreSQL plugin and use its
  `DATABASE_URL`. Same variables as above. Usage-based pricing after a trial credit.
- **Fly.io:** from the repository root run `fly launch --dockerfile apps/api/Dockerfile` (answer no
  to deploying immediately), set secrets with `fly secrets set KEY=value`, set the internal port to
  `4000` and a health check on `/health/ready`, then `fly deploy`. Pay-as-you-go.
- **Database alternatives:** Supabase and Railway Postgres both give a standard connection string.
  With Supabase use the "direct connection" (port 5432), not the pooler.
- **Any server with Docker:**

  ```bash
  docker build -f apps/api/Dockerfile -t koinonia-api .
  ```

  ```bash
  docker run -d --name koinonia-api -p 4000:4000 --env-file /path/to/production.env koinonia-api
  ```

  Put HTTPS in front of it (Caddy or nginx) and set `TRUST_PROXY=1`.
- **Web app elsewhere:** any host that runs Next.js (`pnpm --filter @koinonia/web build`, then
  `pnpm --filter @koinonia/web start`). Set the two web variables before building.
