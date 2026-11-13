import type { FastifyInstance } from "fastify";
import { buildHome } from "../services/home";
import { buildWeeklyReview } from "../services/review";

export async function homeRoutes(app: FastifyInstance) {
  app.get("/home", { preHandler: app.authenticate }, async (request) =>
    buildHome(app.deps.prisma, request.auth.user.id, request.auth.today),
  );

  app.get("/review/weekly", { preHandler: app.authenticate }, async (request) =>
    buildWeeklyReview(app.deps.prisma, request.auth.user.id, request.auth.today),
  );
}
