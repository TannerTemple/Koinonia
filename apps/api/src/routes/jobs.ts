import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { hashToken } from "../lib/crypto";
import { notFound, unauthorized } from "../lib/errors";
import { runDigest } from "../services/digest";

/**
 * Jobs an outside scheduler can trigger. Free hosts put the API to sleep, so the in-process
 * timer can't be relied on; a scheduled HTTP call wakes it and runs the digest instead.
 */
export async function jobRoutes(app: FastifyInstance) {
  const { prisma, providers, env, now } = app.deps;

  app.post("/jobs/digest", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (request) => {
    // Without a configured secret the endpoint behaves as if it didn't exist.
    if (!env.CRON_SECRET) throw notFound("That endpoint");
    const given = request.headers["x-cron-secret"];
    // Compare hashes so the comparison takes the same time whatever was sent.
    const a = Buffer.from(hashToken(typeof given === "string" ? given : ""));
    const b = Buffer.from(hashToken(env.CRON_SECRET));
    if (!timingSafeEqual(a, b)) throw unauthorized("Wrong or missing cron secret.");
    return runDigest({ prisma, providers, env }, now());
  });
}
