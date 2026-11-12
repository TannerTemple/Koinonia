import type { PrismaClient } from "@prisma/client";
import { addDays, computeStreak, type WeeklyReview, type WeekSummary } from "@koinonia/shared";

/**
 * The weekly review: the last 7 days (ending today) compared with the 7 days before.
 * Rolling windows rather than calendar weeks, so the comparison is always 7 full days
 * against 7 full days, whatever day you look.
 */
export async function buildWeeklyReview(prisma: PrismaClient, userId: string, today: string): Promise<WeeklyReview> {
  const from = addDays(today, -13);
  const [interactions, prayers, reachDays, prayerDays] = await Promise.all([
    prisma.interaction.findMany({
      where: { userId, day: { gte: from, lte: today } },
      select: { day: true, contactId: true, contact: { select: { name: true } } },
    }),
    prisma.prayerLog.findMany({ where: { userId, day: { gte: from, lte: today } }, select: { day: true } }),
    prisma.interaction.groupBy({ by: ["day"], where: { userId } }),
    prisma.prayerLog.groupBy({ by: ["day"], where: { userId } }),
  ]);

  const summarize = (startDay: string): WeekSummary => {
    const endDay = addDays(startDay, 6);
    const inWindow = <T extends { day: string }>(rows: T[]) => rows.filter((r) => r.day >= startDay && r.day <= endDay);
    const reach = inWindow(interactions);
    const prayed = inWindow(prayers);

    const days = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(startDay, i);
      return {
        day,
        reachOuts: reach.filter((r) => r.day === day).length,
        prayers: prayed.filter((p) => p.day === day).length,
      };
    });
    const people = new Map<string, { id: string; name: string; reachOuts: number }>();
    for (const r of reach) {
      const entry = people.get(r.contactId) ?? { id: r.contactId, name: r.contact.name, reachOuts: 0 };
      entry.reachOuts += 1;
      people.set(r.contactId, entry);
    }

    return {
      startDay,
      endDay,
      reachOuts: reach.length,
      peopleReached: people.size,
      prayers: prayed.length,
      daysReachedOut: days.filter((d) => d.reachOuts > 0).length,
      daysPrayed: days.filter((d) => d.prayers > 0).length,
      days,
      people: [...people.values()].sort((a, b) => b.reachOuts - a.reachOuts || a.name.localeCompare(b.name)),
    };
  };

  return {
    today,
    thisWeek: summarize(addDays(today, -6)),
    lastWeek: summarize(addDays(today, -13)),
    streaks: {
      reachOut: computeStreak(reachDays.map((r) => r.day), today),
      prayer: computeStreak(prayerDays.map((r) => r.day), today),
    },
  };
}
