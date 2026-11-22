/**
 * Utilities Tasks (Nov 21): every Task for the Utilities role shows the home's utilities, with Add
 * utility for the people who run the home or hold its Utilities role. Browser-safe, no data access.
 */
import { canManageOnboardingProperty } from "./onboarding-workspace-view";

export const UTILITIES_ROLE = "utilities";
const PANEL_FIELDS = ["wifi", "access_plan", "utility_accounts"] as const;

export function isUtilitiesTask(task: { assigned_seat?: string | null }) {
  return task.assigned_seat === UTILITIES_ROLE;
}

/** The Fill in middle already shows the utilities panel for these fields on an open Task. */
export function kindShowsUtilitiesPanel(middle: string, fields: readonly string[] | undefined, finished: boolean) {
  return !finished && middle === "fill_in" && (fields ?? []).some((f) => (PANEL_FIELDS as readonly string[]).includes(f));
}

/** Show the utilities panel on its own inside a Task: every Utilities Task, once. */
export function showsUtilitiesPanel(
  task: { assigned_seat?: string | null },
  middle: string,
  fields: readonly string[] | undefined,
  finished: boolean,
) {
  return isUtilitiesTask(task) && !kindShowsUtilitiesPanel(middle, fields, finished);
}

/**
 * Who may add or change a home's utilities from a Task: whoever runs the home (its Project Manager,
 * the Director, leadership) and the person who holds the home's Utilities role. Someone holding both
 * roles qualifies either way.
 */
export function canEditHomeUtilities(
  userId: string | null,
  supervisor: boolean,
  propertyId: string | null | undefined,
  projects: { property_id: string; project_manager: string | null; director: string | null; status: string; utility_manager?: string | null }[],
) {
  if (canManageOnboardingProperty(userId, supervisor, propertyId, projects)) return true;
  return Boolean(
    userId &&
      propertyId &&
      projects.some((p) => p.property_id === propertyId && p.status !== "cancelled" && p.utility_manager === userId),
  );
}
