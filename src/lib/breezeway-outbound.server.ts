/**
 * Breezeway outbound task creation (server-only).
 *
 * Approved beta scope, deliberately narrow:
 *   - Resolve remains the operational source of truth. A Breezeway task is a
 *     downstream copy; Breezeway never changes Resolve state from here.
 *   - Writes are restricted to the single mapped pilot property
 *     (OUTBOUND_PILOT_HOME_ID). Any other property is refused server-side.
 *   - The `breezeway_outbound` feature flag must be ON. OFF means no write.
 *
 * Idempotency (double-click and retry protection):
 *   1. Every attempt carries a caller-supplied `requestKey`, unique in the
 *      database. A repeated submit of the same intent (double click, browser
 *      retry, network retry) reuses that key and returns the first row instead
 *      of creating a second Breezeway task.
 *   2. A partial unique index allows only ONE in-flight ('creating') row per
 *      Resolve record, so two different keys racing cannot both call Breezeway.
 *   3. `breezeway_task_id` is unique, so the same external task can never be
 *      recorded twice.
 *   A deliberate second task for the same record is still possible: it comes
 *      from a new request key raised by a new, explicit user action.
 */
import { BreezewayError, breezewayRequest } from "./breezeway.server";
import {
  BREEZEWAY_OUTBOUND_FLAG,
  BREEZEWAY_DEPARTMENTS,
  BREEZEWAY_PRIORITIES,
  OUTBOUND_PILOT_HOME_ID,
  type BreezewayOutboundEligibility,
  type BreezewayOutboundLink,
} from "./breezeway-outbound";

export type OutboundSource = { sourceType: "ticket" | "onboarding_task"; sourceId: string };

