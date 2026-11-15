/**
 * Reads `limit` and `offset` from a query string, with a default and a ceiling, so no
 * request can ask the database for an unbounded list.
 */
export function pageOf(query: { limit?: string; offset?: string }, defaultLimit: number, maxLimit: number): { limit: number; offset: number } {
  const limit = Number.parseInt(query.limit ?? "", 10);
  const offset = Number.parseInt(query.offset ?? "", 10);
  return {
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, maxLimit) : defaultLimit,
    offset: Number.isFinite(offset) && offset > 0 ? Math.min(offset, 1_000_000) : 0,
  };
}
