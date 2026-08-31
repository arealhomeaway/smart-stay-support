/**
 * Breezeway task webhook receiver logic (server-only).
 *
 * Scope of the approved pilot:
 *   - Breezeway delivers task events for the WHOLE company on one subscription.
 *   - We keep task detail only for company 3641 and property 1473933.
 *   - Everything else is counted and discarded; its payload is never logged,
 *     stored, or echoed back.
 *
 * Trust model:
 *   - the random path segment is the shared secret and is compared in constant
 *     time; it lives in BREEZEWAY_WEBHOOK_PATH_TOKEN and is never logged
 *   - Breezeway does not sign payloads, so a payload only tells us WHICH task
 *     changed. Company + property membership is always re-read from the
 *     authenticated API before anything is retained.
 *   - duplicate / out-of-order protection uses the documented task id plus the
 *     task's update timestamp. There is no separate event id, so we never
 *     assume one.
 *
 * Lookup failures (the re-read of the task from Breezeway's API fails or times
 * out) are recorded as `verify_failed`, never as `processed`. A failure is
 * classified transient/retryable (429, 5xx, network error) or permanent
 * (4xx other than 429, or the task genuinely not found) — see
 * `classifyLookupFailure`. Only transient failures are eligible for the
 * bounded recovery pass in `breezeway-webhook-recovery.server.ts`, which
 * re-runs this exact verification + scope + dedupe path so a recovered event
 * can never bypass a check a live delivery would have applied.
 *
 * This receiver is preview-only: it creates no matters, assigns no vendors,
 * sends no messages, changes no property stage, and writes nothing back to
 * Breezeway.
 */
import { BreezewayError } from "./breezeway.server";

/** The only company whose task detail may be retained. */
export const PILOT_COMPANY_ID = 3641;
/** The only property whose task detail may be retained. */
export const PILOT_HOME_ID = 1473933;

export type WebhookOutcome =
  | "processed"
  | "ignored_other_property"
  | "ignored_other_company"
  | "duplicate"
  | "stale"
  | "invalid"
  | "verify_failed"
  /**
   * The event was classified (as one of the outcomes above) but the database
   * write that would have made that classification durable failed for a
   * reason other than the expected concurrent-duplicate conflict (23505) —
   * e.g. the database was unreachable, or the schema is out of sync with
   * this code. Never used to mean "processed" or any other outcome actually
   * completed; a caller must not treat this as durable success.
   */
  | "persist_failed";

export type WebhookResult = {
  outcome: WebhookOutcome;
  reason: string;
  /** Only ever set for the approved pilot property. */
  taskId: number | null;
  /** Only meaningful (and set) for `verify_failed`: worth a later bounded retry, or permanent. */
  retryable?: boolean;
};

/** Constant-time string compare (no early exit on length or content). */
export function secretMatches(provided: string, expected: string) {
  if (!expected) return false;
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function webhookPathToken() {
  return process.env["BREEZEWAY_WEBHOOK_PATH_TOKEN"] ?? "";
}

function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  }
  return null;
}

function firstDate(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v !== "string" || !v.trim()) continue;
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
}

type Bag = Record<string, unknown>;

/**
 * Pulls only the identifiers we need out of an untrusted payload. Everything
 * else in the body is discarded here and never reaches storage or logs.
 */
export function parseWebhookPayload(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const root = body as Bag;
  const nested = (root["data"] ?? root["task"] ?? root["payload"] ?? {}) as Bag;

  const taskId = firstNumber(root["task_id"], nested["task_id"], nested["id"], root["id"]);
  if (taskId == null) return null;

  return {
    taskId,
    homeId: firstNumber(
      root["home_id"],
      nested["home_id"],
      root["property_id"],
      nested["property_id"],
    ),
    companyId: firstNumber(root["company_id"], nested["company_id"]),
    updatedAt: firstDate(
      root["updated_at"],
      nested["updated_at"],
      root["modified_at"],
      nested["modified_at"],
      root["timestamp"],
    ),
    webhookType: typeof root["webhook_type"] === "string" ? (root["webhook_type"] as string) : null,
  };
}

