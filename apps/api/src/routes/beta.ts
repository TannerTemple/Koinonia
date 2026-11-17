import type { FastifyInstance } from "fastify";
import { betaSignupSchema, type AdminBetaSignup } from "@koinonia/shared";
import { notFound, parse } from "../lib/errors";

/**
 * The public "ask for a TestFlight invite" form. Anyone can post to it, so it is tightly
 * rate-limited, stores only what was typed plus the moment of consent, and answers the same
 * way whether or not the email was already on the list.
 */
export async function betaRoutes(app: FastifyInstance) {
  const { prisma, now } = app.deps;

  app.post("/beta/signup", { config: { rateLimit: { max: 5, timeWindow: "1 hour" } } }, async (request, reply) => {
    const input = parse(betaSignupSchema, request.body);
    await prisma.betaSignup.upsert({
      where: { email: input.email },
      // Asking twice changes nothing but the details they gave.
      update: { name: input.name || undefined, device: input.device },
      create: { email: input.email, name: input.name || null, device: input.device, consentAt: now() },
    });
    request.log.info({ device: input.device }, "beta signup");
    return reply.code(201).send({ ok: true });
  });

  app.get("/admin/beta-signups", { preHandler: app.requireAdmin }, async (): Promise<AdminBetaSignup[]> => {
    const rows = await prisma.betaSignup.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 1000 });
    return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, device: r.device as AdminBetaSignup["device"], createdAt: r.createdAt.toISOString() }));
  });

  // "Please take me off the list."
  app.delete<{ Params: { id: string } }>("/admin/beta-signups/:id", { preHandler: app.requireAdmin }, async (request, reply) => {
    const gone = await prisma.betaSignup.deleteMany({ where: { id: request.params.id } });
    if (gone.count === 0) throw notFound("That sign-up");
    return reply.code(204).send();
  });
}
