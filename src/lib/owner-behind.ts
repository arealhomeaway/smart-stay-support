/**
 * Owner follow-up rule (browser-safe, pure).
 *
 * Staff are never prompted to call or text a homeowner. When a homeowner is
 * behind on real, current items, the right teammate gets one in-app
 * notification and one My Work follow-up per home while it stays open.
 *
 * Behind = a current owner item past its respond-by date, or waiting on the
 * homeowner more than 7 days with no respond-by date. Archived/withdrawn
 * reviews and retired/archived work items never count.
 */

export const WAITING_DAYS = 7;
const DAY_MS = 86_400_000;

export type OwnerItem = {
  id: string;
  source: "review" | "work_item";
  status: string;
  archivedAt?: string | null;
  retiredAt?: string | null;
  respondBy?: string | null;
  /** When the item started waiting on the homeowner (sent/released). */
  waitingSince?: string | null;
  respondedAt?: string | null;
};

const CLOSED_REVIEW = new Set(["answered", "closed", "complete", "completed", "withdrawn"]);
const OPEN_WORK = new Set(["open", "in_progress"]);

/** Is this item real and still waiting on the homeowner? */
export function isCurrentOwnerItem(item: OwnerItem) {
  if (item.archivedAt || item.retiredAt) return false;
  if (item.source === "work_item") {
    return OPEN_WORK.has(item.status) && !item.respondedAt && Boolean(item.waitingSince);
  }
  return !CLOSED_REVIEW.has(item.status);
}

/** The moment an item became behind, or null when it is not behind yet. */
export function behindSince(item: OwnerItem): Date | null {
  if (!isCurrentOwnerItem(item)) return null;
  if (item.respondBy) {
    // Past the respond-by date means the day after it ends.
    const d = new Date(`${item.respondBy.slice(0, 10)}T00:00:00Z`);
    return new Date(d.getTime() + DAY_MS);
  }
  if (!item.waitingSince) return null;
  return new Date(new Date(item.waitingSince).getTime() + WAITING_DAYS * DAY_MS);
}

export function behindItems(items: OwnerItem[], now = new Date()) {
  return items.filter((i) => {
    const at = behindSince(i);
    return at !== null && at.getTime() <= now.getTime();
  });
}

export type RouteInput = {
  /** True while the home has an onboarding project not yet accepted at handoff. */
  inOnboarding: boolean;
  projectManager: string | null;
  onboardingDirector: string | null;
  followupSeatHolder: string | null;
  followupCover: string | null;
};

export type Route = {
  assignee: string | null;
  reason: "project_manager" | "no_project_manager" | "followup_seat" | "followup_cover";
  noProjectManager: boolean;
};

export function routeFollowUp(r: RouteInput): Route {
  if (r.inOnboarding) {
    if (r.projectManager) return { assignee: r.projectManager, reason: "project_manager", noProjectManager: false };
    return { assignee: r.onboardingDirector, reason: "no_project_manager", noProjectManager: true };
  }
  if (r.followupCover) return { assignee: r.followupCover, reason: "followup_cover", noProjectManager: false };
  return { assignee: r.followupSeatHolder, reason: "followup_seat", noProjectManager: false };
}

export function followUpTitle(owner: string | null, n: number, noProjectManager = false) {
  const who = owner?.trim() || "the homeowner";
  const base = `Reach out to ${who} about ${n} item${n === 1 ? "" : "s"} waiting. Email is fine.`;
  return noProjectManager ? `${base} No Project Manager assigned.` : base;
}

export type FollowUpTask = { status: "open" | "closed"; closedAt: string | null };

/**
 * What to do for one home. Never a duplicate while one is open; after a
 * close, reopen only when an item fell behind after that close.
 */
export function followUpDecision(
  items: OwnerItem[],
  tasks: FollowUpTask[],
  now = new Date(),
): { action: "create" | "keep" | "none"; count: number } {
  const behind = behindItems(items, now);
  if (tasks.some((t) => t.status === "open")) return { action: "keep", count: behind.length };
  if (behind.length === 0) return { action: "none", count: 0 };
  const lastClose = tasks
    .filter((t) => t.status === "closed" && t.closedAt)
    .map((t) => new Date(t.closedAt!).getTime())
    .sort((a, b) => b - a)[0];
  if (lastClose === undefined) return { action: "create", count: behind.length };
  const fresh = behind.some((i) => (behindSince(i)?.getTime() ?? 0) > lastClose);
  return fresh ? { action: "create", count: behind.length } : { action: "none", count: behind.length };
}

export function activeOwnerTabPath(propertyId: string) {
  return `/property/${propertyId}#active-owner`;
}
