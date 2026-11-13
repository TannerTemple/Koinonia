import type { PrismaClient, PushDevice, User } from "@prisma/client";
import { dayInTimezone, dueLabel, hourInTimezone } from "@koinonia/shared";
import type { Env } from "../env";
import type { Providers } from "../providers";
import { buildHome } from "./home";

const BATCH_SIZE = 200;

export interface DigestResult {
  considered: number;
  sent: number;
}

/**
 * The daily reminder. For every user whose local time has reached DIGEST_HOUR and who
 * hasn't had today's digest yet, send who is due (email + push, optionally SMS).
 * Safe to run as often as you like; each user gets at most one a day.
 */
export async function runDigest(
  deps: { prisma: PrismaClient; providers: Providers; env: Env },
  at: Date = new Date(),
): Promise<DigestResult> {
  const { prisma } = deps;
  let sent = 0;
  let considered = 0;
  let cursor: string | undefined;
  // Walk the users a page at a time, so memory stays flat however many there are.
  for (;;) {
    const users = await prisma.user.findMany({
      where: { digestEnabled: true, disabledAt: null },
      include: { devices: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1]!.id;
    considered += users.length;
    for (const user of users) {
      if (await sendDigest(deps, user, at)) sent += 1;
    }
    if (users.length < BATCH_SIZE) break;
  }
  return { considered, sent };
}

type DigestUser = User & { devices: PushDevice[] };

/** Sends one user's digest if it is due. Returns whether anything was delivered. */
async function sendDigest(
  { prisma, providers, env }: { prisma: PrismaClient; providers: Providers; env: Env },
  user: DigestUser,
  at: Date,
): Promise<boolean> {
  {
    const today = dayInTimezone(at, user.timezone);
    if (user.lastDigestDay === today || hourInTimezone(at, user.timezone) < env.DIGEST_HOUR) return false;
    const markDone = () => prisma.user.update({ where: { id: user.id }, data: { lastDigestDay: today } });

    const home = await buildHome(prisma, user.id, today);
    const due = [...home.overdue, ...home.dueToday];
    const followUps = home.followUps.filter((n) => n.followUpDay! <= today);
    if (due.length === 0 && followUps.length === 0) {
      await markDone();
      return false;
    }

    const names = due.map((c) => c.name);
    const headline =
      names.length === 0
        ? `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} for today`
        : names.length <= 2
          ? `Reach out to ${names.join(" and ")} today`
          : `Reach out to ${names[0]}, ${names[1]} and ${names.length - 2} more today`;

    const lines = [
      `Good morning, ${user.name.split(" ")[0]}.`,
      "",
      ...(due.length ? ["People to reach out to:", ...due.map((c) => `  • ${c.name} — ${dueLabel(c.dueDay, today)}`), ""] : []),
      ...(followUps.length
        ? ["Follow-ups:", ...followUps.map((n) => `  • ${n.contactName}: ${n.body}`), ""]
        : []),
      ...(home.prayer.intention ? [`Today's intention: ${home.prayer.intention.title}`, ""] : []),
      `Open Koinonia: ${env.WEB_URL}`,
    ];

    const results = await Promise.allSettled([
      providers.email.send({ to: user.email, subject: headline, text: lines.join("\n") }),
      user.devices.length
        ? providers.push.send({
            tokens: user.devices.map((d) => d.token),
            title: "Koinonia",
            body: headline,
            data: { url: "/" },
          })
        : Promise.resolve(),
      env.DIGEST_SMS && user.phone
        ? providers.sms.send({ to: user.phone, body: `Koinonia: ${headline}. ${env.WEB_URL}` })
        : Promise.resolve(),
    ]);
    for (const r of results) if (r.status === "rejected") console.error("[digest] delivery failed:", r.reason);
    // Only tick the day off once the email got out; otherwise the next run tries again.
    if (results[0].status === "rejected") return false;
    await markDone();
    return true;
  }
}
