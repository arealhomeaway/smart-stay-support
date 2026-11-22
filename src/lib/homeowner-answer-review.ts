/**
 * Homeowner answers to review on My Tasks, under My homeowners (Admin, Nov 22). Pure and
 * browser-safe. The answers come from the existing homeowner status reading
 * (src/lib/homeowner-status.ts); the reviews are append-only rows in homeowner_answer_reviews,
 * written only by the database action mark_homeowner_answer_reviewed. An answer counts as
 * reviewed only while a review covers its latest answer time, so a newer answer from the
 * homeowner brings it back to the review list. No card, Task, notice or permission rule here.
 */
import { allAnswerRows, type HomeownerStatusData, type StatusRow } from "@/lib/homeowner-status";

export const ANSWER_REVIEW_COPY = {
  toReview: "Homeowner answers to review",
  none: "No homeowner answers to review.",
  reviewed: "Reviewed",
  button: "Reviewed",
  saving: "Saving...",
  failed: "This could not be marked reviewed. Try again.",
} as const;

export type AnswerReview = { itemKey: string; answerAt: string; reviewedBy: string | null; reviewedAt: string };

export type AnswerRow = StatusRow & {
  /** The item the answer is on: card:, review:, approval: or update: and its id. */
  itemKey: string;
  /** The newest time the homeowner answered or changed this item. */
  answerAt: string;
};

const ms = (at: string | null | undefined) => (at ? Date.parse(at) : Number.NaN);
const later = (a: string | null | undefined, b: string | null | undefined): string => {
  const x = ms(a);
  const y = ms(b);
  if (Number.isNaN(x)) return b ?? "";
  if (Number.isNaN(y)) return a ?? "";
  return y > x ? (b as string) : (a as string);
};

/** The item a homeowner change belongs to, when it is an answer already listed (a card or an owner item). */
function updateItemKey(kind: string | undefined, itemId: string | undefined): string | null {
  if (!itemId) return null;
  if (kind === "card") return `card:${itemId}`;
  if (kind === "owner_item") return `review:${itemId}`;
  return null;
}

/**
 * Every answer on these homes, newest first. A change the homeowner made later to a listed card or
 * owner item moves that answer's time forward (so it returns for review) instead of adding a row.
 */
export function answerRows(data: HomeownerStatusData, homes: ReadonlySet<string>, now: Date): AnswerRow[] {
  const rows = allAnswerRows(data, homes, now);
  const cards = new Map(data.cards.map((c) => [c.id, c]));
  const reviews = new Map(data.reviews.map((r) => [r.id, r]));
  const updates = data.updates ?? [];
  const folded = new Map<string, string>();
  const foldedIds = new Set<string>();
  const listed = new Set(rows.map((r) => r.key));
  for (const u of updates) {
    const key = updateItemKey(u.kind, u.itemId);
    if (!key || !listed.has(key)) continue;
    folded.set(key, later(folded.get(key), u.at));
    foldedIds.add(`update:${u.id}`);
  }
  const out: AnswerRow[] = [];
  for (const r of rows) {
    if (foldedIds.has(r.key)) continue;
    const [kind, id = ""] = r.key.split(":");
    let at = r.at;
    if (kind === "card") {
      const c = cards.get(id);
      at = later(c?.ownerCompletedAt ?? r.at, c?.submission?.submittedAt);
    } else if (kind === "review") {
      at = later(r.at, reviews.get(id)?.ownerAnsweredAt);
    }
    at = later(at, folded.get(r.key));
    out.push({ ...r, itemKey: r.key, answerAt: at, at });
  }
  return out.sort((x, y) => y.answerAt.localeCompare(x.answerAt) || x.title.localeCompare(y.title));
}

/** The newest review that covers this answer's latest time, or null when it still needs review. */
export function reviewFor(row: Pick<AnswerRow, "itemKey" | "answerAt">, reviews: readonly AnswerReview[]): AnswerReview | null {
  const answered = ms(row.answerAt);
  const covering = reviews
    .filter((r) => r.itemKey === row.itemKey && !Number.isNaN(ms(r.answerAt)) && (Number.isNaN(answered) || ms(r.answerAt) >= answered))
    .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
  return covering[0] ?? null;
}

/** To review: answers no review covers yet. Reviewed: the rest, each with who reviewed it and when. */
export function splitAnswers(rows: readonly AnswerRow[], reviews: readonly AnswerReview[]) {
  const toReview: AnswerRow[] = [];
  const reviewed: (AnswerRow & { review: AnswerReview })[] = [];
  for (const r of rows) {
    const review = reviewFor(r, reviews);
    if (review) reviewed.push({ ...r, review });
    else toReview.push(r);
  }
  reviewed.sort((a, b) => b.review.reviewedAt.localeCompare(a.review.reviewedAt));
  return { toReview, reviewed };
}

/** Who may press Reviewed on a home: its assigned Project Manager; the Director of Onboarding and Admin cover. */
export function canReviewAnswers(input: {
  userId: string | null | undefined;
  projectManager: string | null | undefined;
  isOnboardingDirector: boolean;
  isAdmin: boolean;
}): boolean {
  if (!input.userId) return false;
  return input.projectManager === input.userId || input.isOnboardingDirector || input.isAdmin;
}

/** "Reviewed by [name] on 11/22/2026 9:05 AM Central". */
export function reviewedLine(name: string | null | undefined, reviewedAt: string): string {
  const t = new Date(reviewedAt);
  const when = Number.isNaN(t.getTime())
    ? ""
    : ` on ${t.toLocaleString("en-US", { timeZone: "America/Chicago", month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).replace(",", "")} Central`;
  return `Reviewed by ${name?.trim() || "our team"}${when}`;
}
