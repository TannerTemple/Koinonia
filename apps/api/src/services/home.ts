import type { PrismaClient } from "@prisma/client";
import { addDays, computeStreak, nextBirthday, type Contact, type Home } from "@koinonia/shared";
import { contactCounts, toContact, toNote } from "../lib/serialize";
import { getPrayerToday } from "./prayer";

const UPCOMING_DAYS = 14;
const FOLLOW_UP_DAYS = 7;

export async function buildHome(prisma: PrismaClient, userId: string, today: string): Promise<Home> {
  const [rows, followUps, reachDays, prayerDays, activeIntentions, reachOutsThisWeek, prayer] =
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
    followUps: followUps.map(toNote),
    birthdays,
    prayer,
    streaks: {
      reachOut: computeStreak(reachDays.map((r) => r.day), today),
      prayer: computeStreak(prayerDays.map((r) => r.day), today),
    },
    stats: { contacts: contacts.length, reachOutsThisWeek, activeIntentions },
  };
}
