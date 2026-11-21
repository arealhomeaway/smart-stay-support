/**
 * Homeowner hours: double save guard and the "Update that one instead?" prompt (Admin, Nov 21).
 * Pure rules (browser-safe, tested). The server refuses a repeat saved in the last 10 minutes with
 * "Already saved." (docs/pending/hours-double-save); the prompt below is only a question and never
 * blocks saving.
 */
import { normalizeText, textSimilarity } from "@/lib/owner-duplicate";

export const HOURS_REPEAT_COPY = {
  saving: "Saving...",
  alreadySaved: "Already saved.",
  update: "Update",
  isNew: "No, this is new",
} as const;

/** The server's double save answer. What she typed stays on screen. */
export function isAlreadySaved(error: unknown): boolean {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.trim() === HOURS_REPEAT_COPY.alreadySaved;
}

export type RepeatCandidate = {
  entryDate: string;
  activity: string;
  /** The opportunity she is logging against, or null for her own activity. */
  reviewId: string | null;
};

export type RepeatEntry = {
  id: string;
  entry_date: string;
  activity: string | null;
  review_id?: string | null;
  owner_user_id?: string | null;
  superseded?: boolean;
  created_at?: string | null;
};

/** Similar wording: the same words, one description inside the other, or at least half the words shared. */
export function similarDescription(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  if (shorter.length >= 8 && longer.includes(shorter)) return true;
  return textSimilarity(left, right) >= 0.5;
}

/**
 * One of her own current entries (not replaced) on the same date with a similar description or the
 * same opportunity, newest saved first; or null.
 */
export function findRepeatEntry<T extends RepeatEntry>(candidate: RepeatCandidate, entries: T[], userId: string | null): T | null {
  if (!userId || !candidate.entryDate || candidate.activity.trim().length < 3) return null;
  const matches = entries.filter((e) => {
    if (e.superseded || e.owner_user_id !== userId || e.entry_date !== candidate.entryDate) return false;
    const sameOpportunity = Boolean(candidate.reviewId) && e.review_id === candidate.reviewId;
    return sameOpportunity || similarDescription(candidate.activity, e.activity);
  });
  matches.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  return matches[0] ?? null;
}

/** The question shown before saving. */
export function repeatQuestion(title: string, dateLabel: string): string {
  const name = title.trim().length > 80 ? `${title.trim().slice(0, 79)}…` : title.trim();
  return `You already logged ${name} on ${dateLabel}. Update that one instead?`;
}
