/**
 * Onboarding lifecycle + controlled handoff (server-only).
 *
 * Onboarding runs on the EXISTING property record and its immutable Property
 * ID. Pre-handoff work lives in `onboarding_tasks` so it can never be confused
 * with an operational matter, and nothing is silently converted or reset: open
 * items either block the handoff or are accepted as carryover with an owner,
 * a due date and a reason.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { validateHandoff } from "./onboarding";
export { validateHandoff };
import { writeAudit } from "./audit.server";

type Client = SupabaseClient<Database>;

const PROPERTY_FIELDS =
  "id, name, nickname, address_line1, city, state, postal_code, latitude, longitude, access_notes, wifi_notes, lifecycle_status, onboarding_stage, onboarding_owner, onboarding_started_at, handoff_accepted_at, quarterly_review_due_on, active, is_demo";

async function assertCap(supabase: Client, userId: string, fn: "is_supervisor" | "is_onboarding_staff") {
  const { data, error } = await supabase.rpc(fn, { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

export async function loadOnboardingWorkspace(supabase: Client) {
  const [props, tasks, handoffs, people, notes, reviews, extDbs, extRecords, docs] = await Promise.all([
    supabase.from("properties").select(PROPERTY_FIELDS).order("name"),
    supabase.from("onboarding_tasks").select("*").is("archived_at", null).order("sort_order"),
    supabase
      .from("property_handoffs")
      .select("*")
      .is("archived_at", null)
      .order("requested_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase
      .from("onboarding_notes")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("handoff_reviews").select("*").order("created_at", { ascending: false }),
    supabase.from("external_databases").select("*").is("archived_at", null).order("label"),
    supabase.from("external_records").select("*").is("archived_at", null).order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, entity_type, entity_id, title, kind, external_url, required, note, created_at")
      .eq("entity_type", "property")
      .is("archived_at", null),
  ]);
  if (props.error) throw props.error;
  if (tasks.error) throw tasks.error;
  if (handoffs.error) throw handoffs.error;

  const lifecycleOf = (p: (typeof props.data)[number]) => p.lifecycle_status ?? "active_operations";
  const inPipeline = (props.data ?? []).filter(
    (p) => lifecycleOf(p) !== "active_operations" && lifecycleOf(p) !== "offboarded",
  );

  // Homeowner decisions and their history — staff read-only.
  const ownerApprovals = await supabase
    .from("approvals")
    .select(
      "id, entity_type, entity_id, property_id, kind, title, detail, status, decision_note, decided_at, approver_id, due_on, created_at",
    )
    .eq("approver_role", "owner")
    .order("created_at", { ascending: false })
    .limit(200);

  return {
    properties: props.data ?? [],
    pipeline: inPipeline.map((p) => p.id),
    tasks: tasks.data ?? [],
    handoffs: handoffs.data ?? [],
    people: people.data ?? [],
    notes: notes.data ?? [],
    reviews: reviews.data ?? [],
    externalDatabases: extDbs.data ?? [],
    externalRecords: extRecords.data ?? [],
    documents: docs.data ?? [],
    ownerApprovals: ownerApprovals.data ?? [],
  };
}



export async function saveOnboardingTask(
  supabase: Client,
  userId: string,
  input: {
    id?: string | undefined;
    propertyId: string;
    stage: string;
    title: string;
    detail: string;
    assignedTo: string | null;
    dueOn: string | null;
    blocker: string;
    requiresOwnerApproval: boolean;
    ownerApprovalStatus: string;
    evidenceRequired: boolean;
    evidenceNote: string;
    status: string;
    blocksHandoff: boolean;
    parentTaskId?: string | null | undefined;
    dependsOn?: string[] | undefined;
    sortOrder?: number | undefined;
    linkedTicketId?: string | null | undefined;
  },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const row = {
    property_id: input.propertyId,
    stage: input.stage,
    title: input.title,
    detail: input.detail || null,
    assigned_to: input.assignedTo,
    due_on: input.dueOn,
    blocker: input.blocker || null,
    requires_owner_approval: input.requiresOwnerApproval,
    owner_approval_status: input.requiresOwnerApproval ? input.ownerApprovalStatus : "not_required",
    evidence_required: input.evidenceRequired,
    evidence_note: input.evidenceNote || null,
    status: input.status,
    blocks_handoff: input.blocksHandoff,
    completed_at: input.status === "complete" ? new Date().toISOString() : null,
    completed_by: input.status === "complete" ? userId : null,
    parent_task_id: input.parentTaskId ?? null,
    depends_on: input.dependsOn ?? [],
    sort_order: input.sortOrder ?? 0,
    linked_ticket_id: input.linkedTicketId ?? null,
  };

  if (input.id) {
    const { error } = await supabase.from("onboarding_tasks").update(row).eq("id", input.id);
    if (error) throw error;
    await writeAudit({
      actorId: userId,
      action: "onboarding_task_updated",
      entityType: "onboarding_task",
      entityId: input.id,
      entityLabel: input.title,
      after: row,
    });
    return { id: input.id };
  }

  // Test/demo homes must keep their whole paper trail out of live reporting.
  const parent = await supabase
    .from("properties")
    .select("is_demo")
    .eq("id", input.propertyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert({ ...row, created_by: userId, is_demo: parent.data?.is_demo ?? false })
    .select("id")
    .single();
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_task_created",
    entityType: "onboarding_task",
    entityId: data.id,
    entityLabel: input.title,
    after: row,
  });
  if (input.requiresOwnerApproval) {
    await ensureOwnerApprovalRequest(supabase, userId, {
      taskId: data.id,
      propertyId: input.propertyId,
      title: input.title,
      detail: input.detail,
      dueOn: input.dueOn,
      isDemo: parent.data?.is_demo ?? false,
    });
  }
  return { id: data.id };
}

/**
 * Create the homeowner-facing decision record for a task that needs owner
 * approval. It is addressed to the homeowner enrolled on that property; if no
 * homeowner is linked yet, nothing is created and staff keep the task as
 * pending. Never creates a second request for the same task.
 */
