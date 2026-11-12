import type { FastifyInstance } from "fastify";
import {
  createIntentionSchema,
  INTENTION_STATUSES,
  setDailyIntentionSchema,
  updateIntentionSchema,
  type IntentionStatus,
  type PrayerToday,
} from "@koinonia/shared";
import { badRequest, notFound, parse } from "../lib/errors";
import { toIntention } from "../lib/serialize";
import { getOwnedContact } from "../services/contacts";
import { getPrayerToday } from "../services/prayer";

type IdParams = { Params: { id: string } };
const withContact = { contact: { select: { name: true } } };

export async function prayerRoutes(app: FastifyInstance) {
  const { prisma, now } = app.deps;
  app.addHook("preHandler", app.authenticate);

  async function getOwned(userId: string, id: string) {
    const row = await prisma.prayerIntention.findFirst({ where: { id, userId }, include: withContact });
    if (!row) throw notFound("That intention");
    return row;
  }

  app.get<{ Querystring: { status?: string } }>("/intentions", async (request) => {
    const { user, today } = request.auth;
    const status = request.query.status as IntentionStatus | undefined;
    if (status && !INTENTION_STATUSES.includes(status)) throw badRequest("Unknown status.");
    const rows = await prisma.prayerIntention.findMany({
      where: { userId: user.id, ...(status ? { status } : {}) },
      include: withContact,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => toIntention(r, today));
  });

  app.post("/intentions", async (request, reply) => {
    const input = parse(createIntentionSchema, request.body);
    const { user, today } = request.auth;
    if (input.contactId) await getOwnedContact(prisma, user.id, input.contactId);
    const row = await prisma.prayerIntention.create({
      data: {
        userId: user.id,
        title: input.title,
        details: input.details,
        // An intention for a person defaults to a promise; one without, to personal.
        kind: input.kind ?? (input.contactId ? "PROMISED" : "PERSONAL"),
        contactId: input.contactId ?? null,
      },
      include: withContact,
    });
    reply.status(201);
    return toIntention(row, today);
  });

  app.patch<IdParams>("/intentions/:id", async (request) => {
    const input = parse(updateIntentionSchema, request.body);
    const sent = new Set(Object.keys((request.body as object | null) ?? {}));
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) if (sent.has(key)) data[key] = value;

    const { user, today } = request.auth;
    const current = await getOwned(user.id, request.params.id);
    if (input.contactId) await getOwnedContact(prisma, user.id, input.contactId);
    if (input.status && input.status !== current.status) {
      data.answeredAt = input.status === "ANSWERED" ? now() : null;
    }
    const row = await prisma.prayerIntention.update({ where: { id: current.id }, data, include: withContact });
    return toIntention(row, today);
  });

  app.delete<IdParams>("/intentions/:id", async (request, reply) => {
    const current = await getOwned(request.auth.user.id, request.params.id);
    await prisma.prayerIntention.delete({ where: { id: current.id } });
    return reply.status(204).send();
  });

  /** Mark an intention as prayed for today. Idempotent: once per intention per day. */
  app.post<IdParams>("/intentions/:id/pray", async (request) => {
    const { user, today } = request.auth;
    const current = await getOwned(user.id, request.params.id);
    const already = await prisma.prayerLog.findUnique({
      where: { intentionId_day: { intentionId: current.id, day: today } },
    });
    if (already) return toIntention(current, today);
    // Two taps at once: the unique (intention, day) index rejects the second; the error
    // handler turns that into a 409 rather than double-counting.
    const [, row] = await prisma.$transaction([
      prisma.prayerLog.create({ data: { userId: user.id, intentionId: current.id, day: today } }),
      prisma.prayerIntention.update({
        where: { id: current.id },
        data: { prayedCount: { increment: 1 }, lastPrayedDay: today },
        include: withContact,
      }),
    ]);
    return toIntention(row, today);
  });

  /** Undo today's "prayed". */
  app.delete<IdParams>("/intentions/:id/pray", async (request) => {
    const { user, today } = request.auth;
    const current = await getOwned(user.id, request.params.id);
    const { count } = await prisma.prayerLog.deleteMany({ where: { intentionId: current.id, day: today } });
    if (!count) return toIntention(current, today);
    const latest = await prisma.prayerLog.findFirst({
      where: { intentionId: current.id },
      orderBy: { day: "desc" },
    });
    const row = await prisma.prayerIntention.update({
      where: { id: current.id },
      data: { prayedCount: { decrement: 1 }, lastPrayedDay: latest?.day ?? null },
      include: withContact,
    });
    return toIntention(row, today);
  });

  app.get("/prayer/today", async (request): Promise<PrayerToday> => {
    return getPrayerToday(prisma, request.auth.user.id, request.auth.today);
  });

  /** Choose today's special intention yourself. */
  app.put("/prayer/today", async (request): Promise<PrayerToday> => {
    const input = parse(setDailyIntentionSchema, request.body);
    const { user, today } = request.auth;
    const intention = await getOwned(user.id, input.intentionId);
    if (intention.status !== "ACTIVE") throw badRequest("Choose an active intention.");
    await prisma.dailyIntention.upsert({
      where: { userId_day: { userId: user.id, day: today } },
      create: { userId: user.id, day: today, intentionId: intention.id, chosenByUser: true },
      update: { intentionId: intention.id, chosenByUser: true },
    });
    return { day: today, intention: toIntention(intention, today), chosenByUser: true };
  });
}
