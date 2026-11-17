import type { FastifyInstance } from "fastify";
import { featuresFrom, type PublicConfig } from "@koinonia/shared";
import { buildHome } from "../services/home";
import { buildWeeklyReview } from "../services/review";

export async function homeRoutes(app: FastifyInstance) {
  const { features } = featuresFrom(app.deps.env.FEATURES_OFF);
  app.get("/home", { preHandler: app.authenticate }, async (request) =>
    buildHome(app.deps.prisma, request.auth.user.id, request.auth.today, features),
  );

  // Public, and nothing secret: which optional features are on, so the sign-in screen can
  // decide whether to greet someone by name before they are signed in.
  app.get("/config", async (): Promise<PublicConfig> => ({ features }));

  app.get("/review/weekly", { preHandler: app.authenticate }, async (request) =>
    buildWeeklyReview(app.deps.prisma, request.auth.user.id, request.auth.today),
  );
}
