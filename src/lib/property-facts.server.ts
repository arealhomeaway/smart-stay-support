import { listingDetail, propertyDetail } from "./ownerrez.server";
import { factsFromOwnerRez, unknownFacts, type PropertyFacts } from "./property-facts";

export type FactsRead = {
  facts: PropertyFacts;
  /** Set when OwnerRez could not be read; the facts are then all unknown. */
  unavailableReason: string | null;
};

/**
 * Reads the two verified OwnerRez sources for one home.
 * A read failure never becomes a "no" — it becomes unknown, which filters hide.
 */
export async function ownerRezFacts(ownerRezPropertyId: string): Promise<FactsRead> {
  try {
    const [property, listing] = await Promise.all([
      propertyDetail(ownerRezPropertyId),
      listingDetail(ownerRezPropertyId).catch(() => null),
    ]);
    return { facts: factsFromOwnerRez(property.max_pets ?? null, listing), unavailableReason: null };
  } catch (error) {
    console.error(`OwnerRez facts unavailable for property ${ownerRezPropertyId}:`, error);
    return {
      facts: unknownFacts(),
      unavailableReason: "OwnerRez details could not be read for this home.",
    };
  }
}

/** Reads facts for many homes with bounded concurrency. */
export async function ownerRezFactsFor(
  entries: { id: string; ownerRezPropertyId: string }[],
  batchSize = 5,
): Promise<Map<string, FactsRead>> {
  const out = new Map<string, FactsRead>();
  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);
    const reads = await Promise.all(batch.map((entry) => ownerRezFacts(entry.ownerRezPropertyId)));
    batch.forEach((entry, index) => out.set(entry.id, reads[index]!));
  }
  return out;
}
