/**
 * The one place the app's name and wording live. To rename the app, change the values here
 * (and the few native settings listed in docs/RENAME.md that cannot read this file).
 */
export const BRAND = {
  /** The name people see everywhere. */
  name: "Koinonia",
  /** One line under the name. */
  tagline: "Stay close to the people you mean to stay close to.",
  /** A slightly longer description, for the public page and app stores. */
  description: "Reminders to reach out on the rhythm you choose for each person, notes that remember for you, and a prayer list with one set apart each day.",
  /** The small line above the tagline on sign-in screens. */
  origin: "κοινωνία · communion, fellowship",
  /** Same, for places that want capitals. */
  originCaps: "ΚΟΙΝΩΝΙΑ · COMMUNION, FELLOWSHIP",
  /** What an invite says. `{url}` is replaced with the public page's address. */
  inviteMessage: "I've been using Koinonia to stay in touch with people and remember who I'm praying for. Want to try it with me? {url}",
} as const;

/** The text someone shares to invite a friend. */
export const inviteText = (webUrl: string): string => BRAND.inviteMessage.replace("{url}", `${webUrl.replace(/\/+$/, "")}/beta`);
