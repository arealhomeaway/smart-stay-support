/**
 * Conservative near-duplicate detection for homeowner participation entries.
 *
 * This is a warning aid only. It never blocks, edits, merges or rejects an
 * entry: the homeowner always decides whether the work they are reporting is
 * genuinely new. It exists purely to catch an accidental double submission
 * (the same activity saved twice), so the match has to be tight.
 */

export type DuplicateCandidate = {
  entryDate: string;
  minutes: number;
  activity: string;
  activityCategory?: string | null;
  comments?: string | null;
};

export type ExistingEntry = {
  id: string;
  entry_date: string;
  minutes: number;
  activity: string | null;
  activity_category?: string | null;
  comments?: string | null;
  review_status?: string | null;
  superseded?: boolean;
};

/** Normalise free text so casing, punctuation and spacing do not hide a repeat. */
export function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Jaccard similarity over word sets — stable, cheap and easy to reason about. */
export function textSimilarity(a: string | null | undefined, b: string | null | undefined) {
  const left = new Set(normalizeText(a).split(" ").filter(Boolean));
  const right = new Set(normalizeText(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const w of left) if (right.has(w)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** Minutes count as "very similar" when they are within 10% (and at least 5 min apart tolerance). */
export function minutesAreSimilar(a: number, b: number) {
  const diff = Math.abs(a - b);
  if (diff === 0) return true;
  const tolerance = Math.max(5, Math.round(Math.max(a, b) * 0.1));
  return diff <= tolerance;
}

/**
 * Returns the most likely accidental duplicate, or null.
 *
 * Match requires ALL of:
 *  - the same activity date
 *  - the same or very similar duration
 *  - the same category when both entries record one
 *  - a strongly overlapping description (>= 0.8 word overlap), or an exact
 *    description match after normalisation
 *
 * Superseded entries are ignored: those have already been corrected.
 */
export function findPossibleDuplicate(
  candidate: DuplicateCandidate,
  existing: ExistingEntry[],
): ExistingEntry | null {
  const matches = existing.filter((e) => {
    if (e.superseded) return false;
    if (e.entry_date !== candidate.entryDate) return false;
    if (!minutesAreSimilar(candidate.minutes, e.minutes)) return false;
    const candCat = normalizeText(candidate.activityCategory);
    const exCat = normalizeText(e.activity_category);
    if (candCat && exCat && candCat !== exCat) return false;
    const sameActivity = normalizeText(candidate.activity) === normalizeText(e.activity);
    return sameActivity || textSimilarity(candidate.activity, e.activity) >= 0.8;
  });
  if (matches.length === 0) return null;
  // Prefer the closest duration, then the most recent by id ordering already
  // supplied by the caller (entries arrive newest first).
  return (
    matches
      .slice()
      .sort(
        (a, b) => Math.abs(a.minutes - candidate.minutes) - Math.abs(b.minutes - candidate.minutes),
      )[0] ?? null
  );
}
