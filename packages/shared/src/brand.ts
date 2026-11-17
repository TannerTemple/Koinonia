/**
 * The one place the app's name and wording live: ../brand.json. To rename the app, change the
 * values there and follow docs/RENAME.md. That file is plain JSON so that the things which
 * cannot run TypeScript (the phone app's native settings, the web build) read the same values.
 */
import brand from "../brand.json";

export const BRAND = {
  /** The name people see everywhere. */
  name: brand.name,
  /** Lower-case, no spaces: file names of exports, the phone app's short name. */
  slug: brand.slug,
  /** One line under the name. */
  tagline: brand.tagline,
  /** A slightly longer description, for the public page and app stores. */
  description: brand.description,
  /** The small line above the tagline on sign-in screens. */
  origin: brand.origin,
  /** Same, for places that want capitals. */
  originCaps: brand.originCaps,
  /** The phone app's identifier in the App Store. Changing it after release makes a NEW app. */
  bundleId: brand.bundleId,
  /** The phone app's link scheme (koinonia://...). */
  urlScheme: brand.urlScheme,
  /** Who emails come from when EMAIL_FROM is not set: "Koinonia <hello@example.com>". */
  emailFrom: `${brand.emailSenderName} <${brand.emailSenderAddress}>`,
  /** Addresses used on your own computer when nothing else is configured. */
  defaultWebUrl: brand.defaultWebUrl,
  defaultApiUrl: brand.defaultApiUrl,
} as const;

/** The text someone shares to invite a friend. */
export const inviteText = (webUrl: string): string => brand.inviteMessage.replace("{name}", brand.name).replace("{url}", `${webUrl.replace(/\/+$/, "")}/beta`);
