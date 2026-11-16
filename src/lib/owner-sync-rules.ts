/**
 * OwnerRez owner sync rules. Pure, browser-safe, unit-tested.
 *
 * 1. One key per OwnerRez owner: "ownerrez:150924525" and "150924525" are the
 *    same owner. Records are matched on the bare number, and the bare number is
 *    the only format written.
 * 2. A home in a current Active Owner program never moves to a different owner
 *    record. When OwnerRez names someone else, the link is kept and an Admin is
 *    flagged instead.
 */
const PREFIX = "ownerrez:";

/** The one stored format for an OwnerRez owner id: the bare id, no prefix. */
export function ownerRezOwnerKey(sourceOwnerId: string | number): string {
  const s = String(sourceOwnerId).trim();
  return s.toLowerCase().startsWith(PREFIX) ? s.slice(PREFIX.length).trim() : s;
}

export type StoredOwner = { id: string; source_owner_id: string };

export type OwnerKeyPlan = {
  /** Bare key to the one record that holds it. */
  idByKey: Map<string, string>;
  /** Older records still stored with the prefix, renamed to the bare key before saving. */
  renames: { id: string; from: string; to: string }[];
  /** Keys held by more than one record. Never saved or linked until merged. */
  duplicateKeys: Set<string>;
};

/** Match existing OwnerRez owner records whether or not their id carries the prefix. */
export function planOwnerKeys(existing: StoredOwner[]): OwnerKeyPlan {
  const byKey = new Map<string, StoredOwner[]>();
  for (const row of existing) {
    const key = ownerRezOwnerKey(row.source_owner_id);
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  const idByKey = new Map<string, string>();
  const renames: OwnerKeyPlan["renames"] = [];
  const duplicateKeys = new Set<string>();
  for (const [key, rows] of byKey) {
    if (rows.length > 1) {
      duplicateKeys.add(key);
      continue;
    }
    const row = rows[0]!;
    idByKey.set(key, row.id);
    if (row.source_owner_id !== key) renames.push({ id: row.id, from: row.source_owner_id, to: key });
  }
  return { idByKey, renames, duplicateKeys };
}

export type OwnerLinkDecision =
  | { action: "link"; ownerRecordId: string }
  | { action: "keep"; reason: "program" | "duplicate" | "unknown" };

/**
 * Whether the sync may point a home at the owner record OwnerRez names.
 * programOwnerId is the owner record of the home's current Active Owner program, if any.
 */
export function decideOwnerLink(input: {
  targetOwnerId: string | null;
  programOwnerId: string | null;
  duplicate: boolean;
}): OwnerLinkDecision {
  if (input.duplicate) return { action: "keep", reason: "duplicate" };
  if (!input.targetOwnerId) return { action: "keep", reason: "unknown" };
  if (input.programOwnerId && input.programOwnerId !== input.targetOwnerId) return { action: "keep", reason: "program" };
  return { action: "link", ownerRecordId: input.targetOwnerId };
}

/** The note an Admin sees on the home when OwnerRez names a different owner for a program home. */
export const PROGRAM_OWNER_HELD_NOTE =
  "OwnerRez lists a different owner for this home. The home stays with its Active Owner program's owner. An Admin should check it.";
