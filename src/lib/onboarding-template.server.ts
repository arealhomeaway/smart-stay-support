/**
 * Apply the ARHA "Full Furnishing" onboarding template to one property
 * (server-only).
 *
 * Rules:
 *  - Deduplicated. A task whose title already exists on the property (active,
 *    not archived) is skipped, so re-applying never doubles the plan.
 *  - Dates are NOT invented. A due date is written only for the tasks whose
 *    source instructions state the timing, and only when the matching anchor
 *    date is already recorded on the property. Everything else is left blank
 *    for the existing preview-and-confirm recalculation flow.
 *  - Demo/test properties propagate is_demo so the plan stays out of live KPIs.
 *  - No external system is touched: no Breezeway or OwnerRez
 *    writes. Breezeway template IDs are recorded as text on the task only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { masterStageForLegacyTask } from "./onboarding-stage-map";
import { MASTER_ONBOARDING_TEMPLATE, TEMPLATE_KEY, type TemplateTask } from "./onboarding-template";
import { offsetFromAccess, setupWindowDays } from "./onboarding-schedule";

import { writeAudit } from "./audit.server";
import { seatForTask, type SeatCode } from "./onboarding-ownership";

type Client = SupabaseClient<Database>;

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_onboarding_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

function shift(dateIso: string, days: number) {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function detailFor(t: TemplateTask) {
  const bits = [`Project plan role: ${t.role}`];
  if (t.breezewayTemplateId) {
    bits.push(`Breezeway template ID: ${t.breezewayTemplateId}`);
  }
  if (t.detail) bits.push(t.detail);
  return bits.join("\n\n");
}

/** seat code -> current holder's user id (null when the seat is vacant). */
export async function loadSeatHolders(supabase: Client) {
  const { data } = await supabase.from("functional_roles").select("code, current_seat_holder");
  const map = new Map<string, string | null>();
  for (const r of data ?? []) map.set(r.code, r.current_seat_holder ?? null);
  return map;
}

function seatFields(
  role: string | null | undefined,
  stage: string,
  holders: Map<string, string | null>,
) {
  const seat: SeatCode = seatForTask({ role: role ?? null, stage });
  return { assigned_seat: seat, assigned_to: holders.get(seat) ?? null };
}

export type TemplatePreview = {
  propertyId: string;
  templateKey: string;
  toCreate: { key: string; stage: string; title: string; dueOn: string | null; subtasks: number }[];
  subtasksToCreate: number;
  skipped: { title: string; reason: string }[];
  anchors: {
    planned_closing: string | null;
    actual_closing: string | null;
    actual_access: string | null;
  };
};

/**
 * Identity of a template row on a property. Title alone is NOT unique: the
 * ARHA plan legitimately repeats "Update project status" once per
 * phase and the weekly owner update twice, and subtasks such as "Record in Resolve"
 * repeat under different parents. Identity is therefore stage + title for
 * top-level tasks, and stage + parent + title for subtasks.
 */
function taskKey(stage: string, title: string) {
  return `${stage}::${title.trim().toLowerCase()}`;
}
function subKey(parentTaskId: string, title: string) {
  return `${parentTaskId}::${title.trim().toLowerCase()}`;
}

