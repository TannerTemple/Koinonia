import type { FastifyInstance } from "fastify";
import { BRAND, feedbackSchema, FEEDBACK_KIND_LABELS, type AdminFeedback } from "@koinonia/shared";
import { parse } from "../lib/errors";
import { safeError } from "../lib/log";
import { pageOf } from "../lib/page";

/**
 * "Send feedback / report a problem". Every message is saved, so nothing is lost while email
 * is still mocked; when FEEDBACK_EMAIL is set a copy is emailed there too. The log line says
 * that feedback arrived and from which app version, never what it says or who wrote it.
 */
export async function feedbackRoutes(app: FastifyInstance) {
  const { prisma, providers, env } = app.deps;

  // A person, not a script: a handful an hour is plenty.
  const limit = { config: { rateLimit: { max: 10, timeWindow: "1 hour" } } };

  app.post("/feedback", { preHandler: app.authenticate, ...limit }, async (request, reply) => {
    const input = parse(feedbackSchema, request.body);
    const user = request.auth.user;
    const row = await prisma.feedback.create({
      data: { userId: user.id, kind: input.kind, message: input.message, appVersion: input.appVersion, platform: input.platform },
    });
    request.log.info({ feedbackId: row.id, kind: row.kind, platform: row.platform, appVersion: row.appVersion }, "feedback received");

    if (env.FEEDBACK_EMAIL) {
      const send = providers.email
        .send({
          to: env.FEEDBACK_EMAIL,
          subject: `${BRAND.name} feedback: ${FEEDBACK_KIND_LABELS[input.kind]} (${input.platform} ${input.appVersion})`,
          text: [
            input.message,
            "",
            "--",
            `From: ${user.name} <${user.email}>`,
            `App: ${input.platform} ${input.appVersion}`,
            `Sent: ${row.createdAt.toISOString()}`,
            `Also saved under Admin > Feedback in the web app.`,
          ].join("\n"),
        })
        .catch((err: unknown) => request.log.error({ err: safeError(err) }, "feedback email failed"));
      app.background.track(send);
    }
    return reply.code(201).send({ id: row.id });
  });

  app.get<{ Querystring: { limit?: string; offset?: string } }>("/admin/feedback", { preHandler: app.requireAdmin }, async (request, reply): Promise<AdminFeedback[]> => {
    const { limit: take, offset } = pageOf(request.query, 50, 200);
    const [rows, total] = await Promise.all([
      prisma.feedback.findMany({ include: { user: { select: { name: true, email: true } } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take, skip: offset }),
      prisma.feedback.count(),
    ]);
    reply.header("X-Total-Count", String(total));
    return rows.map((f) => ({
      id: f.id,
      kind: f.kind as AdminFeedback["kind"],
      message: f.message,
      appVersion: f.appVersion,
      platform: f.platform,
      createdAt: f.createdAt.toISOString(),
      userName: f.user.name,
      userEmail: f.user.email,
    }));
  });
}
