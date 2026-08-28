/**
 * Bounded recovery for Breezeway task webhook lookup failures (server-only).
 *
 * A `verify_failed` event means the authenticated re-read that decides
 * company/property membership failed or found nothing — the event was never
 * processed. Some of those failures are transient (Breezeway 429/5xx, a
 * network error); this module gives them one more chance, later, without
 * ever guessing membership from the untrusted webhook payload.
 *
 * Guardrails:
 *   - manual only. Nothing here is scheduled or triggered automatically;
 *     an admin runs it from the Breezeway panel, the same way they run the
 *     existing fixture self-test.
 *   - bounded batch (`RECOVERY_BATCH_SIZE` rows per call) and a bounded
 *     per-event retry cap (`MAX_RETRY_ATTEMPTS`) — this can never turn into
 *     an unbounded retry loop.
 *   - every re-verification goes through `verifyAndFinalizeTask`, the exact
 *     same company/property/duplicate-or-stale logic a live delivery uses,
 *     via the same token cache and shared rate limiter in
 *     `breezeway.server.ts`. A recovered event can outcome as `processed`,
 *     `ignored_other_property`, `ignored_other_company`, `duplicate`, or
 *     `stale` — never anything a first delivery couldn't also produce, and
 *     never a business write.
 *   - a failed retry updates the ORIGINAL failed row's retry count in place;
 *     it does not append a new `verify_failed` row each attempt, so retrying
 *     a stuck event can never inflate the event log or duplicate results.
 *   - rows whose task id was never captured (only possible for events
 *     recorded before this recovery mechanism existed) cannot be retried —
 *     there is nothing to re-fetch — and are marked not retryable rather
 *     than retried forever.
 *
 * Requires the `retryable` / `retry_count` / `recovered_at` columns added by
 * the prepared-but-not-yet-applied migration
 * `supabase/migrations/20260828193000_c9b0e1a8-4614-4a4f-91bb-6c0871fd1f2d.sql`.
 */
import {
  classifyLookupFailure,
  verifyAndFinalizeTask,
  type VerifyTask,
} from "./breezeway-webhook.server";

/** Rows examined per manual run. Keeps one click well under the 24 req/min budget. */
export const RECOVERY_BATCH_SIZE = 5;
/** After this many failed attempts, a transient-looking failure stops being retried automatically. */
export const MAX_RETRY_ATTEMPTS = 5;

type RecoveryRow = {
  id: string;
  task_id: number | null;
  retry_count: number;
};

export type RecoverySummary = {
  /** Rows examined this run (bounded by the batch size). */
  attempted: number;
  /** Verified this time and recorded with a real outcome. */
  recovered: number;
  /** Failed again but still under the retry cap — eligible for the next run. */
  stillFailing: number;
  /** Hit the retry cap, or the new failure is permanent — needs manual review. */
  permanentlyFailed: number;
  /** No task id was ever captured for this row — cannot be retried at all. */
  unrecoverable: number;
  /**
   * The lookup itself succeeded this time, but writing the resulting event
   * failed (a database problem, not a Breezeway problem) — the original row
   * is left untouched (not marked recovered, retry count not spent) so it's
   * simply tried again on the next pass.
   */
  persistFailed: number;
};

/**
 * Re-verifies a bounded batch of previously-failed, retryable task lookups.
 * Manual only — call this from an admin action, never from a schedule.
 */
export async function recoverFailedTaskVerifications(
  options: { verifyTask?: VerifyTask; batchSize?: number } = {},
): Promise<RecoverySummary> {
  const batchSize = Math.min(
    Math.max(Math.trunc(options.batchSize ?? RECOVERY_BATCH_SIZE), 1),
    RECOVERY_BATCH_SIZE,
  );
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data } = await supabaseAdmin
    .from("breezeway_webhook_events")
    .select("id, task_id, retry_count")
    .eq("is_fixture", false)
    .eq("outcome", "verify_failed")
    .eq("retryable", true)
    .is("recovered_at", null)
    .lt("retry_count", MAX_RETRY_ATTEMPTS)
    .order("received_at", { ascending: true })
    .limit(batchSize);

  const rows = (data ?? []) as RecoveryRow[];
  const summary: RecoverySummary = {
    attempted: rows.length,
    recovered: 0,
    stillFailing: 0,
    permanentlyFailed: 0,
    unrecoverable: 0,
    persistFailed: 0,
  };

  for (const row of rows) {
    if (row.task_id == null) {
      await supabaseAdmin
        .from("breezeway_webhook_events")
        .update({
          retryable: false,
          reason: "Cannot retry: no task id was captured for this event",
        })
        .eq("id", row.id);
      summary.unrecoverable += 1;
      continue;
    }

    // Suppress the normal failure recording: on failure we update THIS row's
    // retry count below instead of appending another verify_failed row.
    // `verifyTask` is only included when actually provided —
    // exactOptionalPropertyTypes rejects an explicit `undefined`.
    const finalized = await verifyAndFinalizeTask(row.task_id, {
      recordFailure: false,
      ...(options.verifyTask ? { verifyTask: options.verifyTask } : {}),
    });

    if (finalized.outcome === "persist_failed") {
      // The lookup itself succeeded (we now know the real outcome), but the
      // write that would have made it durable failed — a database problem,
      // not a Breezeway one. Do NOT mark the original row recovered (nothing
      // durable happened) and do NOT spend a retry attempt on it (retrying
      // the lookup again won't help; the write is what failed) — leave it
      // exactly as-is so it's simply tried again next pass.
      summary.persistFailed += 1;
      continue;
    }

    if (finalized.outcome !== "verify_failed") {
      // Resolved — verifyAndFinalizeTask already recorded a fresh event with
      // the real outcome. Close out the original failure so it is never
      // picked up again and never double-counted.
      await supabaseAdmin
        .from("breezeway_webhook_events")
        .update({
          retryable: false,
          recovered_at: new Date().toISOString(),
          reason: `Recovered on retry: ${finalized.outcome}`,
        })
        .eq("id", row.id);
      summary.recovered += 1;
      continue;
    }

    const nextRetryCount = row.retry_count + 1;
    const stillRetryable = Boolean(finalized.retryable) && nextRetryCount < MAX_RETRY_ATTEMPTS;
    await supabaseAdmin
      .from("breezeway_webhook_events")
      .update({
        retry_count: nextRetryCount,
        retryable: stillRetryable,
        reason: stillRetryable
          ? finalized.reason
          : `${finalized.reason} — exceeded retry limit after ${nextRetryCount} attempts, needs manual review`,
      })
      .eq("id", row.id);

    if (stillRetryable) summary.stillFailing += 1;
    else summary.permanentlyFailed += 1;
  }

  return summary;
}

/** Classification helper re-exported for callers that need it without the DB round trip. */
export { classifyLookupFailure };
