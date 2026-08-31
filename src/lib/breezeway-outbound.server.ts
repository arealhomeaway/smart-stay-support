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
  type BreezewayOutboundReviewItem,
  type BreezewayOutboundStatus,
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
  status: BreezewayOutboundStatus;
  title: string;
  department: string | null;
  priority: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  error_message: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  last_synced_at: string | null;
  last_webhook_at: string | null;
  property_id: string | null;
  breezeway_home_id: string | null;
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
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    lastSyncedAt: row.last_synced_at,
    lastWebhookAt: row.last_webhook_at,
  };
}

const SELECT =
  "id, source_type, ticket_id, onboarding_task_id, breezeway_task_id, status, title, department, priority, scheduled_date, scheduled_time, error_message, review_note, reviewed_at, created_at, last_synced_at, last_webhook_at, property_id, breezeway_home_id";

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

export type CreateOutboundResult =
  | { ok: true; link: BreezewayOutboundLink }
  | { ok: false; message: string; link?: BreezewayOutboundLink };

/**
 * Reports the true state of a previous attempt carrying the same request key.
 * Returning a bare `ok: true` here would tell the operator a task exists when
 * the first attempt actually failed or is unresolved.
 */
function resultForExisting(row: Row): CreateOutboundResult {
  const link = toLink(row);
  if (row.status === "created" || row.status === "synced") return { ok: true, link };
  if (row.status === "creating") {
    return { ok: false, message: "This request is already being sent to Breezeway.", link };
  }
  if (row.status === "needs_review") {
    return {
      ok: false,
      message:
        "The earlier attempt is unresolved — Resolve cannot tell whether Breezeway created it. An admin must check Breezeway before it is sent again.",
      link,
    };
  }
  if (row.status === "abandoned") {
    return {
      ok: false,
      message: "This attempt was reviewed and closed. Start a new send if the work is still needed.",
      link,
    };
  }
  return {
    ok: false,
    message: row.error_message ?? "The earlier attempt failed. Nothing was created in Breezeway.",
    link,
  };
}

/**
 * Creates ONE Breezeway task for a Resolve record. Safe to call twice with the
 * same request key: the second call returns the first result without touching
 * Breezeway.
 */
export async function createOutboundTask(
  input: CreateOutboundInput,
  actorId: string,
): Promise<CreateOutboundResult> {
  // Idempotent fast path. The earlier attempt's REAL state is reported —
  // a failed or uncertain first attempt must never look like a success.
  const existing = await rowByRequestKey(input.requestKey);
  if (existing) return resultForExisting(existing);

  if (!(await outboundEnabled())) {
    return { ok: false, message: "Breezeway outbound task creation is switched off." };
  }

  // Guard failures (missing record, demo, archived, no property) are turned
  // into a sanitized refusal — they are never surfaced as thrown errors.
  let resolved: Awaited<ReturnType<typeof resolveSource>>;
  try {
    resolved = await resolveSource(input);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "That record cannot be sent to Breezeway.",
    };
  }
  const { propertyId, property, defaults } = resolved;
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
      if (raced) return resultForExisting(raced);
      return {
        ok: false,
        message:
          "Another Breezeway request for this record is still open (being created, or awaiting admin review). It must resolve first.",
      };
    }
    return { ok: false, message: "Could not record the Breezeway request." };
  }

  const row = insert.data as unknown as Row;

  try {
    const created = await breezewayRequest<{ id?: number; task?: { id?: number } }>("/task/", {
      method: "POST",
      allowWrite: true,
      // Non-idempotent: a 429/5xx may still have created the task, so a retry
      // would create a second one. Failures land in admin review instead.
      retry: false,
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
      await markNeedsReview(
        row.id,
        "Breezeway accepted the task but Resolve could not record the task id.",
      );
      const stuck = await rowById(row.id);
      return {
        ok: false,
        message:
          "The Breezeway task was created but Resolve could not record it. It is flagged for admin review — do not send it again.",
        ...(stuck ? { link: toLink(stuck) } : {}),
      };
    }
    return { ok: true, link: toLink(update.data as unknown as Row) };
  } catch (error) {
    const message =
      error instanceof BreezewayError ? error.message : "Breezeway did not respond.";
    // A 4xx is a definite refusal — nothing was created, so the row is closed
    // as an error and the operator may safely try again. Anything else
    // (timeout, network drop, 429/5xx) is UNCERTAIN: the task may exist in
    // Breezeway. Those are never retried automatically and never reported as
    // a plain failure — they go to the admin review queue.
    const certainRefusal =
      error instanceof BreezewayError && error.status >= 400 && error.status < 500 &&
      error.status !== 408 && error.status !== 429;

    if (certainRefusal) {
      await db
        .from("breezeway_outbound_tasks")
        .update({ status: "error", error_message: message })
        .eq("id", row.id);
      const failed = await rowById(row.id);
      return { ok: false, message, ...(failed ? { link: toLink(failed) } : {}) };
    }

    await markNeedsReview(row.id, message);
    const uncertain = await rowById(row.id);
    return {
      ok: false,
      message:
        `${message} Resolve cannot tell whether the task was created, so it is flagged for admin review. Do not send it again until someone checks Breezeway.`,
      ...(uncertain ? { link: toLink(uncertain) } : {}),
    };
  }
}

