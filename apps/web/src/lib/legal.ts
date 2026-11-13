/**
 * Facts the privacy policy and terms depend on. Fill these in before launch; anything left as
 * a [BRACKETED] placeholder shows up in the pages so it can't be missed.
 */

/** While true, both pages carry a banner saying they are an unreviewed draft. */
export const LEGAL_DRAFT = true;

/** The person or company that runs this copy of Koinonia and is responsible for the data. */
export const OPERATOR = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "[OPERATOR LEGAL NAME]";

/** Where privacy questions and deletion requests go. Set NEXT_PUBLIC_CONTACT_EMAIL when deploying. */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "[CONTACT EMAIL]";

/** Shown as "Last updated". Change it whenever the text changes. */
export const LAST_UPDATED = "[DATE OF PUBLICATION]";

/** Country or state whose law governs the terms. */
export const GOVERNING_LAW = "[COUNTRY OR STATE]";

/** How long deleted data can linger in the database host's backups. */
export const BACKUP_RETENTION = "[BACKUP RETENTION, e.g. 30 days]";

/** Companies that process data on the operator's behalf. Keep this list true. */
export const PROCESSORS: { name: string; purpose: string }[] = [
  { name: "[HOSTING PROVIDER, e.g. Render]", purpose: "runs the Koinonia server" },
  { name: "[DATABASE PROVIDER, e.g. Neon]", purpose: "stores the database" },
  { name: "[WEB HOST, e.g. Vercel]", purpose: "serves the web app" },
  { name: "Resend", purpose: "delivers email (password reset, email confirmation, daily reminders)" },
  { name: "Expo and Apple Push Notification service", purpose: "deliver push notifications, if you turn them on" },
];
