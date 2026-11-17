import type { FastifyInstance } from "fastify";
import { BRAND, CHANNEL_LABELS, INTENTION_KIND_LABELS, type DataExport } from "@koinonia/shared";
import { toCsv, type CsvValue } from "../lib/csv";
import { notFound } from "../lib/errors";

const TABLES = ["people", "notes", "reach-outs", "prayers"] as const;
type Table = (typeof TABLES)[number];

/**
 * "Export all my data": everything the account holds, as one JSON file or as spreadsheets.
 * Only ever the signed-in user's own data. Secrets (password hash, session and reset
 * tokens, the calendar link) are not part of it.
 */
export async function exportRoutes(app: FastifyInstance) {
  const { prisma, now } = app.deps;
  const limited = { preHandler: app.authenticate, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

  async function collect(userId: string): Promise<DataExport> {
    const [user, contacts, intentions] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      prisma.contact.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        include: { notes: { orderBy: { createdAt: "asc" } }, interactions: { orderBy: [{ day: "asc" }, { occurredAt: "asc" }] } },
      }),
      prisma.prayerIntention.findMany({
        where: { userId },
        orderBy: { createdAt: "asc" },
        include: { contact: { select: { name: true } }, logs: { orderBy: { day: "asc" }, select: { day: true } } },
      }),
    ]);
    return {
      exportedAt: now().toISOString(),
      account: {
        name: user.name,
        email: user.email,
        emailConfirmed: user.emailVerifiedAt !== null,
        phone: user.phone,
        timezone: user.timezone,
        findableByOthers: user.discoverable,
        dailyEmail: user.digestEnabled,
        createdAt: user.createdAt.toISOString(),
      },
      people: contacts.map((c) => ({
        name: c.name,
        phone: c.phone,
        email: c.email,
        relationship: c.relationship,
        birthday: c.birthday,
        groups: c.groups,
        favorite: c.favorite,
        reachOutEveryDays: c.cadenceDays,
        reminderTime: c.reminderTime,
        usualWay: CHANNEL_LABELS[c.preferredChannel],
        lastReachedOut: c.lastContactedDay,
        nextDue: c.nextDueDay,
        remindAgainOn: c.snoozedUntilDay,
        archived: c.archivedAt !== null,
        addedAt: c.createdAt.toISOString(),
        notes: c.notes.map((n) => ({ text: n.body, pinned: n.pinned, followUpOn: n.followUpDay, followUpDone: n.followUpDone, writtenAt: n.createdAt.toISOString() })),
        reachOuts: c.interactions.map((i) => ({ day: i.day, how: CHANNEL_LABELS[i.channel], summary: i.summary })),
      })),
      prayers: intentions.map((i) => ({
        title: i.title,
        details: i.details,
        for: i.contact?.name ?? null,
        kind: INTENTION_KIND_LABELS[i.kind],
        status: i.status.toLowerCase(),
        answeredAt: i.answeredAt?.toISOString() ?? null,
        addedAt: i.createdAt.toISOString(),
        prayedOn: i.logs.map((l) => l.day),
      })),
    };
  }

  const stamp = (data: DataExport) => data.exportedAt.slice(0, 10);

  app.get("/me/export", limited, async (request, reply) => {
    const data = await collect(request.auth.user.id);
    reply.header("Content-Disposition", `attachment; filename="${BRAND.slug}-${stamp(data)}.json"`);
    return data;
  });

  app.get<{ Params: { file: string } }>("/me/export/:file", limited, async (request, reply) => {
    const table = request.params.file.replace(/\.csv$/, "") as Table;
    if (!TABLES.includes(table) || !request.params.file.endsWith(".csv")) throw notFound("That export");
    const data = await collect(request.auth.user.id);

    let headers: string[];
    let rows: CsvValue[][];
    if (table === "people") {
      headers = ["Name", "Phone", "Email", "Relationship", "Birthday", "Groups", "Favorite", "Reach out every (days)", "Reminder time", "Usual way", "Last reached out", "Next due", "Archived", "Added"];
      rows = data.people.map((p) => [p.name, p.phone, p.email, p.relationship, p.birthday, p.groups.join("; "), p.favorite ? "yes" : "", p.reachOutEveryDays, p.reminderTime, p.usualWay, p.lastReachedOut, p.nextDue, p.archived ? "yes" : "", p.addedAt.slice(0, 10)]);
    } else if (table === "notes") {
      headers = ["Person", "Note", "Pinned", "Follow up on", "Follow-up done", "Written"];
      rows = data.people.flatMap((p) => p.notes.map((n) => [p.name, n.text, n.pinned ? "yes" : "", n.followUpOn, n.followUpDone ? "yes" : "", n.writtenAt.slice(0, 10)]));
    } else if (table === "reach-outs") {
      headers = ["Person", "Day", "How", "Summary"];
      rows = data.people.flatMap((p) => p.reachOuts.map((r) => [p.name, r.day, r.how, r.summary]));
    } else {
      headers = ["Prayer", "Details", "For", "Kind", "Status", "Times prayed", "Last prayed", "Added"];
      rows = data.prayers.map((i) => [i.title, i.details, i.for, i.kind, i.status, i.prayedOn.length, i.prayedOn.at(-1) ?? "", i.addedAt.slice(0, 10)]);
    }
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${BRAND.slug}-${table}-${stamp(data)}.csv"`)
      .send(toCsv(headers, rows));
  });
}
