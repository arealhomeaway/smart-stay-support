/**
 * Search Resolve (Ctrl+K) finds onboarding Tasks by title and home name
 * (Nov 12 item 30). Who sees which Tasks mirrors the onboarding workspace
 * (getOnboardingWorkspace): leaders see every home, a Project Manager or
 * Director their own homes, everyone else only Tasks assigned to them.
 * Each result opens the Task drawer where that person can open it. Pure.
 */
export type SearchMode = "portfolio" | "projects" | "assigned";

export type SearchableTask = {
  id: string;
  title: string;
  property_id: string;
  assigned_to: string | null;
};

export type OnboardingTaskHit = {
  id: string;
  title: string;
  propertyId: string;
  homeName: string;
  /** Where the drawer opens: the home's page, or My Tasks for work on someone else's home. */
  opensIn: "home" | "my_work";
};

const norm = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, " ").trim();

export function taskTitleMatches(title: string, term: string): boolean {
  const q = norm(term);
  return q.length > 0 && norm(title).includes(q);
}

/** Tasks this person may open, and where; null when hidden. */
export function onboardingTaskVisibility(
  mode: SearchMode,
  userId: string,
  managedPropertyIds: ReadonlySet<string>,
  task: SearchableTask,
): OnboardingTaskHit["opensIn"] | null {
  if (mode === "portfolio") return "home";
  if (managedPropertyIds.has(task.property_id)) return "home";
  if (task.assigned_to === userId) return "my_work";
  return null;
}

/** The link that opens the Task drawer. */
export function onboardingTaskHref(hit: Pick<OnboardingTaskHit, "id" | "propertyId" | "opensIn">): string {
  return hit.opensIn === "home"
    ? `/onboarding/${hit.propertyId}?tab=plan&task=${hit.id}`
    : `/onboarding/my-work?who=me&task=${hit.id}`;
}

export const ONBOARDING_SEARCH_LIMIT = 8;