async function ensureOwnerApprovalRequest(
  supabase: Client,
  userId: string,
  input: {
    taskId: string;
    propertyId: string;
    title: string;
    detail: string;
    dueOn: string | null;
    isDemo: boolean;
  },
) {
  const existing = await supabase
    .from("approvals")
    .select("id")
    .eq("entity_type", "onboarding_task")
    .eq("entity_id", input.taskId)
    .maybeSingle();
  if (existing.data) return existing.data.id;

  const direct = await supabase
    .from("owner_programs")
    .select("owner_user_id")
    .eq("property_id", input.propertyId)
    .not("owner_user_id", "is", null)
    .maybeSingle();
  let ownerUserId = direct.data?.owner_user_id ?? null;
  if (!ownerUserId) {
    const linked = await supabase
      .from("owner_program_properties")
      .select("program_id, owner_programs!inner(owner_user_id)")
      .eq("property_id", input.propertyId)
      .limit(1)
      .maybeSingle();
    const rel = linked.data as { owner_programs?: { owner_user_id: string | null } } | null;
    ownerUserId = rel?.owner_programs?.owner_user_id ?? null;
  }
  if (!ownerUserId) return null;

  const { data, error } = await supabase
    .from("approvals")
    .insert({
      entity_type: "onboarding_task",
      entity_id: input.taskId,
      property_id: input.propertyId,
      kind: "onboarding_task",
      title: input.title,
      detail: input.detail || null,
      requested_by: userId,
      approver_id: ownerUserId,
      approver_role: "owner",
      status: "pending",
      due_on: input.dueOn,
      is_demo: input.isDemo,
    })
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}


