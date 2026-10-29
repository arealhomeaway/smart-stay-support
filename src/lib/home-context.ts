/** Pure rules shared by both home pages (Operations and Onboarding). */

export type HomeLifecycle = "Onboarding" | "Ready for handoff" | "Handed off" | "Live";

export function homeLifecycle(input: {
  lifecycleStatus: string | null;
  handoffState: string | null;
}): HomeLifecycle {
  if (input.handoffState === "ready") return "Ready for handoff";
  if (input.lifecycleStatus === "active_operations") return "Live";
  if (input.handoffState === "accepted") return "Handed off";
  if (input.handoffState === "in_progress" || input.lifecycleStatus === "onboarding") return "Onboarding";
  return "Live";
}

/** The Onboarding view option needs a project and the existing page permission. */
export function showOnboardingView(hasProject: boolean, canOpenOnboarding: boolean) {
  return hasProject && canOpenOnboarding;
}

export type WaitingHandoff = { projectId: string; propertyId: string; name: string; readyAt: string | null };

/** Homes marked ready and not yet accepted, oldest first, with whole days waiting. */
export function handoffsWaiting<T extends WaitingHandoff>(rows: T[], now: number) {
  return [...rows]
    .sort((a, b) => (a.readyAt ?? "").localeCompare(b.readyAt ?? ""))
    .map((r) => ({ ...r, days: r.readyAt ? Math.max(0, Math.floor((now - Date.parse(r.readyAt)) / 86400000)) : null }));
}

/** Who sees the waiting list: the Director of Operations seat holder or whoever covers it now. */
export function isOpsDirectorSeat(userId: string | null, holder: string | null, cover: string | null) {
  return Boolean(userId) && (userId === holder || userId === cover);
}

export type OpsOwnerRecord =
  | { type: "Ticket update"; id: string; ticketId: string; title: string; sentAt: string | null; answeredAt: string | null }
  | { type: "Approval request"; id: string; ticketId: string | null; title: string; sentAt: string | null; status: string; decidedAt: string | null };

/** Status the Active Owner tab groups by: waiting while open, completed once answered or decided. */
export function opsRecordStatus(r: OpsOwnerRecord) {
  if (r.type === "Ticket update") return r.answeredAt ? "complete" : "open";
  return r.status === "pending" ? "open" : "complete";
}
