# Deploying Koinonia on Azure

Two containers on **Azure Container Apps** (the API and the web app) and one PostgreSQL
database. About an hour the first time.

**What has and has not been tried.** Both images' build steps were replayed by hand here and the
results started in production mode against a real PostgreSQL, with `pnpm smoke` passing all 14
checks. **Nothing was run against Azure itself** (no account was used), and `docker build` cannot
run in the environment this was written in. The `az` commands below are from Azure's
documentation and my knowledge of the CLI; if one is rejected, the error message usually names
the flag, and the portal path is given as a fallback where it matters. Prices are estimates from
public pages in late 2026: check the [pricing calculator](https://azure.microsoft.com/pricing/calculator/)
for your region.

## The setup, and what it costs

| Piece | Choice | Why | Rough cost |
| --- | --- | --- | --- |
| API and web | **Azure Container Apps**, Consumption plan, 0 to 2 copies each | Runs the Docker images as they are, gives each an `https://` address, scales to zero when idle and up when busy | **About $0** while small: the first 180,000 vCPU-seconds, 360,000 GiB-seconds and 2 million requests each month are free per subscription ([pricing](https://azure.microsoft.com/pricing/details/container-apps/)) |
| Images | **Azure Container Registry**, Basic | Builds the images in Azure, so you do not need Docker on your computer | About $5 a month |
| Logs | Log Analytics (created automatically) | Where the API's log lines go | Usually $0 at this size (first 5 GB a month free) |
| Database | See the next table | | |

### Database: Azure or Neon

| | Azure Database for PostgreSQL (Flexible Server, Burstable B1ms, 32 GB) | Neon (free plan) |
| --- | --- | --- |
| Cost | Roughly $12 to $13 a month for the server plus about $4 for storage. **Free for 12 months on a new Azure free account** (750 hours of B1ms and 32 GB a month; [free services](https://azure.microsoft.com/pricing/free-services/)). Whether a student subscription gets this is something to check, below. | $0 |
| Always on | Yes | Sleeps after a few idle minutes; the first request then takes a second or two |
| Size limit | 32 GB (growable) | 0.5 GB on the free plan: plenty for hundreds of users of this app |
| Backups | Automatic, 7 days, restore to a point in time | Point-in-time restore for a short window on the free plan |
| Everything in one place | Yes: one bill, one portal | No: a second account |
| Connections | Direct only on this size (no built-in pooler), about 35 usable. Fine for two or three API copies. | Pooled and direct addresses, as in [DEPLOY.md](DEPLOY.md) |
| Moving later | `pg_dump` / `pg_restore` either way | Same |

**Recommendation.** If your subscription gets the 12 free months of PostgreSQL, or you have
student credit to spend, use **Azure PostgreSQL**: everything is in Azure, it never sleeps, and
it costs you nothing for now. If neither applies, use **Neon's free plan** with the Azure
containers: about $5 a month in total instead of about $22, and you can move the data into Azure
later in ten minutes. Both paths are in step 3.

Not recommended: Azure App Service (about $13 a month per app on the cheapest always-on plan, with
no scale to zero) and a virtual machine (cheap, but you patch and secure it yourself).

### Azure for Students: check, do not assume

1. **Do you have it?** Portal → search **Subscriptions**. The offer column should say
   "Azure for Students". If you only see "Azure for Students Starter" or nothing, sign up at
   azure.microsoft.com/free/students with your school email.
2. **How much credit, and until when?** Portal → search **Education** → **Overview**. It shows
   the balance and the expiry date. Sources disagree on the amount and length ($100 for 12 months
   is the usual figure), so read it there.
   ([About Azure for Students](https://learn.microsoft.com/en-us/azure/education-hub/about-azure-for-students))
3. **What happens when it runs out?** With no card on file, resources are **disabled**, not
   billed. Your database would stop. Put the expiry date in your calendar and export your data
   before it (Settings → Your data, or `pg_dump`).
4. **Regions.** Student subscriptions are often limited to a few regions. If a create command
   fails with `RequestDisallowedByAzure`, the message lists the regions you may use; change
   `LOC` below to one of them and start again from step 2.
5. **Image builds.** `az acr build` is sometimes refused on free and student subscriptions
   (`TasksOperationsNotAllowed`). The fallback is in step 4.
6. **Free PostgreSQL.** Portal → search **Free services**. If "Azure Database for PostgreSQL"
   is listed with hours remaining, you have the 12 free months.

## Every environment variable

### API container (`koinonia-api`)

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | the database address | Stored as a **secret**. Azure PostgreSQL: one address, ending `?sslmode=require`. Neon: the pooled one. |
| `DIRECT_URL` | Neon only: the direct address | Leave unset with Azure PostgreSQL. |
| `NODE_ENV` | `production` | |
| `WEB_URL` | the web app's address | Goes into emailed links and is the browser origin allowed to call the API. Added in step 6. |
| `API_PUBLIC_URL` | the API's own address | Used for calendar links. Added in step 6. (Only Render fills this in by itself.) |
| `TRUST_PROXY` | `1` | Container Apps puts one proxy in front of the container. |
| `EMAIL_PROVIDER` | `mock`, later `resend` | See "Real email" in [DEPLOY.md](DEPLOY.md); the Resend steps are the same. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `FEEDBACK_EMAIL` | from Resend / your address | Only with real email. Store the key as a secret. |
| `DIGEST_ENABLED` | `false` | Leave off while the API can scale to zero; see "Daily email". |
| `LOG_LEVEL` | `info` | |
| `PORT` | do not set | The image listens on 4000. |
| `CORS_ORIGINS`, `COOKIE_DOMAIN`, `CRON_SECRET`, `SENTRY_DSN`, `PUSH_PROVIDER`, `EXPO_ACCESS_TOKEN`, `TWILIO_*` | optional | As in [DEPLOY.md](DEPLOY.md). `CORS_ORIGINS` defaults to `WEB_URL`. |

### Web container (`koinonia-web`)

| Variable | Value | Notes |
| --- | --- | --- |
| `API_PROXY_TARGET` | the API's address | **Given when the image is built** (`--build-arg`), not in the container's settings. The web app forwards `/api/*` there. Changing it means building the web image again. |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_OPERATOR_NAME` | your contact details | Optional build arguments, shown on the legal pages. |
| `PORT` | do not set | The image listens on 3000. |

### iPhone app

`EXPO_PUBLIC_API_URL` = the API's address, `EXPO_PUBLIC_WEB_URL` = the web app's address
(`apps/mobile/.env` for Expo Go, `apps/mobile/eas.json` for real builds).

---

## Step 1. Tools and sign-in (5 min)

1. Install the Azure command line: on a Mac, `brew install azure-cli`. (Windows: the installer
   from learn.microsoft.com/cli/azure/install-azure-cli.)
2. In a terminal, **in the Koinonia folder**, on the branch you want to deploy:

```bash
az login
```

```bash
az extension add --name containerapp --upgrade
```

```bash
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.ContainerRegistry Microsoft.DBforPostgreSQL; do az provider register --namespace $ns --wait; done
```

**Success:** `az account show --query name -o tsv` prints your subscription's name.

## Step 2. Names, resource group, registry, environment (5 min)

Run this block once per terminal window; later steps use these names. `ACR` and `PG` must be
unique in all of Azure, so the block adds a few random letters. **Copy the two `echo` lines'
output into a text file**: if you open a new terminal you must set `ACR` and `PG` to those same
values again, not generate new ones.

```bash
RG=koinonia
LOC=eastus
SUFFIX=$(openssl rand -hex 3)
ACR=koinonia$SUFFIX
PG=koinonia-db-$SUFFIX
echo "ACR=$ACR"
echo "PG=$PG"
```

```bash
az group create -n $RG -l $LOC
```

```bash
az acr create -g $RG -n $ACR --sku Basic --admin-enabled true
```

```bash
az containerapp env create -g $RG -n koinonia-env -l $LOC
```

**Success:** each command ends with a block of JSON containing `"provisioningState": "Succeeded"`.
The last one takes two or three minutes.

## Step 3. The database (10 min)

Do **3A or 3B**, not both. Either way you end with a `DATABASE_URL` variable in your terminal.

### 3A. Azure Database for PostgreSQL

```bash
PGPASS="Kn$(openssl rand -hex 16)7"
echo "PGPASS=$PGPASS"
```

Save that password in your text file. Then:

```bash
az postgres flexible-server create -g $RG -n $PG -l $LOC --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 16 --admin-user koinonia --admin-password "$PGPASS" --public-access 0.0.0.0 --yes
```

```bash
az postgres flexible-server db create -g $RG -s $PG -d koinonia
```

```bash
DATABASE_URL="postgresql://koinonia:$PGPASS@$PG.postgres.database.azure.com:5432/koinonia?sslmode=require"
```

`--public-access 0.0.0.0` means "reachable from services inside Azure, and from nowhere else";
that is what lets the API in. The password still protects it.

**Success:** the first command prints JSON with a `host` ending `.postgres.database.azure.com`.
It takes five to ten minutes.

If the CLI refuses a flag: portal → **Create a resource** → **Azure Database for PostgreSQL
Flexible Server** → workload type **Development** (that selects Burstable B1ms) → PostgreSQL 16 →
authentication **PostgreSQL authentication only** → on **Networking**, tick **Allow public access
from any Azure service within Azure to this server**.

### 3B. Neon instead

Follow step 1 of [TONIGHT.md](TONIGHT.md) or [DEPLOY.md](DEPLOY.md) to get the two addresses, then:

```bash
DATABASE_URL='postgresql://...the POOLED address...'
```

```bash
DIRECT_URL='postgresql://...the DIRECT address...'
```

## Step 4. Build and start the API (10 min)

```bash
az acr build -r $ACR -t koinonia-api:v1 -f apps/api/Dockerfile .
```

**Success:** the output ends with `Run ID: ... was successful`. (Five minutes or so.)

If it is refused with `TasksOperationsNotAllowed`, build on your own computer instead. Docker
Desktop must be running; `--platform linux/amd64` matters on an Apple-silicon Mac:

```bash
az acr login -n $ACR
```

```bash
docker build --platform linux/amd64 -f apps/api/Dockerfile -t $ACR.azurecr.io/koinonia-api:v1 . && docker push $ACR.azurecr.io/koinonia-api:v1
```

Now start it. With Azure PostgreSQL:

```bash
az containerapp create -g $RG -n koinonia-api --environment koinonia-env --image $ACR.azurecr.io/koinonia-api:v1 --registry-server $ACR.azurecr.io --registry-username $ACR --registry-password "$(az acr credential show -n $ACR --query 'passwords[0].value' -o tsv)" --target-port 4000 --ingress external --min-replicas 0 --max-replicas 2 --cpu 0.5 --memory 1.0Gi --secrets database-url="$DATABASE_URL" --env-vars NODE_ENV=production DATABASE_URL=secretref:database-url TRUST_PROXY=1 EMAIL_PROVIDER=mock DIGEST_ENABLED=false LOG_LEVEL=info
```

With Neon, the same command with one more secret and one more variable: replace
`--secrets database-url="$DATABASE_URL"` by
`--secrets database-url="$DATABASE_URL" direct-url="$DIRECT_URL"` and add
`DIRECT_URL=secretref:direct-url` to the end.

```bash
API_URL=https://$(az containerapp show -g $RG -n koinonia-api --query properties.configuration.ingress.fqdn -o tsv)
echo "API_URL=$API_URL"
```

```bash
curl $API_URL/health/ready
```

**Success:** `{"ok":true,"database":"up"}`. Save `API_URL` in your text file.

When the container starts it applies any new database migrations before serving (it retries
twice if the database is slow to answer, and two copies starting together cannot collide:
PostgreSQL makes the second wait). If it does not come up:

```bash
az containerapp logs show -g $RG -n koinonia-api --tail 50
```

The last lines name the wrong setting in plain English.

## Step 5. Build and start the web app (10 min)

The API's address is baked into the web image, which is why the API came first.

```bash
az acr build -r $ACR -t koinonia-web:v1 -f apps/web/Dockerfile --build-arg API_PROXY_TARGET=$API_URL --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) .
```

(Local fallback, as in step 4:
`docker build --platform linux/amd64 -f apps/web/Dockerfile --build-arg API_PROXY_TARGET=$API_URL -t $ACR.azurecr.io/koinonia-web:v1 . && docker push $ACR.azurecr.io/koinonia-web:v1`)

```bash
az containerapp create -g $RG -n koinonia-web --environment koinonia-env --image $ACR.azurecr.io/koinonia-web:v1 --registry-server $ACR.azurecr.io --registry-username $ACR --registry-password "$(az acr credential show -n $ACR --query 'passwords[0].value' -o tsv)" --target-port 3000 --ingress external --min-replicas 0 --max-replicas 2 --cpu 0.5 --memory 1.0Gi
```

```bash
WEB_URL=https://$(az containerapp show -g $RG -n koinonia-web --query properties.configuration.ingress.fqdn -o tsv)
echo "WEB_URL=$WEB_URL"
```

**Success:** opening `WEB_URL` in a browser shows the Koinonia sign-in page. Do not sign up yet.

## Step 6. Tell the API its addresses, then test (5 min)

```bash
az containerapp update -g $RG -n koinonia-api --set-env-vars WEB_URL=$WEB_URL API_PUBLIC_URL=$API_URL
```

```bash
pnpm smoke $API_URL $WEB_URL
```

**Success:** `ALL 14 CHECKS PASSED.` Any `FAIL` is followed by a `Fix:` line. The first run after
a quiet spell can be slow while the containers wake; run it again before worrying.

## Step 7. Health checks (5 min, in the portal)

Container Apps already restarts a container whose port stops answering. To make it use the
API's own checks:

1. Portal → **Container Apps** → **koinonia-api** → **Containers** (under Application) →
   **Edit and deploy**.
2. Tick the container → **Edit** → **Health probes** tab.
3. **Liveness:** HTTP, path `/health`, port `4000`, period 30 seconds.
4. **Readiness:** HTTP, path `/health/ready`, port `4000`, period 10 seconds.
5. **Startup:** HTTP, path `/health`, port `4000`, period 5 seconds, failure threshold 30 (gives
   migrations up to two and a half minutes on a slow first start).
6. **Save** → **Create**.

For **koinonia-web** do the same with port `3000` and path `/login` for all three.

**Success:** under **Revisions and replicas** the new revision shows **Running** and
**Healthy**, and `pnpm smoke` still passes.

## Step 8. Your account, and the phone

1. Open `WEB_URL`, **Create an account** with your real email.
2. Make yourself admin. With Azure PostgreSQL, first let your own computer reach the database
   for a moment (portal → the database server → **Networking** → **Add current client IP
   address** → **Save**), then:

```bash
pnpm make-admin you@example.com --db "$DATABASE_URL"
```

   Remove that firewall rule afterwards. (With Neon use the direct address; no firewall step.)
3. Phone: put `API_URL` and `WEB_URL` into `apps/mobile/.env` as in step 7 of
   [TONIGHT.md](TONIGHT.md).

## Updating later

After `git pull`, build with a **new tag** and point the app at it. The API applies any new
migrations as it starts:

```bash
az acr build -r $ACR -t koinonia-api:v2 -f apps/api/Dockerfile . && az containerapp update -g $RG -n koinonia-api --image $ACR.azurecr.io/koinonia-api:v2
```

```bash
az acr build -r $ACR -t koinonia-web:v2 -f apps/web/Dockerfile --build-arg API_PROXY_TARGET=$API_URL --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) . && az containerapp update -g $RG -n koinonia-web --image $ACR.azurecr.io/koinonia-web:v2
```

Deploy the API first, then the web app. If a new version misbehaves, point the app back at the
previous tag with the same `update` command. (Database migrations are not undone by that; the
ones in this project only add things, so the older code keeps working.)

## Scaling later

| When | Change |
| --- | --- |
| The first request after a quiet spell is too slow | `az containerapp update -g $RG -n koinonia-api --min-replicas 1` (and the same for the web app). Each always-on copy at this size is very roughly $10 to $20 a month beyond the free grant. |
| More people | Raise `--max-replicas`. The API keeps nothing in memory that matters except rate-limit counters, which become per-copy: limits get looser, nothing breaks. |
| The database is the bottleneck | Azure: move up from B1ms in the portal (**Compute + storage**), a few minutes of downtime. Add `&connection_limit=5` to `DATABASE_URL` if you run many API copies on a small database. |
| Your own domain | Portal → the Container App → **Custom domains** → **Add**; managed certificates are free. Then update `WEB_URL` / `API_PUBLIC_URL`, rebuild the web image with the new API address, and see "Using your own domain" in [DEPLOY.md](DEPLOY.md) for the cookie setting. |

## Daily email

The built-in scheduler (`DIGEST_ENABLED=true`) only runs while a copy of the API is awake, so
with scale-to-zero leave it off. Two ways to have the daily email: keep one copy always on
(`--min-replicas 1`) and set `DIGEST_ENABLED=true`; or set `CRON_SECRET` and have any scheduler
call `POST $API_URL/v1/jobs/digest` with the header `X-Cron-Secret` once an hour (a scheduled
GitHub Actions workflow or an Azure Logic App both do this for free).

## If something goes wrong

| What you see | Fix |
| --- | --- |
| A create command fails with `RequestDisallowedByAzure` | Your subscription limits regions. Use one the message lists as `LOC`, starting again from step 2. |
| `az acr build` fails with `TasksOperationsNotAllowed` | Use the local `docker build` fallback in step 4. |
| API never becomes ready; log says `Koinonia cannot apply database migrations` with P1001 | The database firewall. Azure PostgreSQL → **Networking** → tick **Allow public access from any Azure service within Azure**. |
| Same, with P1000 | The password inside `DATABASE_URL` is wrong. Fix the secret: `az containerapp secret set -g $RG -n koinonia-api --secrets database-url="$DATABASE_URL"`, then `az containerapp revision restart` or deploy a new revision. |
| Log says `Koinonia API cannot start` | The lines under it name each wrong variable. `az containerapp update ... --set-env-vars NAME=value`. |
| Web build fails with `Koinonia web cannot be built` | `--build-arg API_PROXY_TARGET=$API_URL` was missing or `API_URL` was empty in this terminal. |
| Web page loads but sign-in cannot reach Koinonia | The web image was built with the wrong API address. Rebuild it (step 5) with a new tag. |
| Smoke test fails at CORS | `WEB_URL` on the API is not exactly the web address (step 6). |
| Everyone seems to share one rate limit | Check `TRUST_PROXY=1` is set; see "About `TRUST_PROXY=1`" in [DEPLOY.md](DEPLOY.md). |
| Image pull fails after a while | The registry password was rotated. Run the `az containerapp registry set` command with the current password from `az acr credential show`. |

## Removing everything

```bash
az group delete -n koinonia
```

That deletes the containers, the registry and an Azure database with all its data. Export first.
