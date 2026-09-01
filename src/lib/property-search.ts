/**
 * Candidate-property search ranking.
 *
 * Typing "hou" should not bury the right home under every property whose name
 * ends in "House". The database still does a cheap contains-match; the ordering
 * happens here so the most specific match a coordinator could have meant comes
 * first. Deliberately simple — a lexical score, not a recommendation engine.
 */

export type PropertySearchRow = {
  id: string;
  name: string | null;
  nickname: string | null;
  address_line1: string | null;
  city: string | null;
  market: string | null;
  neighborhood: string | null;
  ownerrez_property_id: string | null;
  bedrooms?: number | null;
  lifecycle_status?: string | null;
};

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * Higher is better. Tiers follow the agreed priority: exact name, name
 * starts-with, address, city/market, neighborhood, OwnerRez id, then contains.
 */
export function scoreProperty(query: string, row: PropertySearchRow): number {
  const q = norm(query);
  if (!q) return 0;
  const names = [norm(row.name), norm(row.nickname)].filter(Boolean);
  const address = norm(row.address_line1);
  const city = norm(row.city);
  const market = norm(row.market);
  const hood = norm(row.neighborhood);
  const orid = norm(row.ownerrez_property_id);

  let score = 0;
  if (names.some((n) => n === q)) score = Math.max(score, 100);
  if (names.some((n) => n.startsWith(q))) score = Math.max(score, 90);
  if (names.some((n) => n.split(/\s+/).some((w) => w.startsWith(q)))) score = Math.max(score, 70);
  if (address && (address === q || address.startsWith(q))) score = Math.max(score, 80);
  if (address.includes(q)) score = Math.max(score, 60);
  if (city === q || market === q) score = Math.max(score, 55);
  if (city.startsWith(q) || market.startsWith(q)) score = Math.max(score, 50);
  if (hood === q) score = Math.max(score, 45);
  if (hood.startsWith(q)) score = Math.max(score, 40);
  if (orid && (orid === q || orid.startsWith(q))) score = Math.max(score, 85);
  if (score === 0 && names.some((n) => n.includes(q))) score = 20;
  if (score === 0 && [city, market, hood, orid].some((v) => v.includes(q))) score = 10;
  return score;
}

/** Ranked, de-duplicated matches — best first, stable by name for ties. */
export function rankProperties<T extends PropertySearchRow>(query: string, rows: T[], limit = 8): T[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    .map((r) => ({ r, s: scoreProperty(query, r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || norm(a.r.nickname ?? a.r.name).localeCompare(norm(b.r.nickname ?? b.r.name)))
    .slice(0, limit)
    .map((x) => x.r);
}
