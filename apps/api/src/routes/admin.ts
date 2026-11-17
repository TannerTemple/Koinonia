import type { FastifyInstance } from "fastify";
import { adminUpdateUserSchema, type AdminStats, type AdminUser } from "@koinonia/shared";
import { badRequest, notFound, parse } from "../lib/errors";
import { pageOf } from "../lib/page";
import { toUser } from "../lib/serialize";

const counts = { _count: { select: { contacts: true, intentions: true } } };

export async function adminRoutes(app: FastifyInstance) {
  const { prisma, now } = app.deps;
  app.addHook("preHandler", app.requireAdmin);

  type Row = Parameters<typeof toUser>[0] & { _count: { contacts: number; intentions: number } };
  const toAdminUser = (row: Row): AdminUser => ({
    ...toUser(row),
    disabled: row.disabledAt !== null,
    contactCount: row._count.contacts,
    intentionCount: row._count.intentions,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
  });

  app.get("/admin/stats", async (): Promise<AdminStats> => {
    const weekAgo = new Date(now().getTime() - 7 * 86_400_000);
    const [users, newUsersThisWeek, activeUsersThisWeek, contacts, reachOuts, reachOutsThisWeek, intentions, prayers] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.user.count({ where: { lastSeenAt: { gte: weekAgo } } }),
        prisma.contact.count(),
        prisma.interaction.count(),
        prisma.interaction.count({ where: { occurredAt: { gte: weekAgo } } }),
        prisma.prayerIntention.count(),
        prisma.prayerLog.count(),
      ]);
    return { users, newUsersThisWeek, activeUsersThisWeek, contacts, reachOuts, reachOutsThisWeek, intentions, prayers };
  });

  app.get<{ Querystring: { q?: string; limit?: string; offset?: string } }>("/admin/users", async (request, reply) => {
    const q = request.query.q?.trim().slice(0, 100);
    const where = q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
      : {};
    const { limit, offset } = pageOf(request.query, 100, 200);
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, include: counts, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: limit, skip: offset }),
      prisma.user.count({ where }),
    ]);
    reply.header("X-Total-Count", String(total));
    return rows.map(toAdminUser);
  });

  app.patch<{ Params: { id: string } }>("/admin/users/:id", async (request) => {
    const input = parse(adminUpdateUserSchema, request.body);
    const target = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!target) throw notFound("That user");
    if (target.id === request.auth.user.id) {
      throw badRequest("You can't change your own role or disable yourself.");
    }
    const row = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(input.role ? { role: input.role } : {}),
        ...(input.disabled === undefined ? {} : { disabledAt: input.disabled ? now() : null }),
      },
      include: counts,
    });
    // A disabled account is signed out everywhere.
    if (input.disabled) {
      await prisma.session.deleteMany({ where: { userId: target.id } });
      await prisma.pushDevice.deleteMany({ where: { userId: target.id } });
    }
    return toAdminUser(row);
  });
}
