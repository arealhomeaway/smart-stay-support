import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
/** Property-level management actions use the same responsibility boundary as task management. */
export async function assertOnboardingPropertyManagement(
  supabase: Client,
  userId: string,
  propertyId: string,
) {
  await onboardingTaskAccess(supabase, userId, propertyId, null);
}

/** Called after the action verifies the onboarding capability. */
export async function onboardingTaskAccess(
  supabase: Client,
  userId: string,
  propertyId: string,
  assignedTo: string | null,
) {
  const supervisor = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (supervisor.error) throw new Error("Could not verify task access.");
  if (supervisor.data) return { canManage: true };
  const projects = await supabase
    .from("onboarding_projects")
    .select("project_manager, director")
    .eq("property_id", propertyId)
    .neq("status", "cancelled");
  if (projects.error) throw new Error("Could not verify project responsibility.");
  if (
    projects.data.some(
      (project) => project.project_manager === userId || project.director === userId,
    )
  )
    return { canManage: true };
  if (assignedTo === userId) return { canManage: false };
  throw new Error("This work is not assigned to you or a project you lead.");
}

/** Field workers can record progress, not change the requirements they must satisfy. */
export function assertAssignedTaskPatch(
  prior: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  if (prior["status"] === "carryover" || patch["status"] === "carryover") {
    throw new Error("Only the project lead can change carryover work.");
  }
  const progress = new Set(["blocker", "evidence_note", "status", "completed_at", "completed_by"]);
  for (const [key, value] of Object.entries(patch)) {
    const previous = key === "depends_on" ? (prior[key] ?? []) : prior[key];
    if (!progress.has(key) && JSON.stringify(previous) !== JSON.stringify(value)) {
      throw new Error(
        "Ask the project lead to change task requirements, dates, links or assignment.",
      );
    }
  }
}
