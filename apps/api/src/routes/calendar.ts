import type { FastifyInstance } from "fastify";
import { addDays, cadenceLabel, dayInTimezone, nextBirthday, type CalendarFeed } from "@koinonia/shared";
import { hashToken, newToken } from "../lib/crypto";
import { notFound } from "../lib/errors";
import { toContact } from "../lib/serialize";

const escapeText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (day: string) => day.replace(/-/g, "");

function event(uid: string, day: string, summary: string, description: string, stamp: string) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@koinonia`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(day)}`,
    `DTEND;VALUE=DATE:${compact(addDays(day, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

/**
 * A private calendar feed (.ics) of upcoming reach-outs, follow-ups and birthdays that
 * Apple Calendar / Google Calendar can subscribe to. The URL contains a secret token.
 */
export async function calendarRoutes(app: FastifyInstance) {
  const { prisma, env, now } = app.deps;

  const feedUrl = (token: string, origin: string) =>
    `${(env.API_PUBLIC_URL ?? origin).replace(/\/+$/, "")}/v1/calendar/${token}.ics`;

  /** Whether a feed exists. The link itself can't be shown again: only its hash is stored. */
  app.get("/me/calendar-feed", { preHandler: app.authenticate }, async (request): Promise<CalendarFeed> => {
    return { active: request.auth.user.calendarTokenHash !== null, url: null };
  });

  /** Makes a new link (shown this once) and turns off any earlier one. */
  app.post("/me/calendar-feed", { preHandler: app.authenticate }, async (request): Promise<CalendarFeed> => {
    const token = newToken();
    await prisma.user.update({ where: { id: request.auth.user.id }, data: { calendarTokenHash: hashToken(token) } });
    return { active: true, url: feedUrl(token, `${request.protocol}://${request.host}`) };
  });

  /** Turns the feed off. */
  app.delete("/me/calendar-feed", { preHandler: app.authenticate }, async (request, reply) => {
    await prisma.user.update({ where: { id: request.auth.user.id }, data: { calendarTokenHash: null } });
    return reply.status(204).send();
  });

  app.get<{ Params: { file: string } }>("/calendar/:file", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request, reply) => {
    const token = request.params.file.replace(/\.ics$/, "");
    const user = token ? await prisma.user.findUnique({ where: { calendarTokenHash: hashToken(token) } }) : null;
    if (!user || user.disabledAt) throw notFound("That calendar");

    const today = dayInTimezone(now(), user.timezone);
    const stamp = now().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const [contacts, notes] = await Promise.all([
      prisma.contact.findMany({ where: { userId: user.id, archivedAt: null } }),
      prisma.note.findMany({
        where: { userId: user.id, followUpDone: false, followUpDay: { not: null }, contact: { archivedAt: null } },
        include: { contact: { select: { name: true } } },
      }),
    ]);

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Koinonia//Reach-outs//EN",
      "CALSCALE:GREGORIAN",
      "X-WR-CALNAME:Koinonia",
      "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    ];
    for (const row of contacts) {
      const c = toContact(row);
      if (c.dueDay) {
        // Overdue reach-outs show up today rather than disappearing into the past.
        const day = c.dueDay < today ? today : c.dueDay;
        lines.push(...event(`due-${c.id}`, day, `Reach out to ${c.name}`, cadenceLabel(c.cadenceDays), stamp));
      }
      const birthday = c.birthday ? nextBirthday(c.birthday, today) : null;
      if (birthday) lines.push(...event(`bday-${c.id}`, birthday, `${c.name}'s birthday`, "", stamp));
    }
    for (const n of notes) {
      const day = n.followUpDay! < today ? today : n.followUpDay!;
      lines.push(...event(`note-${n.id}`, day, `Follow up with ${n.contact.name}`, n.body, stamp));
    }
    lines.push("END:VCALENDAR");

    return reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Cache-Control", "private, max-age=900")
      .send(lines.join("\r\n") + "\r\n");
  });
}
