import type { FastifyInstance } from "fastify";
import {
  addDays,
  createContactSchema,
  importContactsSchema,
  reachOutSchema,
  snoozeSchema,
  updateContactSchema,
  type ContactDetail,
  type ImportResult,
} from "@koinonia/shared";
import { badRequest, notFound, parse } from "../lib/errors";
import { contactCounts, toContact, toIntention, toInteraction, toNote } from "../lib/serialize";
import { getOwnedContact, resyncSchedule, scheduleFields } from "../services/contacts";

type IdParams = { Params: { id: string } };

export async function contactRoutes(app: FastifyInstance) {
  const { prisma, now } = app.deps;
  app.addHook("preHandler", app.authenticate);

  async function assertLinkable(linkedUserId: string | null | undefined, selfId: string) {
    if (!linkedUserId) return;
    const other = await prisma.user.findFirst({
      where: { id: linkedUserId, discoverable: true, disabledAt: null, NOT: { id: selfId } },
    });
    if (!other) throw badRequest("That Koinonia member can't be linked.");
  }

  app.get<{ Querystring: { q?: string; archived?: string } }>("/contacts", async (request) => {
    const { q, archived } = request.query;
    const rows = await prisma.contact.findMany({
      where: {
        userId: request.auth.user.id,
        archivedAt: archived === "true" ? { not: null } : null,
        ...(q?.trim() ? { name: { contains: q.trim().slice(0, 80), mode: "insensitive" as const } } : {}),
      },
      include: contactCounts,
      orderBy: { name: "asc" },
    });
    return rows.map(toContact);
  });

  app.post("/contacts", async (request, reply) => {
    const input = parse(createContactSchema, request.body);
    const { user, today } = request.auth;
    if (input.lastContactedDay && input.lastContactedDay > today) {
      throw badRequest("Last contacted can't be in the future.", { lastContactedDay: "In the future" });
    }
    await assertLinkable(input.linkedUserId, user.id);
    const row = await prisma.contact.create({
      data: {
        ...input,
        userId: user.id,
        ...scheduleFields(input.cadenceDays, input.lastContactedDay, today),
      } as never,
      include: contactCounts,
    });
    reply.status(201);
    return toContact(row);
  });

  app.post("/contacts/import", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (request, reply): Promise<ImportResult> => {
    const input = parse(importContactsSchema, request.body);
    const { user, today } = request.auth;
    const existing = await prisma.contact.findMany({
      where: { userId: user.id },
      select: { name: true, phone: true, email: true },
    });
    // Skip people already in the list: the same phone number (compared by its last 10 digits,
    // so "+1 555 010 2000" and "(555) 010-2000" are one number), the same email, or the same
    // name when one side has nothing else to tell two people apart.
    const phoneKey = (phone: string | null | undefined) => {
      const digits = (phone ?? "").replace(/\D/g, "");
      return digits.length >= 7 ? `p:${digits.slice(-10)}` : null;
    };
    const seen = new Set<string>();
    const names = new Set<string>();
    const bareNames = new Set<string>();
    const remember = (c: { name: string; phone?: string | null; email?: string | null }) => {
      const phone = phoneKey(c.phone);
      if (phone) seen.add(phone);
      if (c.email) seen.add(`e:${c.email.toLowerCase()}`);
      names.add(c.name.toLowerCase());
      if (!phone && !c.email) bareNames.add(c.name.toLowerCase());
    };
    existing.forEach(remember);

    const toCreate = [];
    for (const c of input.contacts) {
      const phone = phoneKey(c.phone);
      const name = c.name.toLowerCase();
      const duplicate =
        (phone !== null && seen.has(phone)) ||
        (c.email !== null && seen.has(`e:${c.email}`)) ||
        bareNames.has(name) ||
        (!phone && !c.email && names.has(name));
      if (duplicate) continue;
      remember(c);
      toCreate.push({
        userId: user.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        birthday: c.birthday,
        cadenceDays: input.cadenceDays,
        nextDueDay: scheduleFields(input.cadenceDays, null, today).nextDueDay as string | null,
      });
    }
    if (toCreate.length) await prisma.contact.createMany({ data: toCreate });
    reply.status(201);
    return { created: toCreate.length, skipped: input.contacts.length - toCreate.length };
  });

  app.get<IdParams>("/contacts/:id", async (request): Promise<ContactDetail> => {
    const { user, today } = request.auth;
    const row = await prisma.contact.findFirst({
      where: { id: request.params.id, userId: user.id },
      include: {
        ...contactCounts,
        notes: { orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] },
        interactions: { orderBy: [{ day: "desc" }, { occurredAt: "desc" }], take: 50 },
        intentions: { orderBy: [{ status: "asc" }, { createdAt: "desc" }] },
      },
    });
    if (!row) throw notFound("That person");
    return {
      ...toContact(row),
      notes: row.notes.map((n) => toNote({ ...n, contact: row })),
      interactions: row.interactions.map(toInteraction),
      intentions: row.intentions.map((i) => toIntention({ ...i, contact: row }, today)),
    };
  });

  app.patch<IdParams>("/contacts/:id", async (request) => {
    const { archived, ...input } = parse(updateContactSchema, request.body);
    // `.partial()` still runs transforms; only touch keys the client actually sent.
    const sent = new Set(Object.keys((request.body as object | null) ?? {}));
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) if (sent.has(key)) data[key] = value;

    const { user, today } = request.auth;
    const current = await getOwnedContact(prisma, user.id, request.params.id);
    if (sent.has("linkedUserId")) await assertLinkable(input.linkedUserId, user.id);
    if (typeof data.lastContactedDay === "string" && data.lastContactedDay > today) {
      throw badRequest("Last contacted can't be in the future.", { lastContactedDay: "In the future" });
    }
    if (sent.has("archived")) data.archivedAt = archived ? (current.archivedAt ?? now()) : null;

    if (sent.has("cadenceDays") || sent.has("lastContactedDay")) {
      const cadence = sent.has("cadenceDays") ? (input.cadenceDays ?? null) : current.cadenceDays;
      const last = sent.has("lastContactedDay") ? (input.lastContactedDay ?? null) : current.lastContactedDay;
      Object.assign(data, scheduleFields(cadence, last, today));
      data.snoozedUntilDay = null;
    }

    const row = await prisma.contact.update({ where: { id: current.id }, data, include: contactCounts });
    return toContact(row);
  });

  app.delete<IdParams>("/contacts/:id", async (request, reply) => {
    const current = await getOwnedContact(prisma, request.auth.user.id, request.params.id);
    await prisma.contact.delete({ where: { id: current.id } });
    return reply.status(204).send();
  });

  /** "I reached out" — logs it and restarts the clock from that day. */
  app.post<IdParams>("/contacts/:id/reach-out", async (request, reply) => {
    const input = parse(reachOutSchema, request.body);
    const { user, today } = request.auth;
    const current = await getOwnedContact(prisma, user.id, request.params.id);
    const day = input.day ?? today;
    if (day > today) throw badRequest("You can't log a reach-out in the future.", { day: "In the future" });

    // All or nothing: the log entry, the cleared snooze and the new due date move together.
    const { interaction, contact } = await prisma.$transaction(async (tx) => {
      const interaction = await tx.interaction.create({
        data: {
          userId: user.id,
          contactId: current.id,
          channel: input.channel ?? current.preferredChannel,
          summary: input.summary,
          day,
          occurredAt: now(),
        },
      });
      await tx.contact.update({ where: { id: current.id }, data: { snoozedUntilDay: null } });
      return { interaction, contact: await resyncSchedule(tx, current.id, today) };
    });
    reply.status(201);
    return { contact: toContact(contact), interaction: toInteraction(interaction) };
  });

  app.delete<IdParams>("/interactions/:id", async (request, reply) => {
    const { user, today } = request.auth;
    const row = await prisma.interaction.findFirst({ where: { id: request.params.id, userId: user.id } });
    if (!row) throw notFound("That reach-out");
    await prisma.$transaction(async (tx) => {
      await tx.interaction.delete({ where: { id: row.id } });
      await resyncSchedule(tx, row.contactId, today);
    });
    return reply.status(204).send();
  });

  /** "Not now" — push the reminder without pretending you reached out. */
  app.post<IdParams>("/contacts/:id/snooze", async (request) => {
    const input = parse(snoozeSchema, request.body);
    const { user, today } = request.auth;
    const current = await getOwnedContact(prisma, user.id, request.params.id);
    let snoozedUntilDay: string | null = null;
    if ("days" in input) snoozedUntilDay = addDays(today, input.days);
    else if ("untilDay" in input) {
      if (input.untilDay <= today) throw badRequest("Pick a day after today.", { untilDay: "Must be later" });
      snoozedUntilDay = input.untilDay;
    }
    const row = await prisma.contact.update({
      where: { id: current.id },
      data: { snoozedUntilDay },
      include: contactCounts,
    });
    return toContact(row);
  });
}
