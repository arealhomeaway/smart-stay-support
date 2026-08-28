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
  | "verify_failed";

export type WebhookResult = {
  outcome: WebhookOutcome;
  reason: string;
  /** Only ever set for the approved pilot property. */
  taskId: number | null;
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
    homeId: firstNumber(root["home_id"], nested["home_id"], root["property_id"], nested["property_id"]),
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
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("breezeway_webhook_events").insert({
    outcome: row.outcome,
    reason: row.reason,
    task_id: row.taskId ?? null,
    home_id: row.homeId ?? null,
    company_id: row.companyId ?? null,
    task_updated_at: row.taskUpdatedAt ?? null,
    is_fixture: row.isFixture,
  });
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
    await recordEvent({ outcome: "invalid", reason: "No usable task id in payload", isFixture });
    return { outcome: "invalid", reason: "No usable task id in payload", taskId: null };
  }
  if (parsed.webhookType && parsed.webhookType !== "task") {
    await recordEvent({ outcome: "invalid", reason: "Not a task webhook", isFixture });
    return { outcome: "invalid", reason: "Not a task webhook", taskId: null };
  }

  // Cheap pre-filter: if the payload names a different property, drop it now
  // and spend no API budget on it. Detail is never stored for those.
  if (parsed.homeId != null && parsed.homeId !== PILOT_HOME_ID) {
    await recordEvent({ outcome: "ignored_other_property", reason: "Outside pilot property", isFixture });
    return { outcome: "ignored_other_property", reason: "Outside pilot property", taskId: null };
  }
  if (parsed.companyId != null && parsed.companyId !== PILOT_COMPANY_ID) {
    await recordEvent({ outcome: "ignored_other_company", reason: "Outside pilot company", isFixture });
    return { outcome: "ignored_other_company", reason: "Outside pilot company", taskId: null };
  }

  // Authenticated re-read decides membership. Uses the shared rate limiter.
  let verified: Awaited<ReturnType<VerifyTask>> = null;
  try {
    const verify: VerifyTask =
      options.verifyTask ??
      (async (id) => {
        const { getBreezewayTask } = await import("./breezeway.server");
        const t = await getBreezewayTask(id);
        return t ? { id: t.id, homeId: t.homeId, companyId: t.companyId, updatedAt: t.updatedAt } : null;
      });
    verified = await verify(parsed.taskId);
  } catch (error) {
    const reason =
      error instanceof BreezewayError ? `Verification failed (${error.status})` : "Verification failed";
    await recordEvent({ outcome: "verify_failed", reason, isFixture });
    return { outcome: "verify_failed", reason, taskId: null };
  }

  if (!verified) {
    await recordEvent({ outcome: "verify_failed", reason: "Task not found on re-read", isFixture });
    return { outcome: "verify_failed", reason: "Task not found on re-read", taskId: null };
  }
  if (verified.companyId != null && verified.companyId !== PILOT_COMPANY_ID) {
    await recordEvent({ outcome: "ignored_other_company", reason: "Outside pilot company", isFixture });
    return { outcome: "ignored_other_company", reason: "Outside pilot company", taskId: null };
  }
  if (verified.homeId !== PILOT_HOME_ID) {
    await recordEvent({ outcome: "ignored_other_property", reason: "Outside pilot property", isFixture });
    return { outcome: "ignored_other_property", reason: "Outside pilot property", taskId: null };
  }

  const updatedAt = verified.updatedAt ?? parsed.updatedAt;
  const updatedMs = updatedAt ? Date.parse(updatedAt) : null;
  const seenMs = await lastProcessed(parsed.taskId, isFixture);

  if (seenMs != null && updatedMs != null) {
    if (updatedMs === seenMs) {
      await recordEvent({
        outcome: "duplicate",
        reason: "Same task update already processed",
        taskId: parsed.taskId,
        homeId: PILOT_HOME_ID,
        companyId: PILOT_COMPANY_ID,
        taskUpdatedAt: updatedAt,
        isFixture,
      });
      return { outcome: "duplicate", reason: "Same task update already processed", taskId: parsed.taskId };
    }
    if (updatedMs < seenMs) {
      await recordEvent({
        outcome: "stale",
        reason: "Older than the update already processed",
        taskId: parsed.taskId,
        homeId: PILOT_HOME_ID,
        companyId: PILOT_COMPANY_ID,
        taskUpdatedAt: updatedAt,
        isFixture,
      });
      return { outcome: "stale", reason: "Older than the update already processed", taskId: parsed.taskId };
    }
  }

  // "Processed" in this pilot means: verified, in scope, and recorded for the
  // admin preview. Nothing operational happens.
  await recordEvent({
    outcome: "processed",
    reason: "Verified pilot task update",
    taskId: parsed.taskId,
    homeId: PILOT_HOME_ID,
    companyId: PILOT_COMPANY_ID,
    taskUpdatedAt: updatedAt,
    isFixture,
  });
  return { outcome: "processed", reason: "Verified pilot task update", taskId: parsed.taskId };
}