export type CreateOutboundInput = OutboundSource & {
  requestKey: string;
  title: string;
  description: string | null;
  department: string | null;
  priority: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

type Row = {
  id: string;
  source_type: "ticket" | "onboarding_task";
  ticket_id: string | null;
  onboarding_task_id: string | null;
  breezeway_task_id: number | null;
  status: "creating" | "created" | "synced" | "error";
  title: string;
  department: string | null;
  priority: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  error_message: string | null;
  created_at: string;
  last_synced_at: string | null;
  last_webhook_at: string | null;
};

function toLink(row: Row): BreezewayOutboundLink {
  return {
    id: row.id,
    sourceType: row.source_type,
    ticketId: row.ticket_id,
    onboardingTaskId: row.onboarding_task_id,
    breezewayTaskId: row.breezeway_task_id,
    status: row.status,
    title: row.title,
    department: row.department,
    priority: row.priority,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    lastSyncedAt: row.last_synced_at,
    lastWebhookAt: row.last_webhook_at,
  };
}

const SELECT =
  "id, source_type, ticket_id, onboarding_task_id, breezeway_task_id, status, title, department, priority, scheduled_date, scheduled_time, error_message, created_at, last_synced_at, last_webhook_at";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function outboundEnabled() {
  const db = await admin();
  const { data } = await db
    .from("feature_flags")
    .select("enabled")
    .eq("key", BREEZEWAY_OUTBOUND_FLAG)
    .maybeSingle();
  // Unknown flag defaults to OFF — an unfinished workflow is never assumed live.
  return Boolean((data as { enabled: boolean } | null)?.enabled);
}

/**
 * Resolves the Resolve record to its property and confirms the pilot lock.
 * Demo and archived records are never sent to Breezeway.
 */
async function resolveSource(source: OutboundSource) {
  const db = await admin();
  let propertyId: string | null = null;
  let defaults: { title: string; description: string | null; priority: string | null } | null =
    null;

  if (source.sourceType === "ticket") {
    const { data, error } = await db
      .from("tickets")
      .select("id, title, description, priority, property_id, is_demo, archived_at")
      .eq("id", source.sourceId)
      .maybeSingle();
    if (error) throw new Error("Could not read that ticket.");
    if (!data) throw new Error("That ticket does not exist.");
    const t = data as unknown as {
      title: string;
      description: string | null;
      priority: string | null;
      property_id: string | null;
      is_demo: boolean | null;
      archived_at: string | null;
    };
    if (t.is_demo) throw new Error("Demo tickets are never sent to Breezeway.");
    if (t.archived_at) throw new Error("Archived tickets are never sent to Breezeway.");
    propertyId = t.property_id;
    defaults = { title: t.title, description: t.description, priority: t.priority };
  } else {
    const { data, error } = await db
      .from("onboarding_tasks")
      .select("id, title, detail, property_id, is_demo, archived_at")
      .eq("id", source.sourceId)
      .maybeSingle();
    if (error) throw new Error("Could not read that onboarding task.");
    if (!data) throw new Error("That onboarding task does not exist.");
    const t = data as unknown as {
      title: string;
      detail: string | null;
      property_id: string | null;
      is_demo: boolean | null;
      archived_at: string | null;
    };
    if (t.is_demo) throw new Error("Demo tasks are never sent to Breezeway.");
    if (t.archived_at) throw new Error("Archived tasks are never sent to Breezeway.");
    propertyId = t.property_id;
    defaults = { title: t.title, description: t.detail, priority: null };
  }

  if (!propertyId) throw new Error("That record has no property, so it cannot reach Breezeway.");

  const { data: prop, error: propError } = await db
    .from("properties")
    .select("id, name, breezeway_property_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (propError) throw new Error("Could not read the property.");
  const property = prop as unknown as {
    id: string;
    name: string | null;
    breezeway_property_id: string | null;
  } | null;

  return { propertyId, property, defaults };
}

/** What the UI may offer for one record. Never throws for the "not eligible" case. */
export async function outboundEligibility(
  source: OutboundSource,
): Promise<BreezewayOutboundEligibility> {
  const enabled = await outboundEnabled();
  try {
    const { property } = await resolveSource(source);
    const homeId = property?.breezeway_property_id ?? null;
    if (!homeId) {
      return {
        enabled,
        eligible: false,
        reason: "This property is not mapped to Breezeway.",
        propertyName: property?.name ?? null,
        breezewayHomeId: null,
      };
    }
    if (homeId !== OUTBOUND_PILOT_HOME_ID) {
      return {
        enabled,
        eligible: false,
        reason: "Outbound task creation is limited to the approved pilot property.",
        propertyName: property?.name ?? null,
        breezewayHomeId: homeId,
      };
    }
    return {
      enabled,
      eligible: enabled,
      reason: enabled ? null : "Breezeway outbound task creation is switched off.",
      propertyName: property?.name ?? null,
      breezewayHomeId: homeId,
    };
  } catch (error) {
    return {
      enabled,
      eligible: false,
      reason: error instanceof Error ? error.message : "Not eligible.",
      propertyName: null,
      breezewayHomeId: null,
    };
  }
}

export async function listOutboundLinks(source: OutboundSource): Promise<BreezewayOutboundLink[]> {
  const db = await admin();
  const column = source.sourceType === "ticket" ? "ticket_id" : "onboarding_task_id";
  const { data, error } = await db
    .from("breezeway_outbound_tasks")
    .select(SELECT)
    .eq(column, source.sourceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not read the Breezeway link history.");
  return ((data ?? []) as unknown as Row[]).map(toLink);
}

async function rowByRequestKey(requestKey: string) {
  const db = await admin();
  const { data } = await db
    .from("breezeway_outbound_tasks")
    .select(SELECT)
    .eq("request_key", requestKey)
    .maybeSingle();
  return (data as unknown as Row | null) ?? null;
}

function clean(value: string | null, max: number) {
  const v = (value ?? "").trim();
  return v ? v.slice(0, max) : null;
}

/**
 * Creates ONE Breezeway task for a Resolve record. Safe to call twice with the
 * same request key: the second call returns the first result without touching
 * Breezeway.
 */
export async function createOutboundTask(
  input: CreateOutboundInput,
  actorId: string,
): Promise<{ ok: true; link: BreezewayOutboundLink } | { ok: false; message: string }> {
  const existing = await rowByRequestKey(input.requestKey);
  if (existing) return { ok: true, link: toLink(existing) };

  if (!(await outboundEnabled())) {
    return { ok: false, message: "Breezeway outbound task creation is switched off." };
  }

  const { propertyId, property, defaults } = await resolveSource(input);
  const homeId = property?.breezeway_property_id ?? null;
  if (homeId !== OUTBOUND_PILOT_HOME_ID) {
    return {
      ok: false,
      message: "Outbound task creation is limited to the approved pilot property.",
    };
  }

  const title = clean(input.title, 200) ?? defaults?.title ?? "Resolve task";
  const description = clean(input.description, 4000) ?? defaults?.description ?? null;
  const department = BREEZEWAY_DEPARTMENTS.includes(
    (input.department ?? "") as (typeof BREEZEWAY_DEPARTMENTS)[number],
  )
    ? input.department
    : null;
  const priority = BREEZEWAY_PRIORITIES.includes(
    (input.priority ?? "") as (typeof BREEZEWAY_PRIORITIES)[number],
  )
    ? input.priority
    : null;

  const db = await admin();
  const insert = await db
    .from("breezeway_outbound_tasks")
    .insert({
      source_type: input.sourceType,
      ticket_id: input.sourceType === "ticket" ? input.sourceId : null,
      onboarding_task_id: input.sourceType === "onboarding_task" ? input.sourceId : null,
      property_id: propertyId,
      breezeway_home_id: homeId,
      request_key: input.requestKey,
      status: "creating",
      title,
      description,
      department,
      priority,
      scheduled_date: input.scheduledDate,
      scheduled_time: input.scheduledTime,
      attempts: 1,
      created_by: actorId,
    })
    .select(SELECT)
    .single();

  if (insert.error) {
    // 23505: either the same request key raced us (return that row) or another
    // creation for this record is already in flight (refuse, never duplicate).
    if (insert.error.code === "23505") {
      const raced = await rowByRequestKey(input.requestKey);
      if (raced) return { ok: true, link: toLink(raced) };
      return {
        ok: false,
        message: "A Breezeway task for this record is already being created.",
      };
    }
    return { ok: false, message: "Could not record the Breezeway request." };
  }

  const row = insert.data as unknown as Row;

  try {
    const created = await breezewayRequest<{ id?: number; task?: { id?: number } }>("/task/", {
      method: "POST",
      allowWrite: true,
      body: {
        home_id: Number(homeId),
        name: title,
        ...(description ? { description } : {}),
        ...(department ? { type_department: department } : {}),
        ...(priority ? { type_priority: priority } : {}),
        ...(input.scheduledDate ? { scheduled_date: input.scheduledDate } : {}),
        ...(input.scheduledTime ? { scheduled_time: input.scheduledTime } : {}),
      },
    });
    const taskId = created?.id ?? created?.task?.id ?? null;
    const update = await db
      .from("breezeway_outbound_tasks")
      .update({
        status: "created",
        breezeway_task_id: typeof taskId === "number" ? taskId : null,
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", row.id)
      .select(SELECT)
      .single();
    if (update.error) {
      // The task exists in Breezeway; only our bookkeeping failed. Never retry
      // the write on the back of this — that is how duplicates happen.
      console.error(`[breezeway-outbound] created task but could not record id (${update.error.code})`);
      return {
        ok: false,
        message:
          "The Breezeway task was created but Resolve could not record it. Check Breezeway before trying again.",
      };
    }
    return { ok: true, link: toLink(update.data as unknown as Row) };
  } catch (error) {
    const message =
      error instanceof BreezewayError ? error.message : "Breezeway did not accept the task.";
    await db
      .from("breezeway_outbound_tasks")
      .update({ status: "error", error_message: message })
      .eq("id", row.id);
    return { ok: false, message };
  }
}

/**
 * Reconciliation: called from the verified webhook path when Breezeway reports
 * an update for a task Resolve created. Records that Breezeway acknowledged it.
 * Never changes Resolve ticket state — Resolve stays the source of truth.
 */
export async function noteOutboundWebhook(breezewayTaskId: number) {
  const db = await admin();
  const now = new Date().toISOString();
  await db
    .from("breezeway_outbound_tasks")
    .update({ status: "synced", last_webhook_at: now, last_synced_at: now })
    .eq("breezeway_task_id", breezewayTaskId);
}
