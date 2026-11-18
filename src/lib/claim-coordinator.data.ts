/**
 * Claims Coordinator view reads and writes (browser, caller's own access).
 * Line items and the platform log need the staged claims-coordinator-view package;
 * until it is applied they read as "not switched on yet" instead of failing.
 */
import { supabase } from "@/integrations/supabase/client";
import { isMissingDbObject } from "@/lib/ao-ui";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
export const NOT_ON_YET = "This is not switched on yet.";

export type LineItemRow = { id: string; issue: string; amount_requested: number; created_at: string };
export type PlatformLogRow = { id: string; entry_on: string; author_id: string; platform_said: string; we_did: string | null; created_at: string };
export type Loaded<T> = { available: boolean; rows: T[] };

function fail(e: { message?: string } | null): never {
  if (isMissingDbObject(e)) throw new Error(NOT_ON_YET);
  throw new Error(e?.message ?? "Not saved. Try again.");
}

export async function loadLineItems(claimId: string): Promise<Loaded<LineItemRow>> {
  const r = await db.from("claim_line_items").select("id, issue, amount_requested, created_at").eq("claim_id", claimId).is("archived_at", null).order("created_at");
  if (r.error) { if (isMissingDbObject(r.error)) return { available: false, rows: [] }; throw new Error("Line items could not load."); }
  return { available: true, rows: (r.data ?? []).map((x: LineItemRow) => ({ ...x, amount_requested: Number(x.amount_requested) })) };
}
export async function addLineItem(claimId: string, userId: string, issue: string, amount: number) {
  const r = await db.from("claim_line_items").insert({ claim_id: claimId, issue, amount_requested: amount, created_by: userId });
  if (r.error) fail(r.error);
}
export async function changeLineItem(id: string, patch: { issue?: string; amount_requested?: number; archived_at?: string }) {
  const r = await db.from("claim_line_items").update(patch).eq("id", id);
  if (r.error) fail(r.error);
}

export async function loadPlatformLog(claimId: string): Promise<Loaded<PlatformLogRow>> {
  const r = await db.from("claim_platform_log").select("id, entry_on, author_id, platform_said, we_did, created_at").eq("claim_id", claimId).order("entry_on", { ascending: false }).order("created_at", { ascending: false });
  if (r.error) { if (isMissingDbObject(r.error)) return { available: false, rows: [] }; throw new Error("The platform log could not load."); }
  return { available: true, rows: r.data ?? [] };
}
export async function addPlatformLog(claimId: string, userId: string, entry: { entry_on: string; platform_said: string; we_did: string | null }) {
  const r = await db.from("claim_platform_log").insert({ claim_id: claimId, author_id: userId, ...entry });
  if (r.error) fail(r.error);
}

export type ReportedIssues = { comments: { id: string; author: string | null; body: string | null; at: string | null }[]; photos: { id: string; url: string | null; caption: string | null }[] };
/** Breezeway comments and photos of the clean review's work order, read live (never copied or written). */
export async function loadReportedFromBreezeway(departureReviewId: string | null): Promise<ReportedIssues> {
  if (!departureReviewId) return { comments: [], photos: [] };
  const dr = await db.from("departure_reviews").select("breezeway_work_order_id").eq("id", departureReviewId).maybeSingle();
  const wo = dr.data?.breezeway_work_order_id as string | undefined;
  if (dr.error || !wo) return { comments: [], photos: [] };
  const [c, p] = await Promise.all([
    db.from("breezeway_work_order_comments").select("id, author, body, commented_at").eq("work_order_id", wo).order("commented_at"),
    db.from("breezeway_work_order_photos").select("id, url, caption").eq("work_order_id", wo).limit(24),
  ]);
  return {
    comments: (c.data ?? []).map((x: { id: string; author: string | null; body: string | null; commented_at: string | null }) => ({ id: x.id, author: x.author, body: x.body, at: x.commented_at })),
    photos: p.data ?? [],
  };
}
