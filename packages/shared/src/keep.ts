/**
 * Reasons to come back tomorrow, as plain functions both apps and the API share:
 * a forgiving prayer streak, a weekly reach-out rhythm, milestones, a memory from this
 * day, and a short word for today. See docs/RETENTION.md for the thinking behind each.
 */
import { addDays, diffDays, weekStart, type Day } from "./dates";

// ---- Each of these can be switched off -------------------------------------------------

/** Every retention feature, by the name used in the FEATURES_OFF setting. */
export const RETENTION_FEATURES = ["prayerStreak", "weekStreak", "milestones", "memory", "dailyWord", "totals", "streakNudge", "lastSignIn"] as const;
export type RetentionFeature = (typeof RETENTION_FEATURES)[number];
export type Features = Record<RetentionFeature, boolean>;

export const FEATURE_LABELS: Record<RetentionFeature, string> = {
  prayerStreak: "The prayer streak line on Today",
  weekStreak: "The weeks-in-a-row line on Today",
  milestones: "\"Well done\" at 3, 7, 14, 30... days",
  memory: "The memory card (a week, a month, a year ago)",
  dailyWord: "A word for today",
  totals: "The running totals line",
  streakNudge: "The 8pm keep-your-streak reminder on the phone",
  lastSignIn: "\"Welcome back\" and \"Used last time\" on sign-in",
};

export const ALL_FEATURES_ON: Features = Object.fromEntries(RETENTION_FEATURES.map((f) => [f, true])) as Features;

/**
 * Reads a comma-separated list of features to switch off ("memory, dailyWord"). Everything
 * not named stays on. Returns the names it did not recognise so a typo can be reported.
 */
export function featuresFrom(off: string | undefined | null): { features: Features; unknown: string[] } {
  const features = { ...ALL_FEATURES_ON };
  const unknown: string[] = [];
  for (const raw of (off ?? "").split(",")) {
    const name = raw.trim();
    if (!name) continue;
    const match = RETENTION_FEATURES.find((f) => f.toLowerCase() === name.toLowerCase());
    if (match) features[match] = false;
    else unknown.push(name);
  }
  return { features, unknown };
}

// ---- A prayer streak that forgives one missed day a week -----------------------------

export interface GentleStreak {
  /** Days prayed in the current run (a forgiven day is not counted). */
  current: number;
  longest: number;
  doneToday: boolean;
  /** A missed day inside the current run was forgiven. */
  graceUsed: boolean;
  /** There is a run worth keeping, and today has not been done yet. */
  atRisk: boolean;
}

/** How many days back a second miss ends the run: one grace day per week. */
const GRACE_WINDOW = 7;

/**
 * Consecutive days, except that a single missed day does not end the run as long as it is
 * the only miss within a week. Missing two days in a row, or twice in a week, starts over.
 * (An all-or-nothing streak makes one bad day feel like the end, which is when people quit.)
 */
export function gentleStreak(days: Iterable<Day>, today: Day): GentleStreak {
  const set = new Set(days);
  const doneToday = set.has(today);

  /** `missAfter`: a miss already forgiven just after `end`, which limits further forgiveness. */
  const runEndingAt = (end: Day, missAfter: Day | null = null) => {
    let count = 0;
    let graceUsed = missAfter !== null;
    let lastMiss = missAfter;
    let cursor = end;
    for (;;) {
      if (set.has(cursor)) {
        count += 1;
      } else {
        const tooSoon = lastMiss !== null && diffDays(cursor, lastMiss) < GRACE_WINDOW;
        // A gap is forgiven only between two prayed days, and only once a week.
        if (count === 0 || tooSoon || !set.has(addDays(cursor, -1))) break;
        graceUsed = true;
        lastMiss = cursor;
      }
      cursor = addDays(cursor, -1);
    }
    return { count, graceUsed: count > 0 && graceUsed };
  };

  // Today not done yet: the run is still alive if yesterday counts, or if yesterday is the
  // one forgiven miss this week.
  const yesterday = addDays(today, -1);
  const live = doneToday ? runEndingAt(today) : set.has(yesterday) ? runEndingAt(yesterday) : runEndingAt(addDays(today, -2), yesterday);

  let longest = 0;
  for (const day of set) {
    if (set.has(addDays(day, 1))) continue; // only measure from the last day of each run
    const run = runEndingAt(day).count;
    if (run > longest) longest = run;
  }

  return { current: live.count, longest: Math.max(longest, live.count), doneToday, graceUsed: live.graceUsed, atRisk: !doneToday && live.count > 0 };
}

