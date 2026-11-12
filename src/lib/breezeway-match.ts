/**
 * Matching onboarding homes to Breezeway homes (Nov 12 build, B3). Pure and browser-safe.
 * A suggestion is the same street address only; an Admin confirms every match by hand.
 */
export function streetKey(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(
      /\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|circle|cir|boulevard|blvd|place|pl|terrace|ter|way|north|n|south|s|east|e|west|w)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export type BreezewayHome = { id: number; name: string | null; address: string | null; city: string | null; status: string | null };

/** Active Breezeway homes with the same street address that no other Resolve home holds. */
export function suggestBreezewayHomes(
  address: string | null | undefined,
  homes: readonly BreezewayHome[],
  takenIds: ReadonlySet<string>,
): BreezewayHome[] {
  const key = streetKey(address);
  if (!key) return [];
  return homes.filter(
    (h) => (h.status ?? "").toLowerCase() === "active" && !takenIds.has(String(h.id)) && streetKey(h.address) === key,
  );
}
