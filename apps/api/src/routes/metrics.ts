import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ACTION_NAMES, dayInTimezone, isActivated, screenPattern, weeklyMetrics, addDays, type AdminMetrics, type MetricsAccount, type UsageKind } from "@koinonia/shared";
import { parse } from "../lib/errors";
import { safeError } from "../lib/log";

const usageSchema = z.object({
  platform: z.enum(["web", "app"]),
  /** Screen addresses as the app sees them; reduced to patterns before anything is stored. */
  screens: z.array(z.string().max(200)).min(1).max(20),
});

const utcToday = (now: () => Date) => dayInTimezone(now(), "UTC");

/**
 * Counts successful actions ("Logged a reach-out") from the route that handled them, so the
 * apps cannot get it wrong. Must be added to the scope that holds the routes, before them.
 */
export function countActions(scope: FastifyInstance) {
  const { prisma, now } = scope.deps;
  scope.addHook("onResponse", async (request, reply) => {
    if (reply.statusCode >= 300) return;
    const pattern = (request.routeOptions?.url ?? "").replace(/^\/v1/, "");
    const name = ACTION_NAMES[`${request.method} /v1${pattern}`];
    if (!name) return;
    const platform = request.headers["x-koinonia-client"] === "web" ? "web" : "app";
    const day = utcToday(now);
    const work = prisma.usageCount
      .upsert({ where: { day_kind_name_platform: { day, kind: "action", name, platform } }, create: { day, kind: "action", name, platform, count: 1 }, update: { count: { increment: 1 } } })
      .catch((err: unknown) => request.log.warn({ err: safeError(err) }, "usage count failed"));
    scope.background.track(work);
  });
}

/**
 * Beta metrics without a tracker: per-day counters with no account attached, plus weekly
 * figures worked out from timestamps the app already has. No names, notes or prayers are read.
 */
export async function metricsRoutes(app: FastifyInstance) {
  const { prisma, now } = app.deps;
  const today = () => utcToday(now);

  const bump = (kind: UsageKind, name: string, platform: string, by = 1) =>
    prisma.usageCount.upsert({
      where: { day_kind_name_platform: { day: today(), kind, name, platform } },
      create: { day: today(), kind, name, platform, count: by },
      update: { count: { increment: by } },
    });

  // Screens: the apps say which screen was opened. Signed-in people only, so strangers cannot inflate it.
  app.post("/usage", { preHandler: app.authenticate, config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (request, reply) => {
    const input = parse(usageSchema, request.body);
    const counts = new Map<string, number>();
    for (const path of input.screens) {
      const pattern = screenPattern(path);
      if (pattern) counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    }
    const work = Promise.all([...counts].map(([name, n]) => bump("screen", name, input.platform, n))).catch((err: unknown) => request.log.warn({ err: safeError(err) }, "usage count failed"));
    app.background.track(work);
    return reply.code(204).send();
  });

  app.get("/admin/metrics", { preHandler: app.requireAdmin }, async (): Promise<AdminMetrics> => {
    const day = today();
    const [users, contacts, reachDays, prayerDays, usage] = await Promise.all([
      prisma.user.findMany({ select: { id: true, createdAt: true } }),
      prisma.contact.findMany({ select: { userId: true, createdAt: true } }),
      prisma.interaction.groupBy({ by: ["userId", "day"] }),
      prisma.prayerLog.groupBy({ by: ["userId", "day"] }),
      prisma.usageCount.groupBy({ by: ["kind", "name", "platform"], where: { day: { gt: addDays(day, -30) } }, _sum: { count: true } }),
    ]);
    const utcDay = (d: Date) => d.toISOString().slice(0, 10);
    const byUser = new Map<string, MetricsAccount>(users.map((u) => [u.id, { signedUpDay: utcDay(u.createdAt), peopleAddedDays: [], activeDays: [] }]));
    for (const c of contacts) byUser.get(c.userId)?.peopleAddedDays.push(utcDay(c.createdAt));
    for (const r of [...reachDays, ...prayerDays]) byUser.get(r.userId)?.activeDays.push(r.day);
    const accounts = [...byUser.values()];
    return {
      today: day,
      totals: { accounts: accounts.length, activated: accounts.filter(isActivated).length },
      weeks: weeklyMetrics(accounts, day, 12),
      usage: usage
        .map((u) => ({ kind: u.kind as UsageKind, name: u.name, platform: u.platform, count: u._sum.count ?? 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };
  });
}