// ---- Weeks in a row with at least one reach-out ---------------------------------------

export interface WeekStreak {
  /** Weeks in a row (Monday to Sunday) with at least one reach-out, counting this week if done. */
  current: number;
  longest: number;
  doneThisWeek: boolean;
}

/** Staying in touch is a weekly rhythm, not a daily one, so it is counted in weeks. */
export function weekStreak(days: Iterable<Day>, today: Day): WeekStreak {
  const weeks = new Set([...days].map(weekStart));
  const thisWeek = weekStart(today);
  const doneThisWeek = weeks.has(thisWeek);

  let current = 0;
  let cursor = doneThisWeek ? thisWeek : addDays(thisWeek, -7);
  while (weeks.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -7);
  }

  let longest = 0;
  for (const week of weeks) {
    if (weeks.has(addDays(week, 7))) continue;
    let run = 0;
    let w = week;
    while (weeks.has(w)) {
      run += 1;
      w = addDays(w, -7);
    }
    if (run > longest) longest = run;
  }
  return { current, longest: Math.max(longest, current), doneThisWeek };
}

// ---- Milestones -----------------------------------------------------------------------

export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365] as const;

/** The milestone a count has just landed on exactly, or null. */
export const milestoneAt = (count: number): number | null => (MILESTONES as readonly number[]).includes(count) ? count : null;

/** The next milestone above a count, or null past the last one. */
export const nextMilestone = (count: number): number | null => MILESTONES.find((m) => m > count) ?? null;

/** One line for Today about the prayer streak; null when there is nothing worth saying. */
export function prayerStreakLine(s: GentleStreak, options: { milestones?: boolean } = {}): string | null {
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  if (s.doneToday) {
    if (options.milestones !== false && milestoneAt(s.current)) return `${days(s.current)} of prayer in a row. Well done.`;
    if (s.current >= 2) return `${days(s.current)} of prayer in a row.`;
    return null;
  }
  if (s.current === 0) return null;
  if (s.graceUsed) return `You missed yesterday, and that's all right. Pray today to keep your ${days(s.current)} going.`;
  return `Pray today to make it ${days(s.current + 1)} in a row.`;
}

/** One line for Today about the weekly reach-out rhythm; null when there is nothing worth saying. */
export function weekStreakLine(s: WeekStreak): string | null {
  const weeks = (n: number) => `${n} ${n === 1 ? "week" : "weeks"}`;
  if (s.doneThisWeek) return s.current >= 2 ? `${weeks(s.current)} in a row staying in touch.` : null;
  return s.current >= 1 ? `Reach out to someone this week to make it ${weeks(s.current + 1)} in a row.` : null;
}

// ---- A memory from this day -----------------------------------------------------------

/** How far back to look, most meaningful first. */
export const MEMORY_OFFSETS = [
  { days: 365, label: "A year ago today" },
  { days: 182, label: "Six months ago" },
  { days: 91, label: "Three months ago" },
  { days: 30, label: "A month ago" },
  { days: 7, label: "A week ago today" },
] as const;

export interface Memory {
  label: string;
  day: Day;
  contactId: string;
  contactName: string;
  /** What was written down at the time, if anything. */
  summary: string | null;
}

/** The days worth looking up for a memory, given today. */
export const memoryDays = (today: Day): Day[] => MEMORY_OFFSETS.map((o) => addDays(today, -o.days));

/** Picks the oldest available memory, preferring one with something written down. */
export function pickMemory(today: Day, candidates: { day: Day; contactId: string; contactName: string; summary: string | null }[]): Memory | null {
  for (const wantSummary of [true, false]) {
    for (const offset of MEMORY_OFFSETS) {
      const day = addDays(today, -offset.days);
      const hit = candidates.find((c) => c.day === day && (!wantSummary || Boolean(c.summary?.trim())));
      if (hit) return { label: offset.label, day, contactId: hit.contactId, contactName: hit.contactName, summary: hit.summary?.trim() || null };
    }
  }
  return null;
}

// ---- What has been built up so far ----------------------------------------------------

