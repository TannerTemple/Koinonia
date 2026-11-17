import { BRAND } from "@koinonia/shared";

/**
 * Facts the privacy policy and terms depend on. Fill these in before launch, either here or
 * with the NEXT_PUBLIC_ settings named beside each (on Vercel: Environment Variables; in the
 * web Docker image: --build-arg). Anything still in [BRACKETS] is highlighted on the pages and
 * listed in the draft banner, so it cannot be missed.
 */

const env = (value: string | undefined, placeholder: string) => (value?.trim() ? value.trim() : placeholder);

/** While true, both pages carry a banner saying they are an unreviewed draft. Set NEXT_PUBLIC_LEGAL_FINAL=true once reviewed. */
export const LEGAL_DRAFT = process.env.NEXT_PUBLIC_LEGAL_FINAL !== "true";

/** The person or company that runs this copy of the app and is responsible for the data. */
export const OPERATOR = env(process.env.NEXT_PUBLIC_OPERATOR_NAME, "[YOUR NAME OR COMPANY]");

/** Where privacy questions, deletion requests and complaints go. */
export const CONTACT_EMAIL = env(process.env.NEXT_PUBLIC_CONTACT_EMAIL, "[CONTACT EMAIL]");

/** Shown as "Last updated". Change it whenever the text changes. */
export const LAST_UPDATED = env(process.env.NEXT_PUBLIC_LEGAL_UPDATED, "[DATE OF PUBLICATION]");

/** Country or state whose law governs the terms, e.g. "the State of Texas, United States". */
export const GOVERNING_LAW = env(process.env.NEXT_PUBLIC_GOVERNING_LAW, "[COUNTRY OR STATE]");

/** Where the server and database are, e.g. "the United States (Azure East US)". */
export const HOSTING_REGION = env(process.env.NEXT_PUBLIC_HOSTING_REGION, "[HOSTING REGION, e.g. the United States]");

/** How transfers out of the EU/UK are covered, e.g. "standard contractual clauses offered by our providers". */
export const TRANSFER_MECHANISM = env(process.env.NEXT_PUBLIC_TRANSFER_MECHANISM, "[TRANSFER MECHANISM, e.g. standard contractual clauses offered by our providers]");

/** How long deleted data can linger in the database host's backups, e.g. "7 days". */
export const BACKUP_RETENTION = env(process.env.NEXT_PUBLIC_BACKUP_RETENTION, "[BACKUP RETENTION, e.g. 7 days]");

/** The cap on liability in the terms, e.g. "50 US dollars". */
export const LIABILITY_CAP = env(process.env.NEXT_PUBLIC_LIABILITY_CAP, "[LIABILITY CAP, e.g. 50 US dollars]");

/** Companies that process data on the operator's behalf. Keep this list true. */
export const PROCESSORS: { name: string; purpose: string }[] = [
  { name: env(process.env.NEXT_PUBLIC_HOSTING_PROVIDER, "[HOSTING PROVIDER, e.g. Microsoft Azure]"), purpose: `runs the ${BRAND.name} server and web app` },
  { name: env(process.env.NEXT_PUBLIC_DATABASE_PROVIDER, "[DATABASE PROVIDER, e.g. Microsoft Azure or Neon]"), purpose: "stores the database" },
  { name: "Resend", purpose: "delivers email (password reset, email confirmation, daily reminders, feedback copies)" },
  { name: "Expo and Apple Push Notification service", purpose: "deliver push notifications, if you turn them on" },
  ...(process.env.NEXT_PUBLIC_ERROR_REPORTING === "sentry" ? [{ name: "Sentry", purpose: "receives reports of unexpected errors (the kind of error and the page, never your content)" }] : []),
];

/** Every blank still to fill in, for the draft banner. */
export const PLACEHOLDERS_LEFT = [OPERATOR, CONTACT_EMAIL, LAST_UPDATED, GOVERNING_LAW, HOSTING_REGION, TRANSFER_MECHANISM, BACKUP_RETENTION, LIABILITY_CAP, ...PROCESSORS.map((p) => p.name)].filter((v) => v.startsWith("["));