async function loadContext(supabase: Client, propertyId: string) {
  const property = await supabase
    .from("properties")
    .select("id, name, is_demo, planned_closing_on, actual_closing_on, actual_access_on")
    .eq("id", propertyId)
    .single();
  if (property.error) throw property.error;

  const existing = await supabase
    .from("onboarding_tasks")
    .select(
      "id, title, stage, parent_task_id, detail, due_on, requires_owner_approval, owner_approval_status",
    )
    .eq("property_id", propertyId)
    .is("archived_at", null);
  if (existing.error) throw existing.error;

  const anchors = {
    planned_closing: property.data.planned_closing_on,
    actual_closing: property.data.actual_closing_on,
    actual_access: property.data.actual_access_on,
  };
  const rows = existing.data ?? [];
  /**
   * A saved task that still sits under its old phase heading is the SAME task
   * as the one now filed under an operational stage. Both keys point at it, so
   * re-applying the plan recognises it in place instead of creating a twin.
   */
  const keysFor = (row: { stage: string; title: string }) => {
    const keys = [taskKey(row.stage, row.title)];
    const moved = masterStageForLegacyTask(row.stage, row.title);
    if (moved) keys.push(taskKey(moved, row.title));
    return keys;
  };
  // Subtasks never block a top-level task from being created, and vice versa.
  const taken = new Set(rows.filter((t) => !t.parent_task_id).flatMap(keysFor));
  const takenSubs = new Set(
    rows.filter((t) => t.parent_task_id).map((t) => subKey(t.parent_task_id as string, t.title)),
  );
  const parentIdByKey = new Map(
    rows
      .filter((t) => !t.parent_task_id)
      .flatMap((t) => keysFor(t).map((key) => [key, t.id] as const)),
  );
  return { property: property.data, anchors, taken, takenSubs, parentIdByKey, existing: rows };
}

/**
 * Access (possession) is the anchor the whole plan dates itself from. When the
 * property has an access date every step gets a deadline: the Asana steps keep
 * their stated day, the rest are paced across the setup window. Without an
 * access date the older per-task anchors still apply, and anything else stays
 * blank rather than being invented.
 */
function dueFor(
  t: TemplateTask,
  anchors: TemplatePreview["anchors"],
  schedule?: { position: number; total: number; windowDays: number },
) {
  if (anchors.actual_access && schedule) {
    return shift(
      anchors.actual_access,
      offsetFromAccess({ title: t.title, ...schedule }),
    );
  }
  if (!t.anchor || t.offsetDays == null) return null;
  const base = anchors[t.anchor];
  return base ? shift(base, t.offsetDays) : null;
}


export async function previewOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: { propertyId: string },
): Promise<TemplatePreview> {
  await assertOnboardingStaff(supabase, userId);
  const { anchors, taken, takenSubs, parentIdByKey } = await loadContext(
    supabase,
    input.propertyId,
  );

  const toCreate: TemplatePreview["toCreate"] = [];
  const skipped: TemplatePreview["skipped"] = [];
  let subtasksToCreate = 0;
  for (const t of MASTER_ONBOARDING_TEMPLATE) {
    const parentId = parentIdByKey.get(taskKey(t.stage, t.title));
    subtasksToCreate += (t.subtasks ?? []).filter(
      (title) => !parentId || !takenSubs.has(subKey(parentId, title)),
    ).length;
    if (taken.has(taskKey(t.stage, t.title))) {
      skipped.push({ title: t.title, reason: "Already on this property" });
      continue;
    }
    toCreate.push({
      key: t.key,
      stage: t.stage,
      title: t.title,
      dueOn: dueFor(t, anchors),
      subtasks: t.subtasks?.length ?? 0,
    });
  }
  return {
    propertyId: input.propertyId,
    templateKey: TEMPLATE_KEY,
    toCreate,
    subtasksToCreate,
    skipped,
    anchors,
  };
}

