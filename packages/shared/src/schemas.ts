import { z } from "zod";
import { MAX_CADENCE_DAYS } from "./cadence";
import { isDay, isValidTimezone } from "./dates";
import type { Streak } from "./streaks";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const ROLES = ["USER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const CHANNELS = ["CALL", "TEXT", "EMAIL", "IN_PERSON", "OTHER"] as const;
export type Channel = (typeof CHANNELS)[number];
export const CHANNEL_LABELS: Record<Channel, string> = {
  CALL: "Call",
  TEXT: "Text",
  EMAIL: "Email",
  IN_PERSON: "In person",
  OTHER: "Other",
};

export const INTENTION_KINDS = ["PROMISED", "PERSONAL", "THANKSGIVING"] as const;
export type IntentionKind = (typeof INTENTION_KINDS)[number];
export const INTENTION_KIND_LABELS: Record<IntentionKind, string> = {
  PROMISED: "I said I'd pray",
  PERSONAL: "Personal",
  THANKSGIVING: "Thanksgiving",
};

export const INTENTION_STATUSES = ["ACTIVE", "ANSWERED", "ARCHIVED"] as const;
export type IntentionStatus = (typeof INTENTION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------
const trimmed = (max: number) => z.string().trim().max(max);
/** Optional text field: empty string and undefined both become null. */
const optionalText = (max: number) =>
  z
    .union([trimmed(max), z.null()])
    .optional()
    .transform((v) => (v ? v : null));

export const daySchema = z.string().refine(isDay, "Expected a date like 2026-01-31");
const optionalDay = z
  .union([daySchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address");
const optionalEmail = z
  .union([emailSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

/** Keeps a leading + and digits only, so "+1 (555) 010-2000" matches "+15550102000". */
export function normalizePhone(input: string): string {
  const trimmedInput = input.trim();
  const digits = trimmedInput.replace(/\D/g, "");
  return trimmedInput.startsWith("+") ? `+${digits}` : digits;
}
const phoneSchema = z
  .string()
  .trim()
  .max(32)
  .transform(normalizePhone)
  .refine((v) => v.replace("+", "").length >= 7, "Enter a valid phone number");
const optionalPhone = z
  .union([phoneSchema, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const timezoneSchema = z.string().max(64).refine(isValidTimezone, "Unknown timezone");
const cadenceSchema = z
  .union([z.number().int().min(1).max(MAX_CADENCE_DAYS), z.null()])
  .optional()
  .transform((v) => v ?? null);
const birthdaySchema = z
  .union([
    z
      .string()
      .regex(/^(\d{4}-)?\d{2}-\d{2}$/, "Use MM-DD or YYYY-MM-DD")
      .refine((v) => isDay(v.length === 5 ? `2000-${v}` : v), "Not a real date"),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Auth & user
// ---------------------------------------------------------------------------
export const registerSchema = z.object({
  name: trimmed(80).min(1, "Tell us your name"),
  email: emailSchema,
  password: z.string().min(8, "Use at least 8 characters").max(200),
  phone: optionalPhone,
  timezone: timezoneSchema.optional(),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginInput = z.input<typeof loginSchema>;

export const updateMeSchema = z
  .object({
    name: trimmed(80).min(1),
    phone: optionalPhone,
    timezone: timezoneSchema,
    discoverable: z.boolean(),
    digestEnabled: z.boolean(),
  })
  .partial();
export type UpdateMeInput = z.input<typeof updateMeSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, "Use at least 8 characters").max(200),
});
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

const emailedToken = z.string().trim().min(20, "That code doesn't look right").max(200);
export const resetPasswordSchema = z.object({
  token: emailedToken,
  password: z.string().min(8, "Use at least 8 characters").max(200),
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: emailedToken });
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  phone: string | null;
  role: Role;
  timezone: string;
  discoverable: boolean;
  digestEnabled: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------
const contactFields = {
  name: trimmed(80).min(1, "Name is required"),
  phone: optionalPhone,
  email: optionalEmail,
  relationship: optionalText(40),
  birthday: birthdaySchema,
  cadenceDays: cadenceSchema,
  preferredChannel: z.enum(CHANNELS).optional(),
  /** When you last talked, if you remember. The next reminder counts from here. */
  lastContactedDay: optionalDay,
  linkedUserId: z.union([z.string().max(40), z.null()]).optional(),
};

export const createContactSchema = z.object(contactFields);
export type CreateContactInput = z.input<typeof createContactSchema>;

export const updateContactSchema = z
  .object({ ...contactFields, archived: z.boolean() })
  .partial();
export type UpdateContactInput = z.input<typeof updateContactSchema>;

export const importContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: trimmed(80).min(1),
        phone: optionalPhone.catch(null),
        email: optionalEmail.catch(null),
        birthday: birthdaySchema.catch(null),
      }),
    )
    .min(1)
    .max(500),
  cadenceDays: cadenceSchema,
});
export type ImportContactsInput = z.input<typeof importContactsSchema>;

export const reachOutSchema = z.object({
  channel: z.enum(CHANNELS).optional(),
  summary: optionalText(500),
  /** Defaults to today. Lets you log "I called her on Sunday". */
  day: daySchema.optional(),
});
export type ReachOutInput = z.input<typeof reachOutSchema>;

export const snoozeSchema = z.union([
  z.object({ days: z.number().int().min(1).max(365) }),
  z.object({ untilDay: daySchema }),
  z.object({ clear: z.literal(true) }),
]);
export type SnoozeInput = z.input<typeof snoozeSchema>;

export interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  birthday: string | null;
  cadenceDays: number | null;
  preferredChannel: Channel;
  lastContactedDay: string | null;
  nextDueDay: string | null;
  snoozedUntilDay: string | null;
  /** nextDueDay with any snooze applied — what the UI should sort and badge by. */
  dueDay: string | null;
  linkedUserId: string | null;
  archived: boolean;
  noteCount: number;
  activeIntentionCount: number;
  createdAt: string;
}

export interface Interaction {
  id: string;
  contactId: string;
  channel: Channel;
  summary: string | null;
  day: string;
  occurredAt: string;
}

export interface ContactDetail extends Contact {
  notes: Note[];
  interactions: Interaction[];
  intentions: Intention[];
}

export interface ImportResult {
  created: number;
  skipped: number;
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
export const createNoteSchema = z.object({
  body: trimmed(4000).min(1, "Write something first"),
  pinned: z.boolean().optional(),
  /** "Ask how the interview went" — surfaces on Today when the day arrives. */
  followUpDay: optionalDay,
});
export type CreateNoteInput = z.input<typeof createNoteSchema>;

export const updateNoteSchema = z
  .object({
    body: trimmed(4000).min(1),
    pinned: z.boolean(),
    followUpDay: optionalDay,
    /** Mark a follow-up as handled. */
    followUpDone: z.boolean(),
  })
  .partial();
export type UpdateNoteInput = z.input<typeof updateNoteSchema>;

export interface Note {
  id: string;
  contactId: string;
  contactName: string;
  body: string;
  pinned: boolean;
  followUpDay: string | null;
  followUpDone: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Prayer
// ---------------------------------------------------------------------------
export const createIntentionSchema = z.object({
  title: trimmed(140).min(1, "What are you praying for?"),
  details: optionalText(2000),
  kind: z.enum(INTENTION_KINDS).optional(),
  contactId: z.union([z.string().max(40), z.null()]).optional(),
});
export type CreateIntentionInput = z.input<typeof createIntentionSchema>;

export const updateIntentionSchema = z
  .object({
    title: trimmed(140).min(1),
    details: optionalText(2000),
    kind: z.enum(INTENTION_KINDS),
    contactId: z.union([z.string().max(40), z.null()]),
    status: z.enum(INTENTION_STATUSES),
  })
  .partial();
export type UpdateIntentionInput = z.input<typeof updateIntentionSchema>;

export const setDailyIntentionSchema = z.object({ intentionId: z.string().max(40) });
export type SetDailyIntentionInput = z.input<typeof setDailyIntentionSchema>;

export interface Intention {
  id: string;
  title: string;
  details: string | null;
  kind: IntentionKind;
  status: IntentionStatus;
  contactId: string | null;
  contactName: string | null;
  prayedCount: number;
  lastPrayedDay: string | null;
  prayedToday: boolean;
  answeredAt: string | null;
  createdAt: string;
}

export interface PrayerToday {
  day: string;
  /** Null only when there are no active intentions at all. */
  intention: Intention | null;
  /** True when the user picked it; false when Koinonia suggested it. */
  chosenByUser: boolean;
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
export interface Home {
  today: string;
  overdue: Contact[];
  dueToday: Contact[];
  /** Due in the next 14 days, soonest first. */
  upcoming: Contact[];
  /** Note follow-ups due today or earlier, plus the next 7 days. */
  followUps: Note[];
  /** Birthdays in the next 14 days. */
  birthdays: { contact: Contact; day: string }[];
  prayer: PrayerToday;
  streaks: { reachOut: Streak; prayer: Streak };
  stats: { contacts: number; reachOutsThisWeek: number; activeIntentions: number };
}

export interface WeekSummary {
  /** First and last day of the 7-day window (inclusive). */
  startDay: string;
  endDay: string;
  /** Reach-outs logged. */
  reachOuts: number;
  /** Different people reached. */
  peopleReached: number;
  /** Prayers said (one per intention per day). */
  prayers: number;
  /** Days with at least one reach-out / one prayer, out of 7. */
  daysReachedOut: number;
  daysPrayed: number;
  /** One entry per day of the window, oldest first. */
  days: { day: string; reachOuts: number; prayers: number }[];
  /** Who was reached, most often first. */
  people: { id: string; name: string; reachOuts: number }[];
}

/** The last 7 days (ending today) next to the 7 days before them. */
export interface WeeklyReview {
  today: string;
  thisWeek: WeekSummary;
  lastWeek: WeekSummary;
  streaks: { reachOut: Streak; prayer: Streak };
}

// ---------------------------------------------------------------------------
// People lookup, devices, admin
// ---------------------------------------------------------------------------
export interface UserSearchResult {
  id: string;
  name: string;
  /** How the match was found; email/phone are only echoed back on an exact match. */
  matchedBy: "name" | "email" | "phone";
  email: string | null;
  phone: string | null;
  alreadyContact: boolean;
}

export const registerDeviceSchema = z.object({
  token: z.string().min(1).max(300),
  platform: z.enum(["ios", "android", "web"]),
});
export type RegisterDeviceInput = z.input<typeof registerDeviceSchema>;

export interface AdminStats {
  users: number;
  newUsersThisWeek: number;
  activeUsersThisWeek: number;
  contacts: number;
  reachOuts: number;
  reachOutsThisWeek: number;
  intentions: number;
  prayers: number;
}

export interface AdminUser extends User {
  disabled: boolean;
  contactCount: number;
  intentionCount: number;
  lastSeenAt: string | null;
}

export const adminUpdateUserSchema = z
  .object({ role: z.enum(ROLES), disabled: z.boolean() })
  .partial();
export type AdminUpdateUserInput = z.input<typeof adminUpdateUserSchema>;

export interface CalendarFeed {
  /** Subscribe to this URL from Apple Calendar / Google Calendar. */
  url: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
