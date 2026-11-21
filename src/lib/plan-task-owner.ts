/**
 * Who a project plan Task belongs to, for every Task list (My Tasks, a home's Tasks tab and its
 * Whose Task counts). One rule, browser-safe:
 *   the named person, else the person this home's team names for the Task's role,
 *   else the home's Project Manager (an unassigned Task is the PM's until handed off).
 * It never depends on the Task's due date, stage, kind or status, so no plan Task drops out of
 * its owner's list.
 */

export type HomeTeam = {
  project_manager?: string | null;
  director?: string | null;
  utility_manager?: string | null;
  role_assignments?: Record<string, unknown> | null;
};

const PM_SEATS = new Set(["onboarding_project_manager", "project_manager"]);
const DIRECTOR_SEATS = new Set(["onboarding_director", "director_onboarding"]);

/** The person this home's team names for a role, or null when nobody is named. */
export function homeRoleHolder(project: HomeTeam | null | undefined, seat: string | null | undefined): string | null {
  if (!project || !seat) return null;
  if (PM_SEATS.has(seat)) return project.project_manager ?? null;
  if (DIRECTOR_SEATS.has(seat)) return project.director ?? null;
  if (seat === "utilities") return project.utility_manager ?? null;
  const assigned = project.role_assignments?.[seat];
  return typeof assigned === "string" && assigned ? assigned : null;
}

/** The Task's owner: named person, else the home's role holder, else the home's PM. */
export function planTaskOwner(
  task: { assigned_to: string | null; assigned_seat?: string | null },
  project: HomeTeam | null | undefined,
): string | null {
  return task.assigned_to ?? homeRoleHolder(project, task.assigned_seat ?? null) ?? project?.project_manager ?? null;
}

/** The owner a loaded Task carries (plan_owner from the workspace), else its named person. */
export function ownerOfTask(task: { assigned_to: string | null; plan_owner?: string | null }): string | null {
  return task.plan_owner !== undefined ? task.plan_owner : task.assigned_to;
}
