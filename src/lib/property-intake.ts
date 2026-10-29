/** Browser-safe shapes for the two property entry paths. */

export type IntakeMatch = {
  id: string;
  name: string;
  address: string | null;
  lifecycleStatus: string;
  ownerRezId: string | null;
  isDemo: boolean;
};

export type OwnerRezCandidate = {
  listingId: string;
  name: string;
  address: string | null;
  city: string | null;
  unit?: string | null;
  state: string | null;
  postalCode: string | null;
  /** Already in Resolve on the OwnerRez ID — importing is blocked. */
  existing: IntakeMatch | null;
  /** Same name/address but no OwnerRez ID yet — offer to link instead. */
  likely: IntakeMatch | null;
};

export type IntakeResult =
  | { status: "duplicate"; property: IntakeMatch }
  | { status: "linked"; property: IntakeMatch }
  | { status: "created"; property: IntakeMatch };

/** Lowercase, punctuation to spaces, collapse spaces. Shared by search and tests. */
export function normalizeListingText(v: string | number | null | undefined): string {
  return String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Max matches sent to the screen; applied only AFTER filtering. */
export const LISTING_MATCH_LIMIT = 60;

/** True when every word typed appears in the listing's searchable text. */
export function listingMatches(fields: (string | number | null | undefined)[], query: string): boolean {
  const q = normalizeListingText(query);
  if (!q) return false;
  const hay = ` ${fields.map(normalizeListingText).filter(Boolean).join(" ")} `;
  const compact = hay.replace(/ /g, "");
  return q.split(" ").every((w) => hay.includes(w)) || compact.includes(q.replace(/ /g, ""));
}

/** Filter first, then limit. Empty query returns nothing (the screen shows a hint). */
export function filterListings<T>(
  items: T[],
  fields: (item: T) => (string | number | null | undefined)[],
  query: string,
  limit = LISTING_MATCH_LIMIT,
): { items: T[]; total: number; truncated: boolean } {
  const matched = items.filter((i) => listingMatches(fields(i), query));
  return { items: matched.slice(0, limit), total: matched.length, truncated: matched.length > limit };
}