export async function setPropertyLifecycle(
  supabase: Client,
  userId: string,
  input: { propertyId: string; status: string; stage?: string | null | undefined; reason: string },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const before = await supabase
    .from("properties")
    .select("lifecycle_status, onboarding_stage")
    .eq("id", input.propertyId)
    .maybeSingle();

  const patch: {
    lifecycle_status: string;
    onboarding_stage?: string | null;
    onboarding_started_at?: string;
    archived_at?: string;
  } = { lifecycle_status: input.status };
  if (input.stage !== undefined) patch.onboarding_stage = input.stage;
  if (input.status === "onboarding" && !before.data?.lifecycle_status?.startsWith("onboarding")) {
    patch.onboarding_started_at = new Date().toISOString();
  }
  if (input.status === "offboarded") patch.archived_at = new Date().toISOString();

  const { error } = await supabase.from("properties").update(patch).eq("id", input.propertyId);
  if (error) throw error;

  await writeAudit({
    actorId: userId,
    action: "property_lifecycle_changed",
    entityType: "property",
    entityId: input.propertyId,
    reason: input.reason,
    before: before.data,
    after: patch,
  });
  return { ok: true as const };
}

export async function requestHandoff(
  supabase: Client,
  userId: string,
  input: { propertyId: string; notes: string; carryoverAccepted: boolean },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");

  const [property, tasks] = await Promise.all([
    supabase.from("properties").select(PROPERTY_FIELDS).eq("id", input.propertyId).single(),
    supabase.from("onboarding_tasks").select("*").eq("property_id", input.propertyId),
  ]);
  if (property.error) throw property.error;
  if (tasks.error) throw tasks.error;

  const { checks, openBlocking, ready } = validateHandoff(property.data, tasks.data ?? []);
  if (!ready && !input.carryoverAccepted) {
    throw new Error(
      "Readiness checklist has blocking failures. Resolve them, or accept the open items as carryover work with an owner, due date and reason.",
    );
  }
  if (!ready && input.carryoverAccepted) {
    const missingCarryover = (tasks.data ?? []).filter(
      (t) =>
        openBlocking.includes(t.id) &&
        (!t.assigned_to || !t.due_on || !(t.carryover_reason ?? "").trim()),
    );
    if (missingCarryover.length) {
      throw new Error(
        "Every carried-over item needs an assigned owner, a due date and a carryover reason before handoff.",
      );
    }
  }

  const { data, error } = await supabase
    .from("property_handoffs")
    .insert({
      property_id: input.propertyId,
      status: "requested",
      requested_by: userId,
      checklist: checks as never,
      validation: { ready, openBlocking } as never,
      open_task_ids: openBlocking,
      carryover_accepted: input.carryoverAccepted && !ready,
      gate_step: "kati_review",
      notes: input.notes || null,
      // Inherit isolation from the home, so demo/test handoffs never count.
      is_demo: property.data.is_demo ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("properties")
    .update({ lifecycle_status: "handoff_requested" })
    .eq("id", input.propertyId);

  await writeAudit({
    actorId: userId,
    action: "handoff_requested",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: property.data.name,
    after: { handoffId: data.id, ready, openBlocking },
  });

  return { id: data.id, ready, checks };
}

export async function reviewHandoff(
  supabase: Client,
  userId: string,
  input: {
    handoffId: string;
    decision: "accepted" | "returned";
    corrections: string;
    exceptionReason?: string | undefined;
  },
) {
  const { nextGateStep } = await import("./onboarding");
  if (input.decision === "returned" && !input.corrections.trim()) {
    throw new Error("Returning a handoff requires the corrections that are needed.");
  }

  const handoff = await supabase
    .from("property_handoffs")
    .select("id, property_id, status, gate_step, exceptions, is_demo")
    .eq("id", input.handoffId)
    .single();
  if (handoff.error) throw handoff.error;
  // "accepted_pending_live" is still an open handoff: Operations has taken
  // ownership but the home is not live until the final confirmation.
  const OPEN = ["requested", "accepted_pending_live"];
  if (!OPEN.includes(handoff.data.status)) throw new Error("This handoff was already closed.");

  const step = (handoff.data.gate_step ?? "kati_review") as string;

  // Supervisors may record any gate. The assigned onboarding lead for THIS
  // home may record only its own onboarding review — by project assignment,
  // never by name and never for every onboarding user.
  const { data: isSupervisor } = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (!isSupervisor) {
    const lead = await supabase
      .from("properties")
      .select("onboarding_owner")
      .eq("id", handoff.data.property_id)
      .maybeSingle();
    const { data: isOnboarding } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "onboarding",
    });
    const isAssignedLead = Boolean(isOnboarding) && lead.data?.onboarding_owner === userId;
    if (!isAssignedLead || step !== "kati_review") {
      throw new Error("You do not have access to record this review step.");
    }
  }


  const now = new Date().toISOString();

  // Immutable history entry for every decision at every gate.
  const hist = await supabase.from("handoff_reviews").insert({
    handoff_id: input.handoffId,
    property_id: handoff.data.property_id,
    step,
    decision: input.decision,
    reviewer_id: userId,
    note: input.corrections || null,
    exception_reason: input.exceptionReason || null,
    is_demo: handoff.data.is_demo ?? false,
  });
  if (hist.error) throw hist.error;

  if (input.decision === "returned") {
    const upd = await supabase
      .from("property_handoffs")
      .update({
        status: "returned",
        reviewed_by: userId,
        reviewed_at: now,
        corrections: input.corrections || null,
      })
      .eq("id", input.handoffId)
      .in("status", OPEN);
    if (upd.error) throw upd.error;
    await supabase
      .from("properties")
      .update({ lifecycle_status: "handoff_corrections" })
      .eq("id", handoff.data.property_id);
    await writeAudit({
      actorId: userId,
      action: "handoff_returned",
      entityType: "property",
      entityId: handoff.data.property_id,
      reason: input.corrections || null,
      after: { handoffId: input.handoffId, step },
    });
    return { ok: true as const, step, status: "returned" as const };
  }

  const next = nextGateStep(step);
  const patch: Record<string, unknown> = { gate_step: next };
  if (input.exceptionReason) {
    const existing = Array.isArray(handoff.data.exceptions) ? (handoff.data.exceptions as unknown[]) : [];
    patch['exceptions'] = [...existing, { step, reason: input.exceptionReason, by: userId, at: now }];
  }
  if (step === "kati_review") {
    patch['kati_reviewer'] = userId;
    patch['kati_decision'] = "approved";
    patch['kati_note'] = input.corrections || null;
    patch['kati_at'] = now;
  }
  if (step === "micah_review") {
    patch['micah_reviewer'] = userId;
    patch['micah_decision'] = "approved";
    patch['micah_note'] = input.corrections || null;
    patch['micah_at'] = now;
  }
  if (step === "operations_acceptance") {
    patch['accepted_by'] = userId;
    patch['accepted_at'] = now;
    patch['reviewed_by'] = userId;
    patch['reviewed_at'] = now;
    // Operations has taken ownership, but the home is not live yet.
    patch['status'] = "accepted_pending_live";
  }
  if (step === "live_confirmation") {
    patch['live_confirmed_by'] = userId;
    patch['live_confirmed_at'] = now;
    patch['status'] = "accepted";
  }

  const upd = await supabase
    .from("property_handoffs")
    .update(patch as never)
    .eq("id", input.handoffId)
    .in("status", OPEN);
  if (upd.error) throw upd.error;

  if (step === "operations_acceptance") {
    // Acceptance only moves the property into the pending-live stage.
    await supabase
      .from("properties")
      .update({ onboarding_stage: "pending_live_confirmation", handoff_accepted_at: now })
      .eq("id", handoff.data.property_id);
    // Unfinished work is preserved as carryover — never closed or reset.
    await supabase
      .from("onboarding_tasks")
      .update({ status: "carryover" })
      .eq("property_id", handoff.data.property_id)
      .in("status", ["open", "blocked"]);
  }

  // Only the final live confirmation makes a home operational.
  if (step === "live_confirmation") {
    await supabase
      .from("properties")
      .update({ lifecycle_status: "active_operations", active: true })
      .eq("id", handoff.data.property_id);
  }

  await writeAudit({
    actorId: userId,
    action: "handoff_step_approved",
    entityType: "property",
    entityId: handoff.data.property_id,
    reason: input.exceptionReason || input.corrections || null,
    after: { handoffId: input.handoffId, step, next },
  });

  return {
    ok: true as const,
    step,
    status: (step === "live_confirmation"
      ? "accepted"
      : step === "operations_acceptance"
        ? "accepted_pending_live"
        : "requested") as "accepted" | "accepted_pending_live" | "requested",
  };
}