async function recordEvent(row: {
  outcome: WebhookOutcome;
  reason: string;
  taskId?: number | null;
  homeId?: number | null;
  companyId?: number | null;
  taskUpdatedAt?: string | null;
  isFixture: boolean;
  /**
   * Only meaningful for `verify_failed`. True when the lookup failure looks
   * transient (rate limit / server error / network) and is worth a bounded
   * retry later; false for a permanent failure (task genuinely gone, or a
   * 4xx that a blind retry cannot fix). Omitted for every other outcome.
   */
  retryable?: boolean;
}): Promise<{ conflict: boolean; persisted: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("breezeway_webhook_events").insert({
    outcome: row.outcome,
    reason: row.reason,
    task_id: row.taskId ?? null,
    home_id: row.homeId ?? null,
    company_id: row.companyId ?? null,
    task_updated_at: row.taskUpdatedAt ?? null,
    is_fixture: row.isFixture,
    retryable: row.retryable ?? false,
  });
  if (!error) return { conflict: false, persisted: true };

  // 23505 = unique_violation. Only the `processed` outcome is constrained
  // (breezeway_webhook_events_processed_once); a hit here means a concurrent
  // delivery of this exact task update already recorded it first. Expected,
  // handled by the caller — not an unexpected persistence failure.
  if (error.code === "23505") return { conflict: true, persisted: false };

  // Anything else is unexpected: the write did not happen, so nothing about
  // this delivery is durable. Surface it in the operational logs — never the
  // payload, the task id, or any secret; only what outcome we were trying to
  // record and Postgres/PostgREST's own error code — and let the caller
  // report `persist_failed` instead of silently claiming success.
  console.error(
    `[breezeway-webhook] insert failed for outcome "${row.outcome}" (code ${error.code ?? "unknown"})`,
  );
  return { conflict: false, persisted: false };
}

const PERSIST_FAILED_RESULT: WebhookResult = {
  outcome: "persist_failed",
  reason: "Could not durably record this event (database write failed)",
  taskId: null,
};

/**
 * Records an event and returns the matching WebhookResult, or
 * `persist_failed` when the write itself could not be completed. Covers
 * every outcome that doesn't need bespoke conflict handling — `processed`
 * (and the `duplicate` it can fall back to on a race) records directly
 * instead, since only that path needs to interpret a 23505 conflict.
 */
async function recordAndReturn(
  row: Parameters<typeof recordEvent>[0],
  resultTaskId: number | null,
): Promise<WebhookResult> {
  const { persisted } = await recordEvent(row);
  if (!persisted) return PERSIST_FAILED_RESULT;
  return { outcome: row.outcome, reason: row.reason, taskId: resultTaskId };
}