async function rowById(id: string): Promise<Row | null> {
  const db = await admin();
  const { data } = await db
    .from("breezeway_outbound_tasks")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Row | null) ?? null;
}

async function markNeedsReview(id: string, message: string) {
  const db = await admin();
  await db
    .from("breezeway_outbound_tasks")
    .update({ status: "needs_review", error_message: message })
    .eq("id", id);
}

/* ------------------------------------------------------------------ */
/* Admin recovery for uncertain records                                */
/* ------------------------------------------------------------------ */

/**
 * Every unresolved outbound record: still creating, or flagged for review.
 * This is the admin queue — nothing here is retried automatically.
 */
export async function listOutboundNeedingReview(): Promise<BreezewayOutboundReviewItem[]> {
  const db = await admin();
  const { data, error } = await db
    .from("breezeway_outbound_tasks")
    .select(SELECT)
    .in("status", ["creating", "needs_review"])
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error("Could not read the Breezeway review queue.");
  const rows = (data ?? []) as unknown as Row[];
  if (!rows.length) return [];

  const propertyIds = [...new Set(rows.map((r) => r.property_id).filter(Boolean))] as string[];
  const names = new Map<string, string | null>();
  if (propertyIds.length) {
    const { data: props } = await db.from("properties").select("id, name").in("id", propertyIds);
    for (const p of (props ?? []) as unknown as { id: string; name: string | null }[]) {
      names.set(p.id, p.name);
    }
  }

  return rows.map((row) => ({
    ...toLink(row),
    propertyName: row.property_id ? (names.get(row.property_id) ?? null) : null,
    sourceTitle: row.title,
  }));
}

/**
 * Admin reconciliation of ONE uncertain record.
 *
 * `link`  — the admin found the task in Breezeway and types its id. The id is
 *           verified against Breezeway (it must exist AND belong to the pilot
 *           property) before it is accepted, so a typo cannot bind Resolve to
 *           someone else's task.
 * `abandon` — the admin confirmed no task exists. The row is closed, which
 *           also releases the in-flight lock so the work can be sent again.
 *
 * Neither branch ever calls the Breezeway create endpoint.
 */
export async function reconcileOutboundTask(
  input: { id: string; action: "link" | "abandon"; breezewayTaskId?: number | null; note: string },
  actorId: string,
): Promise<{ ok: true; link: BreezewayOutboundLink } | { ok: false; message: string }> {
  const row = await rowById(input.id);
  if (!row) return { ok: false, message: "That Breezeway record no longer exists." };
  if (row.status !== "needs_review" && row.status !== "creating") {
    return { ok: false, message: "That record is already resolved." };
  }

  const db = await admin();
  const now = new Date().toISOString();
  const note = input.note.trim().slice(0, 500) || null;

  if (input.action === "abandon") {
    const { data, error } = await db
      .from("breezeway_outbound_tasks")
      .update({
        status: "abandoned",
        reviewed_by: actorId,
        reviewed_at: now,
        review_note: note,
      })
      .eq("id", row.id)
      .select(SELECT)
      .single();
    if (error) return { ok: false, message: "Could not close that record." };
    return { ok: true, link: toLink(data as unknown as Row) };
  }

  const taskId = Number(input.breezewayTaskId);
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return { ok: false, message: "Enter the Breezeway task id you found." };
  }

  // Verify before binding: read-only, and it must be the pilot property.
  let verified: { id?: number; home_id?: number } | null = null;
  try {
    verified = await breezewayRequest<{ id?: number; home_id?: number }>(`/task/${taskId}`);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof BreezewayError
          ? `Could not confirm that task in Breezeway: ${error.message}`
          : "Could not reach Breezeway to confirm that task.",
    };
  }
  if (!verified || String(verified.home_id ?? "") !== OUTBOUND_PILOT_HOME_ID) {
    return {
      ok: false,
      message: "That Breezeway task does not exist on the pilot property.",
    };
  }

  const { data, error } = await db
    .from("breezeway_outbound_tasks")
    .update({
      status: "created",
      breezeway_task_id: taskId,
      error_message: null,
      last_synced_at: now,
      reviewed_by: actorId,
      reviewed_at: now,
      review_note: note,
    })
    .eq("id", row.id)
    .select(SELECT)
    .single();
  if (error) {
    // 23505 here means that Breezeway task is already recorded against
    // another Resolve record — never bind it twice.
    if (error.code === "23505") {
      return { ok: false, message: "That Breezeway task is already linked to another record." };
    }
    return { ok: false, message: "Could not record that Breezeway task id." };
  }
  return { ok: true, link: toLink(data as unknown as Row) };
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
