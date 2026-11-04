import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { nightlyReviewSyncDue, reviewSyncSince } from "./review-sync";

type Admin = SupabaseClient<Database>;
export const REVIEW_SYNC_SYSTEM = "ownerrez_reviews";
export const REVIEW_SYNC_OPERATION = "nightly_sync";

/**
 * Nightly OwnerRez review import, run from the five-minute job but only
 * once per night (2 a.m. Central hour). Every run is recorded in
 * integration_events so staff can see results, failures and unmatched reviews.
 */
export async function runNightlyReviewSync(admin: Admin, now = new Date()) {
  const { data: recent } = await admin
    .from("integration_events")
    .select("status, created_at")
    .eq("system", REVIEW_SYNC_SYSTEM)
    .eq("operation", REVIEW_SYNC_OPERATION)
    .order("created_at", { ascending: false })
    .limit(20);
  const runs = recent ?? [];
  if (!nightlyReviewSyncDue(now, runs[0]?.created_at ?? null)) return { skipped: true };
  const lastOk = runs.find((r) => r.status === "completed")?.created_at ?? null;
  const since = reviewSyncSince(now, lastOk);

  const { data: run, error: runErr } = await admin
    .from("integration_events")
    .insert({ system: REVIEW_SYNC_SYSTEM, direction: "inbound", operation: REVIEW_SYNC_OPERATION, status: "processing", request_payload: { since } })
    .select("id")
    .single();
  if (runErr) throw new Error(`Could not record review import run: ${runErr.message}`);

  try {
    const gf = await import("./guest-feedback.server");
    const items = await gf.fetchOwnerRezReviews(admin, 60, since);
    const result = await gf.ingestReviews(admin, items);
    const ids = items.map((i) => i.source_review_id);
    const unmatched: { source_review_id: string; ownerrez_property_id: string | null; reason: string }[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await admin
        .from("guest_feedback")
        .select("source_review_id, property_id, ownerrez_booking_id")
        .eq("source", "ownerrez")
        .in("source_review_id", ids.slice(i, i + 200));
      for (const row of data ?? []) {
        const src = items.find((x) => x.source_review_id === row.source_review_id);
        if (!row.property_id) unmatched.push({ source_review_id: row.source_review_id!, ownerrez_property_id: src?.ownerrez_property_id ?? null, reason: "No Resolve home has this OwnerRez property ID" });
        else if (!row.ownerrez_booking_id) unmatched.push({ source_review_id: row.source_review_id!, ownerrez_property_id: src?.ownerrez_property_id ?? null, reason: "OwnerRez gave no reservation ID" });
      }
    }
    await admin.from("integration_events").update({
      status: "completed",
      request_payload: { since, fetched: items.length, ...result, unmatched },
    }).eq("id", run.id);
    return { skipped: false, ...result, unmatched: unmatched.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("integration_events").update({ status: "failed", error_message: message }).eq("id", run.id);
    throw e;
  }
}
