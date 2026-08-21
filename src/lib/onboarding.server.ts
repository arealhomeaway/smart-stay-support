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
import type { HandoffCheck } from "./onboarding";
import { writeAudit } from "./audit.server";

type Client = SupabaseClient<Database>;

const PROPERTY_FIELDS =
  "id, name, nickname, address_line1, city, state, postal_code, latitude, longitude, access_notes, wifi_notes, lifecycle_status, onboarding_stage, onboarding_owner, onboarding_started_at, handoff_accepted_at, quarterly_review_due_on, active";

async function assertCap(supabase: Client, userId: string, fn: "is_supervisor" | "is_onboarding_staff") {
  const { data, error } = await supabase.rpc(fn, { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

export async function loadOnboardingWorkspace(supabase: Client) {
  const [props, tasks, handoffs, people] = await Promise.all([
    supabase.from("properties").select(PROPERTY_FIELDS).order("name"),
    supabase.from("onboarding_tasks").select("*").order("due_on", { nullsFirst: false }),
    supabase
      .from("property_handoffs")
      .select("*")
      .order("requested_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);
  if (props.error) throw props.error;
  if (tasks.error) throw tasks.error;
  if (handoffs.error) throw handoffs.error;

  const lifecycleOf = (p: (typeof props.data)[number]) => p.lifecycle_status ?? "active_operations";
  const inPipeline = (props.data ?? []).filter(
    (p) => lifecycleOf(p) !== "active_operations" && lifecycleOf(p) !== "offboarded",
  );

  return {
    properties: props.data ?? [],
    pipeline: inPipeline.map((p) => p.id),
    tasks: tasks.data ?? [],
    handoffs: handoffs.data ?? [],
    people: people.data ?? [],
  };
}

/** Deterministic readiness gate. Every rule reads real records only. */
export function validateHandoff(
  property: {
    address_line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
    access_notes: string | null;
    quarterly_review_due_on: string | null;
  },
  tasks: {
    id: string;
    status: string;
    blocks_handoff: boolean;
    requires_owner_approval: boolean;
    owner_approval_status: string;
    evidence_required: boolean;
    evidence_note: string | null;
    blocker: string | null;
  }[],
): { checks: HandoffCheck[]; openBlocking: string[]; ready: boolean } {
  const open = tasks.filter((t) => t.status !== "complete" && t.status !== "carryover");
  const openBlocking = open.filter((t) => t.blocks_handoff).map((t) => t.id);
  const missingApproval = tasks.filter(
    (t) => t.requires_owner_approval && t.owner_approval_status !== "approved",
  );
  const missingEvidence = tasks.filter(
    (t) => t.evidence_required && !(t.evidence_note ?? "").trim() && t.status === "complete",
  );
  const blockers = tasks.filter((t) => (t.blocker ?? "").trim() && t.status !== "complete");

  const checks: HandoffCheck[] = [
    {
      key: "address",
      label: "Property address is complete",
      passed: Boolean(property.address_line1 && property.city && property.state && property.postal_code),
      blocking: true,
      detail: "Street, city, state and postal code are required for dispatch and mapping.",
    },
    {
      key: "geocode",
      label: "Property is geocoded",
      passed: property.latitude != null && property.longitude != null,
      blocking: true,
      detail: "Needed for nearest-vendor dispatch, the job map and verified check-ins.",
    },
    {
      key: "access",
      label: "Access instructions recorded",
      passed: Boolean((property.access_notes ?? "").trim()),
      blocking: true,
      detail: "Operations cannot dispatch a vendor to a home with no access path.",
    },
    {
      key: "review_due",
      label: "Quarterly review date set",
      passed: Boolean(property.quarterly_review_due_on),
      blocking: false,
      detail: "The first cleaning-supervisor review must be scheduled.",
    },
    {
      key: "tasks",
      label: "Blocking onboarding tasks complete",
      passed: openBlocking.length === 0,
      blocking: true,
      detail: `${openBlocking.length} blocking task(s) still open.`,
    },
    {
      key: "approvals",
      label: "Owner approvals obtained",
      passed: missingApproval.length === 0,
      blocking: true,
      detail: `${missingApproval.length} task(s) awaiting a homeowner decision.`,
    },
    {
      key: "evidence",
      label: "Required evidence captured",
      passed: missingEvidence.length === 0,
      blocking: true,
      detail: `${missingEvidence.length} completed task(s) missing required evidence.`,
    },
    {
      key: "blockers",
      label: "No unresolved blockers",
      passed: blockers.length === 0,
      blocking: true,
      detail: `${blockers.length} task(s) carry an unresolved blocker note.`,
    },
  ];

  return { checks, openBlocking, ready: checks.every((c) => !c.blocking || c.passed) };
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

  const { data, error } = await supabase
    .from("onboarding_tasks")
    .insert({ ...row, created_by: userId })
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
  return { id: data.id };
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
      notes: input.notes || null,
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
  input: { handoffId: string; decision: "accepted" | "returned"; corrections: string },
) {
  await assertCap(supabase, userId, "is_supervisor");
  if (input.decision === "returned" && !input.corrections.trim()) {
    throw new Error("Returning a handoff requires the corrections that are needed.");
  }

  const handoff = await supabase
    .from("property_handoffs")
    .select("id, property_id, status")
    .eq("id", input.handoffId)
    .single();
  if (handoff.error) throw handoff.error;
  if (handoff.data.status !== "requested") throw new Error("This handoff was already reviewed.");

  const now = new Date().toISOString();
  const upd = await supabase
    .from("property_handoffs")
    .update({
      status: input.decision,
      reviewed_by: userId,
      reviewed_at: now,
      corrections: input.corrections || null,
    })
    .eq("id", input.handoffId)
    .eq("status", "requested");
  if (upd.error) throw upd.error;

  // Only an accepted handoff turns a home into an operational property.
  await supabase
    .from("properties")
    .update(
      input.decision === "accepted"
        ? { lifecycle_status: "active_operations", handoff_accepted_at: now }
        : { lifecycle_status: "handoff_corrections" },
    )
    .eq("id", handoff.data.property_id);

  // Unfinished work is preserved as carryover — never closed or reset.
  if (input.decision === "accepted") {
    await supabase
      .from("onboarding_tasks")
      .update({ status: "carryover" })
      .eq("property_id", handoff.data.property_id)
      .in("status", ["open", "blocked"]);
  }

  await writeAudit({
    actorId: userId,
    action: input.decision === "accepted" ? "handoff_accepted" : "handoff_returned",
    entityType: "property",
    entityId: handoff.data.property_id,
    reason: input.corrections || null,
    after: { handoffId: input.handoffId },
  });

  return { ok: true as const };
}