export interface Keep {
  /** Which of these the person running the service has left switched on. */
  features: Features;
  prayerStreak: GentleStreak;
  reachOutWeeks: WeekStreak;
  /** Everything since the account was created: the reason not to start over somewhere else. */
  totals: { reachOuts: number; prayers: number; answered: number; sinceDay: Day };
  memory: Memory | null;
}

/** "Since March 2026: 42 reach-outs, 118 prayers, 3 answered." Null until there is something to count. */
export function soFarLine(totals: Keep["totals"]): string | null {
  const parts = [
    totals.reachOuts > 0 ? `${totals.reachOuts} ${totals.reachOuts === 1 ? "reach-out" : "reach-outs"}` : null,
    totals.prayers > 0 ? `${totals.prayers} ${totals.prayers === 1 ? "prayer" : "prayers"}` : null,
    totals.answered > 0 ? `${totals.answered} answered` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const [year, month] = totals.sinceDay.split("-");
  const name = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(month) - 1];
  return `Since ${name} ${year}: ${parts.join(", ")}.`;
}

// ---- A word for today -----------------------------------------------------------------

export interface DailyWord {
  text: string;
  reference: string;
  /** A small thing to do with it. */
  nudge: string;
}

/**
 * Short passages on friendship, love and prayer, from the King James Version (public
 * domain, so there is nothing to license). One per day, the same for everyone, cycling.
 */
export const DAILY_WORDS: readonly DailyWord[] = [
  { text: "A friend loveth at all times, and a brother is born for adversity.", reference: "Proverbs 17:17", nudge: "Who has been that friend to you? Tell them." },
  { text: "Bear ye one another's burdens, and so fulfil the law of Christ.", reference: "Galatians 6:2", nudge: "Whose burden could you ask about today?" },
  { text: "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.", reference: "Proverbs 27:17", nudge: "Thank someone who makes you better." },
  { text: "As cold waters to a thirsty soul, so is good news from a far country.", reference: "Proverbs 25:25", nudge: "Someone far away would love to hear from you." },
  { text: "Rejoice with them that do rejoice, and weep with them that weep.", reference: "Romans 12:15", nudge: "Who is celebrating or grieving this week?" },
  { text: "Two are better than one; because they have a good reward for their labour.", reference: "Ecclesiastes 4:9", nudge: "Who could you do something with this week?" },
  { text: "Pray without ceasing.", reference: "1 Thessalonians 5:17", nudge: "Say one name to God right now." },
  { text: "This is my commandment, That ye love one another, as I have loved you.", reference: "John 15:12", nudge: "One small act of love today. Who is it for?" },
  { text: "Greater love hath no man than this, that a man lay down his life for his friends.", reference: "John 15:13", nudge: "Give someone your time today." },
  { text: "For where two or three are gathered together in my name, there am I in the midst of them.", reference: "Matthew 18:20", nudge: "Invite someone to pray with you." },
  { text: "Beloved, let us love one another: for love is of God.", reference: "1 John 4:7", nudge: "Tell someone you love them. Out loud." },
  { text: "Wherefore comfort yourselves together, and edify one another, even as also ye do.", reference: "1 Thessalonians 5:11", nudge: "Send one encouraging sentence to someone." },
  { text: "Confess your faults one to another, and pray one for another, that ye may be healed.", reference: "James 5:16", nudge: "Ask a friend: how can I pray for you?" },
  { text: "And be ye kind one to another, tenderhearted, forgiving one another.", reference: "Ephesians 4:32", nudge: "Is there someone to forgive, or to ask forgiveness of?" },
  { text: "Let brotherly love continue.", reference: "Hebrews 13:1", nudge: "Keep one friendship going today." },
  { text: "A man that hath friends must shew himself friendly: and there is a friend that sticketh closer than a brother.", reference: "Proverbs 18:24", nudge: "Be the one who reaches out first." },
  { text: "Thine own friend, and thy father's friend, forsake not.", reference: "Proverbs 27:10", nudge: "Is there an old family friend you have lost touch with?" },
  { text: "Behold, how good and how pleasant it is for brethren to dwell together in unity!", reference: "Psalm 133:1", nudge: "Plan a meal with someone." },
  { text: "I thank my God upon every remembrance of you.", reference: "Philippians 1:3", nudge: "Who are you thankful for? Let them know." },
  { text: "And let us not be weary in well doing: for in due season we shall reap, if we faint not.", reference: "Galatians 6:9", nudge: "Keep showing up for someone, even if it feels small." },
  { text: "Look not every man on his own things, but every man also on the things of others.", reference: "Philippians 2:4", nudge: "Ask someone about their week, and listen." },
  { text: "And above all these things put on charity, which is the bond of perfectness.", reference: "Colossians 3:14", nudge: "Choose patience with someone today." },
  { text: "Let all your things be done with charity.", reference: "1 Corinthians 16:14", nudge: "Do one ordinary thing with love." },
  { text: "By this shall all men know that ye are my disciples, if ye have love one to another.", reference: "John 13:35", nudge: "Who needs to feel loved by you today?" },
  { text: "The effectual fervent prayer of a righteous man availeth much.", reference: "James 5:16", nudge: "Pray for the person on your list as if it matters. It does." },
  { text: "Casting all your care upon him; for he careth for you.", reference: "1 Peter 5:7", nudge: "Hand over one worry about someone you love." },
  { text: "Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.", reference: "Matthew 7:7", nudge: "What have you stopped asking for? Ask again." },
  { text: "Use hospitality one to another without grudging.", reference: "1 Peter 4:9", nudge: "Who could you have over?" },
  { text: "A word fitly spoken is like apples of gold in pictures of silver.", reference: "Proverbs 25:11", nudge: "Send the kind word you have been meaning to send." },
  { text: "Pleasant words are as an honeycomb, sweet to the soul, and health to the bones.", reference: "Proverbs 16:24", nudge: "Give one sincere compliment today." },
  { text: "Ointment and perfume rejoice the heart: so doth the sweetness of a man's friend by hearty counsel.", reference: "Proverbs 27:9", nudge: "Ask a wise friend for advice. It honours them." },
  { text: "Withhold not good from them to whom it is due, when it is in the power of thine hand to do it.", reference: "Proverbs 3:27", nudge: "Do the good you can do today, today." },
  { text: "The Lord watch between me and thee, when we are absent one from another.", reference: "Genesis 31:49", nudge: "Pray for someone you cannot be with." },
  { text: "Therefore all things whatsoever ye would that men should do to you, do ye even so to them.", reference: "Matthew 7:12", nudge: "What would you love to receive today? Give it." },
  { text: "Be kindly affectioned one to another with brotherly love; in honour preferring one another.", reference: "Romans 12:10", nudge: "Put someone else first today." },
  { text: "And let us consider one another to provoke unto love and to good works.", reference: "Hebrews 10:24", nudge: "Encourage someone toward something good." },
];