/* ------------------------------------------------------------------ *
 * Stage 2 additions: internal notes, exceptions, matter links,
 * archiving and the standard external-record review queue.
 * ------------------------------------------------------------------ */

export async function addOnboardingNote(
  supabase: Client,
  userId: string,
  input: { propertyId: string; taskId?: string | null | undefined; body: string; mentions: string[] },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const { data, error } = await supabase
    .from("onboarding_notes")
    .insert({
      property_id: input.propertyId,
      task_id: input.taskId ?? null,
      body: input.body,
      mentions: input.mentions,
      internal: true,
      author_id: userId,
    })
    .select("id")
    .single();
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_note_added",
    entityType: "property",
    entityId: input.propertyId,
    after: { noteId: data.id, mentions: input.mentions },
  });
  return { id: data.id };
}

export async function recordTaskException(
  supabase: Client,
  userId: string,
  input: { taskId: string; reason: string },
) {
  await assertCap(supabase, userId, "is_supervisor");
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("onboarding_tasks")
    .update({ exception_reason: input.reason, exception_by: userId, exception_at: now })
    .eq("id", input.taskId);
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_exception_recorded",
    entityType: "onboarding_task",
    entityId: input.taskId,
    reason: input.reason,
  });
  return { ok: true as const };
}

export async function archiveOnboardingTask(
  supabase: Client,
  userId: string,
  input: { taskId: string; reason: string },
) {
  await assertCap(supabase, userId, "is_supervisor");
  const { error } = await supabase
    .from("onboarding_tasks")
    .update({ archived_at: new Date().toISOString(), archived_by: userId })
    .eq("id", input.taskId);
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_task_archived",
    entityType: "onboarding_task",
    entityId: input.taskId,
    reason: input.reason,
  });
  return { ok: true as const };
}

