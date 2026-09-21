/**
 * Reads the Breezeway sync review board and records held conflicts.
 *
 * Server-only. Nothing here writes a business record: it reads the event log
 * and the mirrored jobs, and records disagreements for a person to settle.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  classifyEvent,
  detectDrift,
  driftKey,
  heldConflict,
  needsReview,
  type DriftItem,
  type MirrorSide,
  type ResolveSide,
} from "./sync-review";

const EVENT_LIMIT = 50;
const MIRROR_LIMIT = 200;

export type ReviewEvent = {
  id: string;
  receivedAt: string | null;
  outcome: string | null;
  reason: string | null;
  taskId: number | null;
  homeId: string | null;
  retryable: boolean | null;
  retryCount: number | null;
  recoveredAt: string | null;
  label: string;
  meaning: string;
  bucket: string;
};

export async function listUnplacedEvents(): Promise<ReviewEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("breezeway_webhook_events")
    .select(
      "id, received_at, outcome, reason, task_id, home_id, retryable, retry_count, recovered_at, is_fixture",
    )
    .order("received_at", { ascending: false })
    .limit(EVENT_LIMIT * 4);
  if (error) throw new Error("Could not read the Breezeway update log.");

  return (data ?? [])
    .filter((row) => !row.is_fixture && !row.recovered_at && needsReview(row.outcome))
    .slice(0, EVENT_LIMIT)
    .map((row) => {
      const info = classifyEvent(row.outcome);
      return {
        id: row.id,
        receivedAt: row.received_at,
        outcome: row.outcome,
        reason: row.reason,
        taskId: row.task_id,
        homeId: row.home_id,
        retryable: row.retryable,
        retryCount: row.retry_count,
        recoveredAt: row.recovered_at,
        label: info.label,
        meaning: info.meaning,
        bucket: info.bucket,
      };
    });
}

/** Compares every mirrored job with its Resolve ticket. Read-only. */
export async function detectAllDrift(): Promise<DriftItem[]> {
  const { data: mirrors, error } = await supabaseAdmin
    .from("breezeway_work_orders")
    .select(
      "breezeway_task_id, name, status, stage, scheduled_date, property_id, linked_ticket_id, breezeway_updated_at",
    )
    .order("breezeway_updated_at", { ascending: false })
    .limit(MIRROR_LIMIT);
  if (error) throw new Error("Could not read the mirrored Breezeway jobs.");

  const ticketIds = Array.from(
    new Set((mirrors ?? []).map((m) => m.linked_ticket_id).filter((v): v is string => Boolean(v))),
  );

  const tickets = new Map<string, { status: string | null; scheduled: string | null }>();
  if (ticketIds.length > 0) {
    const { data: rows, error: ticketError } = await supabaseAdmin
      .from("tickets")
      .select("id, status, scheduled_for")
      .in("id", ticketIds);
    if (ticketError) throw new Error("Could not read the linked tickets.");
    for (const row of rows ?? []) {
      const scheduled = row.scheduled_for ? String(row.scheduled_for).slice(0, 10) : null;
      tickets.set(row.id, { status: row.status, scheduled });
    }
  }

  const items: DriftItem[] = [];
  for (const m of mirrors ?? []) {
    const mirror: MirrorSide = {
      taskId: Number(m.breezeway_task_id),
      name: m.name,
      status: m.status,
      stage: m.stage,
      scheduledDate: m.scheduled_date,
      propertyId: m.property_id,
      linkedTicketId: m.linked_ticket_id,
      updatedAt: m.breezeway_updated_at,
    };
    const linked = m.linked_ticket_id ? tickets.get(m.linked_ticket_id) : undefined;
    const local: ResolveSide = linked
      ? {
          ticketId: m.linked_ticket_id as string,
          status: linked.status,
          scheduledDate: linked.scheduled,
        }
      : null;
    items.push(...detectDrift(mirror, local));
  }
  return items;
}

export type OpenConflict = {
  id: string;
  entityType: string;
  entityId: string;
  fieldKey: string;
  fieldLabel: string;
  resolveValue: string | null;
  externalValue: string | null;
  note: string | null;
  detectedAt: string | null;
};

export async function listOpenConflicts(): Promise<OpenConflict[]> {
  const { data, error } = await supabaseAdmin
    .from("field_conflicts")
    .select(
      "id, entity_type, entity_id, field_key, field_label, resolve_value, external_value, note, detected_at, status",
    )
    .eq("system", "breezeway")
    .eq("status", "open")
    .order("detected_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not read the held differences.");
  return (data ?? []).map((row) => ({
    id: row.id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fieldKey: row.field_key,
    fieldLabel: row.field_label,
    resolveValue: row.resolve_value,
    externalValue: row.external_value,
    note: row.note,
    detectedAt: row.detected_at,
  }));
}

/**
 * Records every current drift as an open, held difference. Idempotent: a
 * difference already held for the same field is left exactly as it is, so a
 * second run never duplicates or reopens anything.
 */
export async function holdCurrentDrift(): Promise<{
  detected: number;
  held: number;
  alreadyHeld: number;
}> {
  const drift = await detectAllDrift();
  if (drift.length === 0) return { detected: 0, held: 0, alreadyHeld: 0 };

  const keys = drift.map(driftKey);
  const { data: existing, error } = await supabaseAdmin
    .from("field_conflicts")
    .select("field_key")
    .eq("system", "breezeway")
    .in("field_key", keys);
  if (error) throw new Error("Could not check the differences already held.");
  const known = new Set((existing ?? []).map((r) => r.field_key));

  const fresh = drift.filter((item) => !known.has(driftKey(item))).map(heldConflict);
  if (fresh.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("field_conflicts").insert(fresh);
    if (insertError) throw new Error("Could not record the differences for review.");
  }

  return {
    detected: drift.length,
    held: fresh.length,
    alreadyHeld: drift.length - fresh.length,
  };
}

/**
 * Records a person's decision on one held difference.
 *
 * The decision is recorded; no record is rewritten from it. Breezeway is
 * transitional and never overwrites Resolve on its own — whoever chooses the
 * Breezeway value makes that change on the ticket themselves, where the
 * ticket's own rules and history apply.
 */
export async function settleConflict(input: {
  conflictId: string;
  chosenSource: "resolve" | "breezeway";
  note: string;
  userId: string;
}): Promise<{ ok: true }> {
  const { data: row, error: readError } = await supabaseAdmin
    .from("field_conflicts")
    .select("id, status, resolve_value, external_value")
    .eq("id", input.conflictId)
    .maybeSingle();
  if (readError) throw new Error("Could not read that difference.");
  if (!row) throw new Error("That difference is no longer on the board.");
  if (row.status !== "open") throw new Error("Someone has already settled this one.");

  const finalValue =
    input.chosenSource === "breezeway" ? row.external_value : row.resolve_value;

  const { error } = await supabaseAdmin
    .from("field_conflicts")
    .update({
      status: "resolved",
      chosen_source: input.chosenSource,
      final_value: finalValue,
      resolved_by: input.userId,
      resolved_at: new Date().toISOString(),
      note: input.note,
    })
    .eq("id", input.conflictId)
    .eq("status", "open");
  if (error) throw new Error("Could not record your decision.");
  return { ok: true };
}