/** Days since a fixed date, so the word changes at midnight in the user's own timezone. */
export function dailyWord(day: Day): DailyWord {
  const index = ((diffDays("2026-01-01", day) % DAILY_WORDS.length) + DAILY_WORDS.length) % DAILY_WORDS.length;
  return DAILY_WORDS[index]!;
}

// ---- "Used last time" -----------------------------------------------------------------

/** How someone signed in on this device last time. Only "email" exists today; the shape leaves room for Apple, Google and Microsoft. */
export interface LastSignIn {
  method: "email" | "apple" | "google" | "microsoft";
  email: string;
  firstName: string;
}

export const LAST_SIGN_IN_KEY = "koinonia.lastSignIn";

export const rememberSignIn = (user: { name: string; email: string }, method: LastSignIn["method"] = "email"): string =>
  JSON.stringify({ method, email: user.email, firstName: user.name.trim().split(/\s+/)[0] ?? "" } satisfies LastSignIn);

export function readLastSignIn(text: string | null | undefined): LastSignIn | null {
  try {
    const v = JSON.parse(text ?? "") as Partial<LastSignIn>;
    return typeof v.email === "string" && v.email.includes("@") && typeof v.firstName === "string" && typeof v.method === "string" ? (v as LastSignIn) : null;
  } catch {
    return null;
  }
}

/** "pat@example.com" becomes "p•••@example.com": enough to recognise, not enough to read over a shoulder. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at < 1 ? email : `${email[0]}•••${email.slice(at)}`;
}

/** What anyone may know before signing in: only which optional features are on. */
export interface PublicConfig {
  features: Features;
  /** Outside sign-in: which providers are switched on, and where a sign-in starts. */
  signIn: { providers: ("apple" | "google" | "microsoft")[]; startBase: string };
}
