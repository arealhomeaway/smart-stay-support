/**
 * Inbound task sync (server-only).
 *
 * Pulls work that was created *outside* Resolve — Breezeway tasks and OwnerRez
 * maintenance tasks — into the matters queue so Resolve stays the single place
 * the team works from. Every imported record keeps a stable link back to the
 * source system (external_source + external_id) so repeated syncs update the
 * same matter instead of creating duplicates.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;

export type SyncResult = {
  source: "breezeway" | "ownerrez";
  ok: boolean;
  created: number;
  updated: number;
  unlinked: number;
  total: number;
  error?: string;
};

type NormalizedTask = {
  externalId: string;
  title: string;
  description: string | null;
  priority: "p1" | "p2" | "p3";
  category: string;
  status: string; // Resolve status
  externalStatus: string | null;
  externalUrl: string | null;
  externalPropertyId: string | null;
  dueAt: string | null;
};

const CLOSED_HINTS = ["complete", "completed", "finished", "closed", "done", "cancel", "cancelled", "canceled"];
const STARTED_HINTS = ["in_progress", "in progress", "started", "assigned", "accepted"];

function mapStatus(raw: string | null | undefined) {
  const s = (raw ?? "").toLowerCase();
  if (CLOSED_HINTS.some((h) => s.includes(h))) return "closed";
  if (STARTED_HINTS.some((h) => s.includes(h))) return "in_progress";
  return "open";
}

function guessCategory(text: string) {
  const s = text.toLowerCase();
  if (/(smoke|carbon|co detector|co alarm|alarm|detector|security)/.test(s)) return "safety";
  if (/(clean|turnover|linen|laundry|trash)/.test(s)) return "cleaning";
  if (/(lock|code|key|access)/.test(s)) return "access";
  if (/(inspect|walkthrough|quality)/.test(s)) return "quality";
  if (/(leak|water|hvac|heat|ac |a\/c|plumb|electric|repair|broken|fix|appliance)/.test(s)) return "maintenance";
  return "maintenance";
}

function mapPriorityNumber(n: unknown): "p1" | "p2" | "p3" {
  const v = typeof n === "number" ? n : Number(n);
  if (v === 1) return "p1";
  if (v === 2) return "p2";
  return "p3";
}

/** Writes one normalized task into the matters table, insert-or-update by external id. */
async function upsertTask(
  db: Db,
  source: "breezeway" | "ownerrez",
  task: NormalizedTask,
  propertyIdByExternal: Map<string, string>,
  createdBy: string | null,
  result: SyncResult,
) {
  const propertyId = task.externalPropertyId
    ? (propertyIdByExternal.get(task.externalPropertyId) ?? null)
    : null;
  if (!propertyId) result.unlinked += 1;

  const now = new Date().toISOString();

  const { data: existing } = await db
    .from("tickets")
    .select("id, status, external_status")
    .eq("external_source", source)
    .eq("external_id", task.externalId)
    .maybeSingle();

  if (existing) {
    const statusChanged = (existing.external_status ?? "") !== (task.externalStatus ?? "");
    const patch: Database["public"]["Tables"]["tickets"]["Update"] = {
      external_status: task.externalStatus,
      external_synced_at: now,
      external_url: task.externalUrl,
    };

    // Never reopen something a coordinator already closed in Resolve; only
    // mirror a close that happened in the source system.
    if (task.status === "closed" && existing.status !== "closed") {
      patch["status"] = "closed";
      patch["resolved_at"] = now;
      patch["outcome_type"] = "vendor_completed";
    }
    if (propertyId) patch["property_id"] = propertyId;

    await db.from("tickets").update(patch).eq("id", existing.id);

    if (statusChanged) {
      await db.from("ticket_activity").insert({
        ticket_id: existing.id,
        kind: "note",
        event_type: "note",
        body: `${source === "breezeway" ? "Breezeway" : "OwnerRez"} status updated to "${task.externalStatus ?? "unknown"}".`,
      });
      result.updated += 1;
    }
    return;
  }

  const { data: inserted, error } = await db
    .from("tickets")
    .insert({
      record_type: "ticket",
      title: task.title,
      description: task.description,
      property_id: propertyId,
      category: task.category,
      priority: task.priority,
      suggested_priority: task.priority,
      status: task.status,
      resolved_at: task.status === "closed" ? now : null,
      outcome_type: task.status === "closed" ? "vendor_completed" : null,
      guest_impact: "none",
      occupancy_status: "vacant",
      source_channel: source,
      initiator_type: "vendor",
      source_reference: task.externalId,
      external_source: source,
      external_id: task.externalId,
      external_status: task.externalStatus,
      external_url: task.externalUrl,
      external_synced_at: now,
      due_at: task.dueAt,
      reported_at: now,
      created_by: createdBy,
      record_owner: createdBy,
      accountable_owner: createdBy,
      ...(source === "breezeway"
        ? { breezeway_task_id: task.externalId, breezeway_task_status: task.externalStatus, breezeway_synced_at: now }
        : {}),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await db.from("ticket_activity").insert({
    ticket_id: inserted.id,
    kind: "created",
    event_type: "created",
    channel: source,
    body: `Imported from ${source === "breezeway" ? "Breezeway" : "OwnerRez"} (task ${task.externalId}).${
      propertyId ? "" : " No matching home is linked yet — link the property to complete the record."
    }`,
  });
  result.created += 1;
}

async function propertyMap(db: Db, column: "breezeway_property_id" | "ownerrez_property_id") {
  const { data } = await db.from("properties").select(`id, ${column}`);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<Record<string, string | null>>) {
    const key = row[column];
    if (key && row["id"]) map.set(String(key), String(row["id"]));
  }
  return map;
}

export async function syncBreezewayInbound(db: Db, createdBy: string | null): Promise<SyncResult> {
  const result: SyncResult = { source: "breezeway", ok: true, created: 0, updated: 0, unlinked: 0, total: 0 };
  const { listBreezewayTasks, breezewayConfigured, BreezewayError } = await import("./breezeway.server");

  if (!breezewayConfigured()) {
    return { ...result, ok: false, error: "Breezeway is not connected yet." };
  }

  try {
    const tasks = await listBreezewayTasks();
    result.total = tasks.length;
    const props = await propertyMap(db, "breezeway_property_id");

    for (const t of tasks) {
      const title = (t.name ?? "Breezeway task").toString().trim() || "Breezeway task";
      const normalized: NormalizedTask = {
        externalId: String(t.id),
        title,
        description: [t.description, t.type_department ? `Department: ${t.type_department}` : null]
          .filter(Boolean)
          .join("\n\n") || null,
        priority: mapPriorityNumber(t.priority),
        category: guessCategory(`${title} ${t.type_department ?? ""}`),
        status: mapStatus(t.status),
        externalStatus: t.status ?? null,
        externalUrl: `https://app.breezeway.io/tasks/${t.id}`,
        externalPropertyId: t.home_id != null ? String(t.home_id) : null,
        dueAt: t.scheduled_date ? new Date(t.scheduled_date).toISOString() : null,
      };
      await upsertTask(db, "breezeway", normalized, props, createdBy, result);
    }
    return result;
  } catch (err) {
    const message = err instanceof BreezewayError ? err.message : (err as Error).message;
    return { ...result, ok: false, error: message || "Could not reach Breezeway." };
  }
}

export async function syncOwnerRezInbound(db: Db, createdBy: string | null): Promise<SyncResult> {
  const result: SyncResult = { source: "ownerrez", ok: true, created: 0, updated: 0, unlinked: 0, total: 0 };
  const { listOwnerRezTasks, OwnerRezError } = await import("./ownerrez.server");

  try {
    const tasks = await listOwnerRezTasks();
    result.total = tasks.length;
    const props = await propertyMap(db, "ownerrez_property_id");

    for (const t of tasks) {
      const title = (t.title ?? t.description ?? "OwnerRez task").toString().trim().slice(0, 200) || "OwnerRez task";
      const normalized: NormalizedTask = {
        externalId: String(t.id),
        title,
        description: t.description ?? null,
        priority: (t.priority ?? "").toLowerCase().includes("high")
          ? "p2"
          : (t.priority ?? "").toLowerCase().includes("urgent")
            ? "p1"
            : "p3",
        category: guessCategory(`${title} ${t.description ?? ""}`),
        status: mapStatus(t.status ?? (t.is_completed ? "completed" : "open")),
        externalStatus: t.status ?? (t.is_completed ? "completed" : "open"),
        externalUrl: null,
        externalPropertyId: t.property_id != null ? String(t.property_id) : null,
        dueAt: t.due_date ? new Date(t.due_date).toISOString() : null,
      };
      await upsertTask(db, "ownerrez", normalized, props, createdBy, result);
    }
    return result;
  } catch (err) {
    const message = err instanceof OwnerRezError ? err.message : (err as Error).message;
    return { ...result, ok: false, error: message || "Could not reach OwnerRez." };
  }
}
