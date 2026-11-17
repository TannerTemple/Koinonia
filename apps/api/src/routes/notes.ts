import type { FastifyInstance } from "fastify";
import { createNoteSchema, updateNoteSchema } from "@koinonia/shared";
import { notFound, parse } from "../lib/errors";
import { toNote } from "../lib/serialize";
import { getOwnedContact } from "../services/contacts";

type IdParams = { Params: { id: string } };
const withContact = { contact: { select: { name: true } } };

export async function noteRoutes(app: FastifyInstance) {
  const { prisma } = app.deps;
  app.addHook("preHandler", app.authenticate);

  app.get<IdParams>("/contacts/:id/notes", async (request) => {
    const contact = await getOwnedContact(prisma, request.auth.user.id, request.params.id);
    const rows = await prisma.note.findMany({
      where: { contactId: contact.id },
      include: withContact,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toNote);
  });

  app.post<IdParams>("/contacts/:id/notes", async (request, reply) => {
    const input = parse(createNoteSchema, request.body);
    const contact = await getOwnedContact(prisma, request.auth.user.id, request.params.id);
    const row = await prisma.note.create({
      data: { ...input, pinned: input.pinned ?? false, contactId: contact.id, userId: request.auth.user.id },
      include: withContact,
    });
    reply.status(201);
    return toNote(row);
  });

  app.patch<IdParams>("/notes/:id", async (request) => {
    const input = parse(updateNoteSchema, request.body);
    const sent = new Set(Object.keys((request.body as object | null) ?? {}));
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) if (sent.has(key)) data[key] = value;
    // Moving a follow-up to a new day re-opens it.
    if (sent.has("followUpDay") && !sent.has("followUpDone")) data.followUpDone = false;

    const existing = await prisma.note.findFirst({
      where: { id: request.params.id, userId: request.auth.user.id },
    });
    if (!existing) throw notFound("That note");
    const row = await prisma.note.update({ where: { id: existing.id }, data, include: withContact });
    return toNote(row);
  });

  app.delete<IdParams>("/notes/:id", async (request, reply) => {
    const { count } = await prisma.note.deleteMany({
      where: { id: request.params.id, userId: request.auth.user.id },
    });
    if (!count) throw notFound("That note");
    return reply.status(204).send();
  });
}
