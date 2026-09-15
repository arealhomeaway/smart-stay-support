/**
 * Controlled onboarding date recalculation (server-only).
 *
 * Deliberately rule-free: ARHA has no documented milestone offset table in the
 * sources available to the app, so nothing is applied automatically and no
 * universal schedule is assumed. A task moves only when a person has recorded
 * an anchor ("planned closing", "actual closing", "actual access") and an
 * offset in days on that task. Everything is preview-first: proposed dates are
 * shown next to current dates and only the rows the user confirms are written.
 *
 * Never touches completed tasks, manually overridden dates, or external
 * systems (no Breezeway, OwnerRez, SharePoint or calendar writes).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { writeAudit } from "./audit.server";
import { assertOnboardingPropertyManagement } from "./onboarding-task-access.server";

type Client = SupabaseClient<Database>;

export const SCHEDULE_ANCHORS = ["planned_closing", "actual_closing", "actual_access"] as const;
export type ScheduleAnchor = (typeof SCHEDULE_ANCHORS)[number];

export const ANCHOR_LABEL: Record<ScheduleAnchor, string> = {
  planned_closing: "Planned closing",
  actual_closing: "Actual closing",
  actual_access: "Actual access",
};

function shift(dateIso: string, days: number) {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function assertOnboardingStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_onboarding_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("You do not have access to this action.");
}

export type SchedulePreviewRow = {
  taskId: string;
  title: string;
  stage: string;
  anchor: ScheduleAnchor;
  offsetDays: number;
  currentDue: string | null;
  proposedDue: string;
  changed: boolean;
  conflict: string | null;
};

export type SchedulePreview = {
  propertyId: string;
  anchors: {
    planned_closing: string | null;
    actual_closing: string | null;
    actual_access: string | null;
  };
  rows: SchedulePreviewRow[];
  skipped: { taskId: string; title: string; reason: string }[];
};

/**
 * Save the three separate milestone dates. Saving anchors never moves a task
 * date on its own — recalculation is always a second, explicit step.
 */
export async function saveScheduleAnchors(
  supabase: Client,
  userId: string,
  input: {
    propertyId: string;
    plannedClosingOn: string | null;
    actualClosingOn: string | null;
    actualAccessOn: string | null;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  await assertOnboardingPropertyManagement(supabase, userId, input.propertyId);
  const { error } = await supabase
    .from("properties")
    .update({
      planned_closing_on: input.plannedClosingOn,
      actual_closing_on: input.actualClosingOn,
      actual_access_on: input.actualAccessOn,
    })
    .eq("id", input.propertyId);
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    action: "onboarding_anchors_saved",
    entityType: "property",
    entityId: input.propertyId,
    after: input,
  });
  return { ok: true as const };
}

/** Compute — but do not apply — the effect of the current anchor dates. */
export async function previewScheduleRecalc(
  supabase: Client,
  userId: string,
  input: { propertyId: string },
): Promise<SchedulePreview> {
  await assertOnboardingStaff(supabase, userId);
  await assertOnboardingPropertyManagement(supabase, userId, input.propertyId);

  const property = await supabase
    .from("properties")
    .select("id, planned_closing_on, actual_closing_on, actual_access_on")
    .eq("id", input.propertyId)
    .single();
  if (property.error) throw property.error;

  const anchors = {
    planned_closing: property.data.planned_closing_on,
    actual_closing: property.data.actual_closing_on,
    actual_access: property.data.actual_access_on,
  };

  const tasks = await supabase
    .from("onboarding_tasks")
    .select(
      "id, title, stage, status, due_on, schedule_anchor, schedule_offset_days, due_on_overridden",
    )
    .eq("property_id", input.propertyId)
    .is("archived_at", null)
    .order("sort_order");
  if (tasks.error) throw tasks.error;

  const rows: SchedulePreviewRow[] = [];
  const skipped: SchedulePreview["skipped"] = [];

  for (const t of tasks.data ?? []) {
    const anchor = t.schedule_anchor as ScheduleAnchor | null;
    if (!anchor || t.schedule_offset_days === null) {
      skipped.push({ taskId: t.id, title: t.title, reason: "No anchor or offset recorded" });
      continue;
    }
    if (t.status === "complete") {
      skipped.push({ taskId: t.id, title: t.title, reason: "Already completed — preserved" });
      continue;
    }
    if (t.due_on_overridden) {
      skipped.push({ taskId: t.id, title: t.title, reason: "Date was set manually — preserved" });
      continue;
    }
    const anchorDate = anchors[anchor];
    if (!anchorDate) {
      skipped.push({
        taskId: t.id,
        title: t.title,
        reason: `${ANCHOR_LABEL[anchor]} date is not recorded yet`,
      });
      continue;
    }
    const proposed = shift(anchorDate, t.schedule_offset_days);
    const conflict =
      t.due_on && proposed < new Date().toISOString().slice(0, 10)
        ? "Proposed date is in the past — confirm before applying"
        : t.status === "blocked"
          ? "Task is blocked — confirm the new date is still workable"
          : null;
    rows.push({
      taskId: t.id,
      title: t.title,
      stage: t.stage,
      anchor,
      offsetDays: t.schedule_offset_days,
      currentDue: t.due_on,
      proposedDue: proposed,
      changed: t.due_on !== proposed,
      conflict,
    });
  }

  return { propertyId: input.propertyId, anchors, rows, skipped };
}

/** Apply only the rows the user confirmed. Recomputed server-side. */
export async function applyScheduleRecalc(
  supabase: Client,
  userId: string,
  input: { propertyId: string; taskIds: string[] },
) {
  await assertOnboardingStaff(supabase, userId);
  const preview = await previewScheduleRecalc(supabase, userId, { propertyId: input.propertyId });
  const chosen = preview.rows.filter((r) => input.taskIds.includes(r.taskId) && r.changed);

  for (const row of chosen) {
    const { error } = await supabase
      .from("onboarding_tasks")
      .update({
        due_on: row.proposedDue,
        due_on_source: `${row.anchor}${row.offsetDays >= 0 ? "+" : ""}${row.offsetDays}d`,
      })
      .eq("id", row.taskId)
      .eq("due_on_overridden", false);
    if (error) throw error;
  }

  await writeAudit({
    actorId: userId,
    action: "onboarding_dates_recalculated",
    entityType: "property",
    entityId: input.propertyId,
    after: {
      applied: chosen.map((c) => ({ taskId: c.taskId, from: c.currentDue, to: c.proposedDue })),
    },
  });

  return { ok: true as const, applied: chosen.length };
}

/** Record the anchor/offset a task follows, or mark its date as manual. */
export async function setTaskSchedule(
  supabase: Client,
  userId: string,
  input: {
    taskId: string;
    anchor: ScheduleAnchor | null;
    offsetDays: number | null;
    manualOverride: boolean;
  },
) {
  await assertOnboardingStaff(supabase, userId);
  const task = await supabase
    .from("onboarding_tasks")
    .select("property_id")
    .eq("id", input.taskId)
    .single();
  if (task.error) throw task.error;
  await assertOnboardingPropertyManagement(supabase, userId, task.data.property_id);
  const { error } = await supabase
    .from("onboarding_tasks")
    .update({
      schedule_anchor: input.anchor,
      schedule_offset_days: input.anchor ? (input.offsetDays ?? 0) : null,
      due_on_overridden: input.manualOverride,
    })
    .eq("id", input.taskId);
  if (error) throw error;
  return { ok: true as const };
}