/**
 * Canonical property matching for any external database (Notion, Fillout
 * replacements, the Property Utility Matrix — all identical). Matching is by
 * Resolve property UUID or OwnerRez Property ID only. Never by name, and a
 * record never creates a property.
 */
export async function resolveExternalRecord(
  supabase: Client,
  userId: string,
  input: {
    recordId: string;
    propertyId?: string | null | undefined;
    ownerrezPropertyId?: string | null | undefined;
    decision: "match" | "review" | "archive";
    note: string;
  },
) {
  await assertCap(supabase, userId, "is_onboarding_staff");
  const now = new Date().toISOString();

  if (input.decision === "archive") {
    const { error } = await supabase
      .from("external_records")
      .update({ archived_at: now, match_status: "archived", match_note: input.note || null })
      .eq("id", input.recordId);
    if (error) throw error;
    return { ok: true as const };
  }

  if (input.decision === "review") {
    const { error } = await supabase
      .from("external_records")
      .update({ match_status: "review", match_note: input.note || null })
      .eq("id", input.recordId);
    if (error) throw error;
    return { ok: true as const };
  }

  let propertyId = input.propertyId ?? null;
  if (!propertyId && input.ownerrezPropertyId) {
    const { data } = await supabase
      .from("properties")
      .select("id")
      .eq("ownerrez_property_id", input.ownerrezPropertyId)
      .maybeSingle();
    propertyId = data?.id ?? null;
  }
  if (!propertyId) {
    throw new Error(
      "A record can only be matched with a Resolve property ID or an OwnerRez Property ID. Names are never used.",
    );
  }

  const { error } = await supabase
    .from("external_records")
    .update({
      property_id: propertyId,
      ownerrez_property_id: input.ownerrezPropertyId ?? null,
      match_status: "matched",
      match_note: input.note || null,
      matched_by: userId,
      matched_at: now,
    })
    .eq("id", input.recordId);
  if (error) throw error;

  await writeAudit({
    actorId: userId,
    action: "external_record_matched",
    entityType: "property",
    entityId: propertyId,
    reason: input.note || null,
    after: { recordId: input.recordId },
  });
  return { ok: true as const };
}
