import type { Prisma, PrismaClient } from "@prisma/client";
import { computeNextDue } from "@koinonia/shared";
import { notFound } from "../lib/errors";
import { contactCounts } from "../lib/serialize";

export async function getOwnedContact(prisma: PrismaClient, userId: string, id: string) {
  const contact = await prisma.contact.findFirst({ where: { id, userId }, include: contactCounts });
  if (!contact) throw notFound("That person");
  return contact;
}

/**
 * The reminder clock: next due = last reach-out + cadence. A person you have never
 * logged a reach-out for starts counting from `today`.
 */
export function scheduleFields(
  cadenceDays: number | null,
  lastContactedDay: string | null,
  today: string,
): Pick<Prisma.ContactUncheckedUpdateInput, "nextDueDay"> {
  return { nextDueDay: computeNextDue(lastContactedDay ?? today, cadenceDays) };
}

/** Recompute last-contacted / next-due from the interaction log (after a log is added or removed). */
export async function resyncSchedule(prisma: PrismaClient, contactId: string, today: string) {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const latest = await prisma.interaction.findFirst({
    where: { contactId },
    orderBy: { day: "desc" },
    select: { day: true },
  });
  const lastContactedDay = latest?.day ?? null;
  return prisma.contact.update({
    where: { id: contactId },
    data: {
      lastContactedDay,
      ...scheduleFields(contact.cadenceDays, lastContactedDay, today),
    },
    include: contactCounts,
  });
}