/** Highest update timestamp already processed for this task, if any. */
async function lastProcessed(taskId: number, isFixture: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("breezeway_webhook_events")
    .select("task_updated_at")
    .eq("task_id", taskId)
    .eq("outcome", "processed")
    .eq("is_fixture", isFixture)
    .order("task_updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const value = (data as { task_updated_at: string | null } | null)?.task_updated_at ?? null;
  return value ? Date.parse(value) : null;
}

export type VerifyTask = (taskId: number) => Promise<{
  id: number;
  homeId: number | null;
  companyId: number | null;
  updatedAt: string | null;
} | null>;

function defaultVerifyTask(): VerifyTask {
  return async (id) => {
    const { getBreezewayTask } = await import("./breezeway.server");
    const t = await getBreezewayTask(id);
    return t
      ? { id: t.id, homeId: t.homeId, companyId: t.companyId, updatedAt: t.updatedAt }
      : null;
  };
}

/**
 * Classifies a thrown lookup failure as worth a later bounded retry or not.
 * Rate limits and server errors are transient; everything else (bad request,
 * unauthorized, a status our client rejects outright) needs a human, not a
 * retry loop.
 */
export function classifyLookupFailure(error: unknown): { reason: string; retryable: boolean } {
  if (error instanceof BreezewayError) {
    const retryable = error.status === 429 || error.status >= 500;
    return { reason: `Verification failed (${error.status})`, retryable };
  }
  return { reason: "Verification failed (network error)", retryable: true };
}

/**
 * Runs the authenticated re-read for one task id and returns a terminal
 * result. Never throws. Shared by the live webhook path and the bounded
 * recovery pass so a retried lookup is checked against the exact same
 * company/property/dedupe rules as a first delivery — no separate, looser
 * code path for retries.
 */
export async function verifyAndFinalizeTask(
  taskId: number,
  options: {
    isFixture?: boolean;
    verifyTask?: VerifyTask;
    fallbackUpdatedAt?: string | null;
    /**
     * When false, a failed verification is classified and returned but NOT
     * recorded as a new event row. Used by the recovery pass, which updates
     * the original failed row's retry count directly instead of appending a
     * fresh `verify_failed` row on every retry attempt. Defaults to true —
     * the live webhook path always records.
     */
    recordFailure?: boolean;
  } = {},
): Promise<WebhookResult> {
  const isFixture = options.isFixture ?? false;
  const recordFailure = options.recordFailure ?? true;
  const verify = options.verifyTask ?? defaultVerifyTask();

  let verified: Awaited<ReturnType<VerifyTask>> = null;
  try {
    verified = await verify(taskId);
  } catch (error) {
    const { reason, retryable } = classifyLookupFailure(error);
    if (!recordFailure) return { outcome: "verify_failed", reason, taskId: null, retryable };
    const { persisted } = await recordEvent({
      outcome: "verify_failed",
      reason,
      taskId,
      isFixture,
      retryable,
    });
    if (!persisted) return PERSIST_FAILED_RESULT;
    return { outcome: "verify_failed", reason, taskId: null, retryable };
  }

  if (!verified) {
    const reason = "Task not found on re-read";
    if (!recordFailure) return { outcome: "verify_failed", reason, taskId: null, retryable: false };
    const { persisted } = await recordEvent({
      outcome: "verify_failed",
      reason,
      taskId,
      isFixture,
      retryable: false,
    });
    if (!persisted) return PERSIST_FAILED_RESULT;
    return { outcome: "verify_failed", reason, taskId: null, retryable: false };
  }
  if (verified.companyId != null && verified.companyId !== PILOT_COMPANY_ID) {
    return recordAndReturn(
      { outcome: "ignored_other_company", reason: "Outside pilot company", isFixture },
      null,
    );
  }
  if (verified.homeId !== PILOT_HOME_ID) {
    return recordAndReturn(
      { outcome: "ignored_other_property", reason: "Outside pilot property", isFixture },
      null,
    );
  }

  const updatedAt = verified.updatedAt ?? options.fallbackUpdatedAt ?? null;
  const updatedMs = updatedAt ? Date.parse(updatedAt) : null;
  const seenMs = await lastProcessed(taskId, isFixture);

  if (seenMs != null && updatedMs != null) {
    if (updatedMs === seenMs) {
      return recordAndReturn(
        {
          outcome: "duplicate",
          reason: "Same task update already processed",
          taskId,
          homeId: PILOT_HOME_ID,
          companyId: PILOT_COMPANY_ID,
          taskUpdatedAt: updatedAt,
          isFixture,
        },
        taskId,
      );
    }
    if (updatedMs < seenMs) {
      return recordAndReturn(
        {
          outcome: "stale",
          reason: "Older than the update already processed",
          taskId,
          homeId: PILOT_HOME_ID,
          companyId: PILOT_COMPANY_ID,
          taskUpdatedAt: updatedAt,
          isFixture,
        },
        taskId,
      );
    }
  }

  // "Processed" in this pilot means: verified, in scope, and recorded for the
  // admin preview. Nothing operational happens.
  const { conflict, persisted } = await recordEvent({
    outcome: "processed",
    reason: "Verified pilot task update",
    taskId,
    homeId: PILOT_HOME_ID,
    companyId: PILOT_COMPANY_ID,
    taskUpdatedAt: updatedAt,
    isFixture,
  });
  if (conflict) {
    // Lost a race with a concurrent delivery of this exact update (e.g. a
    // genuine Breezeway redelivery, or a live delivery overlapping a
    // recovery retry). It is not this call's to record twice.
    const reason = "Same task update already processed (concurrent delivery)";
    return recordAndReturn(
      {
        outcome: "duplicate",
        reason,
        taskId,
        homeId: PILOT_HOME_ID,
        companyId: PILOT_COMPANY_ID,
        taskUpdatedAt: updatedAt,
        isFixture,
      },
      taskId,
    );
  }
  if (!persisted) return PERSIST_FAILED_RESULT;

  // Reconciliation only: if this verified task is one Resolve created, note
  // the acknowledgement against our own record. Lives here, not in the live
  // webhook path alone, so a delivery recovered by the retry pass reconciles
  // exactly the same way. Never changes Resolve state, never fails delivery.
  if (!isFixture) await noteOutboundAcknowledgement(taskId);

  return { outcome: "processed", reason: "Verified pilot task update", taskId };
}

async function noteOutboundAcknowledgement(taskId: number) {
  try {
    const { noteOutboundWebhook } = await import("./breezeway-outbound.server");
    await noteOutboundWebhook(taskId);
  } catch {
    /* bookkeeping only */
  }
}

/**
 * Handles one delivery. Always returns a result (never throws to Breezeway) so
 * a bad payload cannot cause endless redelivery.
 */
export async function processBreezewayWebhook(
  body: unknown,
  options: { isFixture?: boolean; verifyTask?: VerifyTask } = {},
): Promise<WebhookResult> {
  const isFixture = options.isFixture ?? false;
  const parsed = parseWebhookPayload(body);

  if (!parsed) {
    return recordAndReturn(
      { outcome: "invalid", reason: "No usable task id in payload", isFixture },
      null,
    );
  }
  if (parsed.webhookType && parsed.webhookType !== "task") {
    return recordAndReturn({ outcome: "invalid", reason: "Not a task webhook", isFixture }, null);
  }

  // Cheap pre-filter: if the payload names a different property, drop it now
  // and spend no API budget on it. Detail is never stored for those.
  if (parsed.homeId != null && parsed.homeId !== PILOT_HOME_ID) {
    return recordAndReturn(
      { outcome: "ignored_other_property", reason: "Outside pilot property", isFixture },
      null,
    );
  }
  if (parsed.companyId != null && parsed.companyId !== PILOT_COMPANY_ID) {
    return recordAndReturn(
      { outcome: "ignored_other_company", reason: "Outside pilot company", isFixture },
      null,
    );
  }

  // Authenticated re-read decides membership. Uses the shared rate limiter.
  // `verifyTask` is only included when the caller actually passed one —
  // exactOptionalPropertyTypes rejects explicitly setting an optional
  // property to `undefined`, and omitting it here lets the callee's own
  // `options.verifyTask ?? defaultVerifyTask()` fallback apply.
  const finalized = await verifyAndFinalizeTask(parsed.taskId, {
    isFixture,
    fallbackUpdatedAt: parsed.updatedAt,
    ...(options.verifyTask ? { verifyTask: options.verifyTask } : {}),
  });

  return {
    outcome: finalized.outcome,
    reason: finalized.reason,
    taskId: finalized.taskId,
    ...(finalized.retryable !== undefined ? { retryable: finalized.retryable } : {}),
  };
}

