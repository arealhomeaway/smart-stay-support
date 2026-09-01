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
 *  - No external system is touched: no Breezeway, OwnerRez, Asana or Notion
 *    writes. Breezeway template IDs are recorded as text on the task only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FULL_FURNISHING_TEMPLATE, TEMPLATE_KEY, type TemplateTask } from "./onboarding-template";
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

function seatFields(role: string | null | undefined, stage: string, holders: Map<string, string | null>) {
  const seat: SeatCode = seatForTask({ role: role ?? null, stage });
  return { assigned_seat: seat, assigned_to: holders.get(seat) ?? null };
}

export type TemplatePreview = {
  propertyId: string;
  templateKey: string;
  toCreate: { key: string; stage: string; title: string; dueOn: string | null; subtasks: number }[];
  skipped: { title: string; reason: string }[];
  anchors: { planned_closing: string | null; actual_closing: string | null; actual_access: string | null };
};

/**
 * Identity of a template row on a property. Title alone is NOT unique: the
 * ARHA plan legitimately repeats "Update project status in Asana" once per
 * phase and the weekly owner update twice, and subtasks such as "Add to Notion"
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
    .select("id, title, stage, parent_task_id")
    .eq("property_id", propertyId)
    .is("archived_at", null);
  if (existing.error) throw existing.error;

  const anchors = {
    planned_closing: property.data.planned_closing_on,
    actual_closing: property.data.actual_closing_on,
    actual_access: property.data.actual_access_on,
  };
  const rows = existing.data ?? [];
  // Subtasks never block a top-level task from being created, and vice versa.
  const taken = new Set(
    rows.filter((t) => !t.parent_task_id).map((t) => taskKey(t.stage, t.title)),
  );
  const takenSubs = new Set(
    rows
      .filter((t) => t.parent_task_id)
      .map((t) => subKey(t.parent_task_id as string, t.title)),
  );
  const parentIdByKey = new Map(
    rows.filter((t) => !t.parent_task_id).map((t) => [taskKey(t.stage, t.title), t.id] as const),
  );
  return { property: property.data, anchors, taken, takenSubs, parentIdByKey };
}

function dueFor(t: TemplateTask, anchors: TemplatePreview["anchors"]) {
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
  const { anchors, taken } = await loadContext(supabase, input.propertyId);

  const toCreate: TemplatePreview["toCreate"] = [];
  const skipped: TemplatePreview["skipped"] = [];
  for (const t of FULL_FURNISHING_TEMPLATE) {
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
  return { propertyId: input.propertyId, templateKey: TEMPLATE_KEY, toCreate, skipped, anchors };
}

export async function applyOnboardingTemplate(
  supabase: Client,
  userId: string,
  input: { propertyId: string },
) {
  await assertOnboardingStaff(supabase, userId);
  const { property, anchors, taken, takenSubs, parentIdByKey } = await loadContext(
    supabase,
    input.propertyId,
  );

  const pending = FULL_FURNISHING_TEMPLATE.filter((t) => !taken.has(taskKey(t.stage, t.title)));

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

  if (rows.length) {
    const inserted = await supabase
      .from("onboarding_tasks")
      .insert(rows)
      .select("id, title, stage");
    if (inserted.error) throw inserted.error;
    for (const r of inserted.data ?? []) {
      parentIdByKey.set(taskKey(r.stage, r.title), r.id);
    }
    // Homeowner decision records for the steps that need one.
    const { ensureOwnerApprovalRequest } = await import("./onboarding.server");
    for (const r of inserted.data ?? []) {
      const t = pending.find((x) => taskKey(x.stage, x.title) === taskKey(r.stage, r.title));
      if (!t || !needsOwnerApproval(t)) continue;
      await ensureOwnerApprovalRequest(supabase, userId, {
        taskId: r.id,
        propertyId: input.propertyId,
        title: t.title,
        detail: t.detail ?? "",
        dueOn: dueFor(t, anchors),
        isDemo: property.is_demo,
      });
    }
  }

  // Subtasks are reconciled for EVERY template task, including ones that
  // already existed, so a partially applied plan is completed rather than
  // duplicated.
  const subRows: Record<string, unknown>[] = [];
  for (const t of FULL_FURNISHING_TEMPLATE) {
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

  await writeAudit({
    actorId: userId,
    action: "onboarding_template_applied",
    entityType: "property",
    entityId: input.propertyId,
    entityLabel: property.name,
    after: {
      template: TEMPLATE_KEY,
      created: rows.length,
      subtasks: subRows.length,
      skipped: FULL_FURNISHING_TEMPLATE.length - pending.length,
    },
  });

  return {
    created: rows.length,
    subtasksCreated: subRows.length,
    skipped: FULL_FURNISHING_TEMPLATE.length - pending.length,
  };
}
