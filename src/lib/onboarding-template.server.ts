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
    if (taken.has(t.title.trim().toLowerCase())) {
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
  const { property, anchors, taken } = await loadContext(supabase, input.propertyId);

  const pending = FULL_FURNISHING_TEMPLATE.filter(
    (t) => !taken.has(t.title.trim().toLowerCase()),
  );
  if (pending.length === 0) {
    return { created: 0, subtasksCreated: 0, skipped: FULL_FURNISHING_TEMPLATE.length };
  }

  const rows = pending.map((t) => ({
    property_id: input.propertyId,
    stage: t.stage,
    title: t.title,
    detail: detailFor(t),
    status: "open",
    blocks_handoff: t.blocksHandoff,
    requires_owner_approval: Boolean(t.requiresOwnerApproval),
    owner_approval_status: t.requiresOwnerApproval ? "pending" : "not_required",
    evidence_required: Boolean(t.evidenceRequired),
    due_on: dueFor(t, anchors),
    due_on_source: t.anchor ? "template_anchor" : null,
    schedule_anchor: t.anchor ?? null,
    schedule_offset_days: t.offsetDays ?? null,
    sort_order: t.sortOrder,
    created_by: userId,
    is_demo: property.is_demo,
  }));

  const inserted = await supabase.from("onboarding_tasks").insert(rows).select("id, title");
  if (inserted.error) throw inserted.error;

  const byTitle = new Map(
    (inserted.data ?? []).map((r) => [r.title.trim().toLowerCase(), r.id] as const),
  );

  const subRows: Record<string, unknown>[] = [];
  for (const t of pending) {
    const parentId = byTitle.get(t.title.trim().toLowerCase());
    if (!parentId || !t.subtasks?.length) continue;
    t.subtasks.forEach((title, i) => {
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
