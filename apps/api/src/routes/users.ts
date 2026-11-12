import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { normalizePhone, type UserSearchResult } from "@koinonia/shared";

/**
 * Find other Koinonia members to add as contacts. Name search returns names only;
 * email / phone are echoed back only when the searcher already typed them exactly.
 */
export async function userRoutes(app: FastifyInstance) {
  const { prisma } = app.deps;

  app.get<{ Querystring: { q?: string } }>(
    "/users/search",
    { preHandler: app.authenticate, config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request): Promise<UserSearchResult[]> => {
      const q = (request.query.q ?? "").trim().slice(0, 100);
      if (q.length < 2) return [];
      const me = request.auth.user.id;

      let matchedBy: UserSearchResult["matchedBy"] = "name";
      let match: Prisma.UserWhereInput;
      const digits = q.replace(/\D/g, "");
      if (q.includes("@")) {
        matchedBy = "email";
        match = { email: q.toLowerCase() };
      } else if (digits.length >= 7 && /^[\d\s()+.-]+$/.test(q)) {
        matchedBy = "phone";
        // Exact number only. A full 10-digit number also matches with or without a country
        // code; a shorter fragment never matches, so numbers can't be fished out by suffix.
        match = {
          OR: [
            { phone: normalizePhone(q) },
            ...(digits.length >= 10 ? [{ phone: { endsWith: digits.slice(-10) } }] : []),
          ],
        };
      } else {
        match = { name: { contains: q, mode: "insensitive" } };
      }

      const users = await prisma.user.findMany({
        where: { AND: [match, { discoverable: true, disabledAt: null, NOT: { id: me } }] },
        orderBy: { name: "asc" },
        take: 10,
      });
      const linked = await prisma.contact.findMany({
        where: { userId: me, linkedUserId: { in: users.map((u) => u.id) } },
        select: { linkedUserId: true },
      });
      const linkedIds = new Set(linked.map((c) => c.linkedUserId));

      return users.map((u) => ({
        id: u.id,
        name: u.name,
        matchedBy,
        email: matchedBy === "email" ? u.email : null,
        phone: matchedBy === "phone" ? u.phone : null,
        alreadyContact: linkedIds.has(u.id),
      }));
    },
  );
}
