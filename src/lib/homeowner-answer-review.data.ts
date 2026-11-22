/**
 * Browser reads and the one write for homeowner answers to review on My Tasks (Nov 22). Reviews are
 * read under the table's staff read rule; Reviewed goes only through the caller-authenticated
 * database action mark_homeowner_answer_reviewed, which re-checks who may review. Until the
 * staged table exists, the read reports "not available" so My homeowners keeps its old list.
 */
import { supabase } from "@/integrations/supabase/client";
import { isMissingDbObject } from "@/lib/ao-ui";
import type { AnswerReview } from "@/lib/homeowner-answer-review";

const db = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export type AnswerReviewData = { available: boolean; reviews: AnswerReview[]; names: Record<string, string> };

export async function loadAnswerReviews(propertyIds: string[]): Promise<AnswerReviewData> {
  const ids = [...new Set(propertyIds)].filter(Boolean);
  if (ids.length === 0) return { available: true, reviews: [], names: {} };
  const reviews: AnswerReview[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    for (let from = 0; ; from += 1000) {
      const r = await db
        .from("homeowner_answer_reviews")
        .select("item_key, answer_at, reviewed_by, reviewed_at")
        .in("property_id", ids.slice(i, i + 100))
        .order("reviewed_at", { ascending: false })
        .order("item_key")
        .range(from, from + 999);
      if (r.error) {
        if (isMissingDbObject(r.error)) return { available: false, reviews: [], names: {} };
        throw new Error("Homeowner answer reviews could not load.");
      }
      const page = (r.data ?? []) as { item_key: string; answer_at: string; reviewed_by: string | null; reviewed_at: string }[];
      reviews.push(...page.map((x) => ({ itemKey: x.item_key, answerAt: x.answer_at, reviewedBy: x.reviewed_by, reviewedAt: x.reviewed_at })));
      if (page.length < 1000) break;
    }
  }
  const people = [...new Set(reviews.map((r) => r.reviewedBy).filter((x): x is string => Boolean(x)))];
  const names: Record<string, string> = {};
  if (people.length) {
    const p = await db.from("profiles").select("id, full_name").in("id", people);
    for (const row of (p.data ?? []) as { id: string; full_name: string | null }[]) if (row.full_name) names[row.id] = row.full_name;
  }
  return { available: true, reviews, names };
}

export async function markAnswerReviewed(input: { propertyId: string; itemKey: string; answerAt: string }): Promise<void> {
  const { error } = await db.rpc("mark_homeowner_answer_reviewed", {
    _property_id: input.propertyId,
    _item_key: input.itemKey,
    _answer_at: input.answerAt,
  });
  if (error) throw new Error(error.message || "This could not be marked reviewed.");
}
