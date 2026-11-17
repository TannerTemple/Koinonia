import type { PrismaClient } from "@prisma/client";
import { addDays, computeStreak, gentleStreak, memoryDays, nextBirthday, pickMemory, weekStreak, type Contact, type Home } from "@koinonia/shared";
import { contactCounts, toContact, toNote } from "../lib/serialize";
import { getPrayerToday } from "./prayer";

const UPCOMING_DAYS = 14;
const FOLLOW_UP_DAYS = 7;

export async function buildHome(prisma: PrismaClient, userId: string, today: string): Promise<Home> {
  const [rows, followUps, reachDays, prayerDays, activeIntentions, reachOutsThisWeek, prayer, totalReachOuts, totalPrayers, answered, account, remembered] =
    await Promise.all([
      prisma.contact.findMany({ where: { userId, archivedAt: null }, include: contactCounts }),
      prisma.note.findMany({
        where: {
          userId,
          followUpDone: false,
          followUpDay: { not: null, lte: addDays(today, FOLLOW_UP_DAYS) },
          contact: { archivedAt: null },
        },
        include: { contact: { select: { name: true } } },
        orderBy: { followUpDay: "asc" },
      }),
      prisma.interaction.groupBy({ by: ["day"], where: { userId } }),
      prisma.prayerLog.groupBy({ by: ["day"], where: { userId } }),
      prisma.prayerIntention.count({ where: { userId, status: "ACTIVE" } }),
      prisma.interaction.count({ where: { userId, day: { gt: addDays(today, -7) } } }),
      getPrayerToday(prisma, userId, today),
      prisma.interaction.count({ where: { userId } }),
      prisma.prayerLog.count({ where: { userId } }),
      prisma.prayerIntention.count({ where: { userId, status: "ANSWERED" } }),
      prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      // Reach-outs on the same day a week, a month, three and six months and a year ago.
      prisma.interaction.findMany({
        where: { userId, day: { in: memoryDays(today) }, contact: { archivedAt: null } },
        select: { day: true, summary: true, contactId: true, contact: { select: { name: true } } },
        orderBy: { occurredAt: "asc" },
        take: 50,
      }),
    ]);

  const contacts = rows.map(toContact);
  const byDue = (a: Contact, b: Contact) =>
    (a.dueDay ?? "").localeCompare(b.dueDay ?? "") || a.name.localeCompare(b.name);
  const horizon = addDays(today, UPCOMING_DAYS);

  const birthdays = contacts
    .flatMap((contact) => {
      const day = contact.birthday ? nextBirthday(contact.birthday, today) : null;
      return day && day <= horizon ? [{ contact, day }] : [];
    })
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    today,
    overdue: contacts.filter((c) => c.dueDay && c.dueDay < today).sort(byDue),
    dueToday: contacts.filter((c) => c.dueDay === today).sort(byDue),
    upcoming: contacts.filter((c) => c.dueDay && c.dueDay > today && c.dueDay <= horizon).sort(byDue),
    nextUp: contacts.filter((c) => c.dueDay && c.dueDay > horizon).sort(byDue)[0] ?? null,
    followUps: followUps.map(toNote),
    birthdays,
    prayer,
    streaks: {
      reachOut: computeStreak(reachDays.map((r) => r.day), today),
      prayer: computeStreak(prayerDays.map((r) => r.day), today),
    },
    keep: {
      prayerStreak: gentleStreak(prayerDays.map((r) => r.day), today),
      reachOutWeeks: weekStreak(reachDays.map((r) => r.day), today),
      totals: { reachOuts: totalReachOuts, prayers: totalPrayers, answered, sinceDay: (account?.createdAt ?? new Date()).toISOString().slice(0, 10) },
      memory: pickMemory(today, remembered.map((r) => ({ day: r.day, contactId: r.contactId, contactName: r.contact.name, summary: r.summary }))),
    },
    stats: { contacts: contacts.length, reachOutsThisWeek, activeIntentions },
  };
}
