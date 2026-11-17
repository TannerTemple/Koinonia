# Finishing the privacy policy and terms

The pages are written: `/privacy` and `/terms` on the web app, linked from sign-up, Settings,
Profile and the public `/beta` page. They cover what the app actually does: the people you add
and imported contacts, notes about other people, prayer intentions (treated as sensitive),
feedback, the beta invite list, sign-in with Google/Microsoft/Apple, anonymous usage counts,
export, and deletion. **They are a careful draft, not legal advice.** Have someone qualified
read them before you invite strangers, and certainly before the App Store.

## The blanks

Until filled in, each blank shows on the page as a **highlighted** `[PLACEHOLDER]`, and the
"Draft" banner at the top lists those still missing. Fill them with web app settings (on
Vercel: Settings → Environment Variables, then Redeploy; for the Azure web image: add
`--build-arg NAME="value"` to the build command in [DEPLOY_AZURE.md](DEPLOY_AZURE.md)). They
are read when the web app is built, so rebuild after changing one. You can also type them
straight into `apps/web/src/lib/legal.ts`.

| Setting | What to put | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_OPERATOR_NAME` | Who runs the service and is responsible for the data: your full name, or your company's legal name | `Jane Doe` or `Example Ministries LLC` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Where privacy questions and deletion requests go. Must be read. | `privacy@yourdomain.com` |
| `NEXT_PUBLIC_LEGAL_UPDATED` | The date this version takes effect | `December 1, 2026` |
| `NEXT_PUBLIC_GOVERNING_LAW` | Whose law governs the terms | `the State of Texas, United States` |
| `NEXT_PUBLIC_HOSTING_REGION` | Where the server and database are (the region you chose in Azure/Render/Neon) | `the United States` |
| `NEXT_PUBLIC_TRANSFER_MECHANISM` | How transfers out of the EU/UK are covered, if you accept users there | `standard contractual clauses offered by our providers` |
| `NEXT_PUBLIC_BACKUP_RETENTION` | How long deleted data can stay in database backups. Azure PostgreSQL default: 7 days. Neon free plan: about 1 day. | `7 days` |
| `NEXT_PUBLIC_LIABILITY_CAP` | The most you could owe anyone under the terms (a lawyer should set this) | `50 US dollars` |
| `NEXT_PUBLIC_HOSTING_PROVIDER` | Who runs the server and web app | `Microsoft Azure` |
| `NEXT_PUBLIC_DATABASE_PROVIDER` | Who stores the database | `Microsoft Azure` or `Neon` |
| `NEXT_PUBLIC_ERROR_REPORTING` | `sentry` only if you set `SENTRY_DSN` on the API; adds Sentry to the list of providers | (empty) |
| `NEXT_PUBLIC_LEGAL_FINAL` | `true` once reviewed: removes the "Draft" banner | `true` |

## Keep them true

Whenever you add a service that sees users' data (a new email provider, analytics, a different
host), add it to the list in `apps/web/src/lib/legal.ts` (`PROCESSORS`), change
`NEXT_PUBLIC_LEGAL_UPDATED`, and tell users if it matters. The App Store's "App Privacy" answers
in [APP_STORE.md](APP_STORE.md) must match these pages.

## Things a reviewer should look at closely

- **Prayer intentions** can reveal religious belief and health information about the user and
  others. In the EU/UK these are "special category" data; the policy relies on the user's
  explicit consent by choosing to write them. Your reviewer should confirm that is enough where
  your users are.
- **Information about other people** (contacts, notes): the user is responsible; the policy
  gives a route for someone to ask for removal.
- **Children**: the minimum age is 13 (16 where local law says so). If a youth group might use
  the app, ask about parental consent rules.
- **The liability cap and governing law** depend on where you and your users are.
