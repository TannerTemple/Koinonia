import type { PrismaClient } from "@prisma/client";
import type { PrayerToday } from "@koinonia/shared";
import { toIntention } from "../lib/serialize";

const withContact = { contact: { select: { name: true } } };

/**
 * The special intention of the day. If the user hasn't chosen one, Koinonia suggests the
 * active intention that has waited longest (never prayed first, then least recently prayed),
 * and keeps that suggestion stable for the rest of the day.
 */
export async function getPrayerToday(
  prisma: PrismaClient,
  userId: string,
  today: string,
): Promise<PrayerToday> {
  const existing = await prisma.dailyIntention.findUnique({
    where: { userId_day: { userId, day: today } },
    include: { intention: { include: withContact } },
  });
  if (existing && existing.intention.status === "ACTIVE") {
    return {
      day: today,
      intention: toIntention(existing.intention, today),
      chosenByUser: existing.chosenByUser,
    };
  }

  const suggestion = await prisma.prayerIntention.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ lastPrayedDay: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    include: withContact,
  });
  if (!suggestion) {
    if (existing) await prisma.dailyIntention.delete({ where: { id: existing.id } });
    return { day: today, intention: null, chosenByUser: false };
  }
  await prisma.dailyIntention.upsert({
    where: { userId_day: { userId, day: today } },
    create: { userId, day: today, intentionId: suggestion.id, chosenByUser: false },
    update: { intentionId: suggestion.id, chosenByUser: false },
  });
  return { day: today, intention: toIntention(suggestion, today), chosenByUser: false };
}
