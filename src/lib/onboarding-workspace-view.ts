/** Presentation scope derived from existing capability and active project assignments. */
export function onboardingWorkspaceMode(
  userId: string,
  supervisor: boolean,
  projects: { project_manager: string | null; director: string | null; status: string }[],
): "portfolio" | "projects" | "assigned" {
  if (supervisor) return "portfolio";
  return projects.some(
    (project) =>
      project.status !== "cancelled" &&
      (project.project_manager === userId || project.director === userId),
  )
    ? "projects"
    : "assigned";
}

export const onboardingWorkspaceKey = (userId: string | null) =>
  ["onboarding-workspace", userId] as const;