export async function applyOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: { propertyId: string },
  audit: typeof writeAudit = writeAudit,
) {
  await assertOnboardingStaff(supabase, userId);
  const { property, anchors, taken, takenSubs, parentIdByKey, existing } = await loadContext(
    supabase,
    input.propertyId,
  );

  const pending = MASTER_ONBOARDING_TEMPLATE.filter((t) => !taken.has(taskKey(t.stage, t.title)));

  // Ownership: every task opens owned by a SEAT, and by the person holding
  // that seat today. Nothing is created unassigned.
  const seatHolders = await loadSeatHolders(supabase);

  // Active Owner Program participation for THIS home only (existing owner
  // enrollment is the source of truth — never the generic owner role).
  const { activeOwnerFor } = await import("./active-owner.server");
  const participation = await activeOwnerFor(supabase, input.propertyId);
  const needsOwnerApproval = (t: TemplateTask) =>
    Boolean(t.requiresOwnerApproval || (t.ownerApprovalWhenActiveOwner && participation));

  const rows = pending.map((t) => ({
    property_id: input.propertyId,
    stage: t.stage,
    legacy_stage: t.legacyStage ?? null,
    title: t.title,
    detail: detailFor(t),
    status: "open",
    blocks_handoff: t.blocksHandoff,
    requires_owner_approval: needsOwnerApproval(t),
    owner_approval_status: needsOwnerApproval(t) ? "pending" : "not_required",
    evidence_required: Boolean(t.evidenceRequired),
    due_on: dueFor(t, anchors),
    due_on_source: t.anchor ? "template_anchor" : null,
    schedule_anchor: t.anchor ?? null,
    schedule_offset_days: t.offsetDays ?? null,
    sort_order: t.sortOrder,
    created_by: userId,
    is_demo: property.is_demo,
    ...seatFields(t.role, t.stage, seatHolders),
  }));
  const approvalTasks = existing.filter(
    (t) =>
      !t.parent_task_id &&
      t.requires_owner_approval &&
      ["pending", "awaiting_owner"].includes(t.owner_approval_status) &&
      MASTER_ONBOARDING_TEMPLATE.some(
        (template) => taskKey(template.stage, template.title) === taskKey(t.stage, t.title),
      ),
  );

  if (rows.length) {
    const inserted = await supabase
      .from("onboarding_tasks")
      .insert(rows)
      .select(
        "id, title, stage, parent_task_id, detail, due_on, requires_owner_approval, owner_approval_status",
      );
    if (inserted.error) throw inserted.error;
    for (const r of inserted.data ?? []) {
      parentIdByKey.set(taskKey(r.stage, r.title), r.id);
      if (r.requires_owner_approval) approvalTasks.push(r);
    }
  }

  // Prepare canonical decisions without contacting an owner during plan setup.
  // Retry also repairs requests omitted by an earlier interrupted setup; the RPC
  // reuses pending approvals and preserves any decision already recorded.
  const { ensureOwnerApprovalRequest } = await import("./onboarding.server");
  for (const task of approvalTasks) {
    const template = MASTER_ONBOARDING_TEMPLATE.find(
      (entry) => taskKey(entry.stage, entry.title) === taskKey(task.stage, task.title),
    );
    await ensureOwnerApprovalRequest(supabase, userId, {
      taskId: task.id,
      propertyId: input.propertyId,
      title: task.title,
      detail: template?.detail ?? "",
      dueOn: task.due_on,
      isDemo: property.is_demo,
      deferDelivery: true,
    });
  }

  // Subtasks are reconciled for EVERY template task, including ones that
  // already existed, so a partially applied plan is completed rather than
  // duplicated.
  const subRows: Record<string, unknown>[] = [];
  for (const t of MASTER_ONBOARDING_TEMPLATE) {
    if (!t.subtasks?.length) continue;
    const parentId = parentIdByKey.get(taskKey(t.stage, t.title));
    if (!parentId) continue;
    t.subtasks.forEach((title, i) => {
      if (takenSubs.has(subKey(parentId, title))) return;
      subRows.push({
        property_id: input.propertyId,
        stage: t.stage,
        title,
        detail: `Subtask of "${t.title}".`,
        status: "open",
        blocks_handoff: t.blocksHandoff,
        requires_owner_approval: false,
        owner_approval_status: "not_required",
        evidence_required: false,
        parent_task_id: parentId,
        sort_order: t.sortOrder + i + 1,
        ...seatFields(t.role, t.stage, seatHolders),
        created_by: userId,
        is_demo: property.is_demo,
      });
    });
  }
  if (subRows.length) {
    const subs = await supabase
      .from("onboarding_tasks")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(subRows as any);
    if (subs.error) throw subs.error;
  }

  await audit({
    actorId: userId,
    action: "onboarding_template_applied",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: property.name,
    after: {
      template: TEMPLATE_KEY,
      created: rows.length,
      subtasks: subRows.length,
      skipped: MASTER_ONBOARDING_TEMPLATE.length - pending.length,
    },
  });

  return {
    created: rows.length,
    subtasksCreated: subRows.length,
    skipped: MASTER_ONBOARDING_TEMPLATE.length - pending.length,
  };
}
