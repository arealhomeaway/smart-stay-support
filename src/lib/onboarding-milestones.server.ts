/**
 * The three dates a project manager edits from the onboarding dashboard:
 * closing, access (possession) and target handoff.
 *
 * Saving them keeps the handoff rule (access + 3 weeks standard / 4 weeks
 * Active Owner, unless typed by hand) and re-dates every task that follows an
 * anchor and has not been given a manual date.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { writeAudit } from "./audit.server";
import { assertOnboardingPropertyManagement } from "./onboarding-task-access.server";
import { resolveHandoff, type HandoffDateSource } from "./onboarding-dates";
import { applyScheduleRecalc, previewScheduleRecalc } from "./onboarding-schedule.server";

type Client = SupabaseClient<Database>;

export type MilestoneInput = {
  propertyId: string;
  plannedClosingOn: string | null;
  actualClosingOn: string | null;
  actualAccessOn: string | null;
  /** undefined = leave as is; null = back to automatic. */
  targetHandoffOn?: string | null | undefined;
};

export async function saveOnboardingMilestones(supabase: Client, userId: string, input: MilestoneInput) {
  await assertOnboardingPropertyManagement(supabase, userId, input.propertyId);

  const before = await supabase
    .from("properties")
    .select("planned_closing_on, actual_closing_on, actual_access_on")
    .eq("id", input.propertyId)
    .single();
  if (before.error) throw before.error;

  // onboarding_projects has no archived_at column; a cancelled project is the
  // retired one, and the newest live project owns the handoff date.
  const projects = await supabase
    .from("onboarding_projects")
    .select("id, modules, target_handoff_on, target_handoff_source")
    .eq("property_id", input.propertyId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1);
  if (projects.error) throw projects.error;
  const project = { data: projects.data?.[0] ?? null };

  const property = await supabase
    .from("properties")
    .update({
      planned_closing_on: input.plannedClosingOn,
      actual_closing_on: input.actualClosingOn,
      actual_access_on: input.actualAccessOn,
    })
    .eq("id", input.propertyId)
    .select("id")
    .maybeSingle();
  if (property.error) throw property.error;

  let handoff: { targetHandoffOn: string | null; source: HandoffDateSource } | null = null;
  if (project.data) {
    const activeOwner = (project.data.modules ?? []).includes("active_owner");
    handoff = resolveHandoff({
      accessOn: input.actualAccessOn,
      activeOwner,
      current: project.data.target_handoff_on ?? null,
      currentSource: (project.data.target_handoff_source as HandoffDateSource) ?? "auto",
      typed: input.targetHandoffOn,
    });
    const { error } = await supabase
      .from("onboarding_projects")
      .update({
        target_handoff_on: handoff.targetHandoffOn,
        target_handoff_source: handoff.source,
      })
      .eq("id", project.data.id);
    if (error) throw error;
  }

  await writeAudit({
    actorId: userId,
    action: "onboarding_milestones_saved",
    entityType: "property",
    entityId: input.propertyId,
    before: before.data,
    after: { ...input, targetHandoff: handoff },
  });

  // Re-date the plan from the new anchors, leaving hand-set dates alone.
  let redated = 0;
  try {
    const preview = await previewScheduleRecalc(supabase, userId, { propertyId: input.propertyId });
    const ids = preview.rows.filter((r) => r.changed).map((r) => r.taskId);
    if (ids.length) {
      const applied = await applyScheduleRecalc(supabase, userId, {
        propertyId: input.propertyId,
        taskIds: ids,
      });
      redated = applied.applied;
    }
  } catch {
    // Dates saved; a recalculation clash must not lose the milestone edit.
    redated = 0;
  }

  return { ok: true as const, targetHandoffOn: handoff?.targetHandoffOn ?? null, source: handoff?.source ?? "auto", redated };
}
