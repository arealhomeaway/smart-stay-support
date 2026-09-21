/**
 * What may be changed on several tickets at once, and by whom.
 *
 * Bulk is a convenience, never a shortcut past a rule. Closing work still
 * happens one ticket at a time because closure needs evidence, and priority
 * still needs a supervisor and a written reason — exactly as it does on the
 * ticket itself.
 */
export const BULK_ACTIONS = ["assign", "status", "priority"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** Statuses that are a simple statement of where the work stands. */
export const BULK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "dispatched", label: "Dispatched" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting on someone" },
] as const;

export type BulkStatus = (typeof BULK_STATUSES)[number]["value"];

/** Closure carries evidence requirements, so it is never a batch action. */
export const CLOSURE_STATUSES = ["resolved", "closed"];

export const BULK_PRIORITIES = ["p1", "p2", "p3"] as const;
export type BulkPriority = (typeof BULK_PRIORITIES)[number];

/** The most tickets one batch may touch, so a mis-click stays recoverable. */
export const BULK_LIMIT = 50;

export const PRIORITY_REASON_MIN = 5;

export function isBulkStatus(value: unknown): value is BulkStatus {
  return BULK_STATUSES.some((s) => s.value === value);
}

export function isBulkPriority(value: unknown): value is BulkPriority {
  return BULK_PRIORITIES.includes(String(value) as BulkPriority);
}

export type BulkViewer = {
  roles: string[];
  /** A read-only preview may look at anything and change nothing. */
  readOnly?: boolean;
};

const supervisor = (roles: string[]) => roles.includes("admin") || roles.includes("manager");
const internal = (roles: string[]) =>
  supervisor(roles) || roles.includes("tech") || roles.includes("onboarding");

/**
 * Whether this person may run this batch action — the same answer the server
 * gives, so the buttons never promise something the save will refuse.
 */
export function canRunBulkAction(viewer: BulkViewer, action: BulkAction): boolean {
  if (viewer.readOnly) return false;
  const roles = viewer.roles ?? [];
  if (action === "assign" || action === "priority") return supervisor(roles);
  return internal(roles);
}

/** Why the action is unavailable, in words the person can act on. */
export function bulkDenialReason(viewer: BulkViewer, action: BulkAction): string | null {
  if (canRunBulkAction(viewer, action)) return null;
  if (viewer.readOnly) return "You are previewing another role, so nothing can be changed.";
  if (action === "assign") return "Only a Supervisor can reassign other people's tickets.";
  if (action === "priority") return "Only a Supervisor can change priority.";
  return "Only Operations staff can update tickets.";
}

export type BulkRequest = {
  ticketIds: string[];
  action: BulkAction;
  assigneeId?: string | null;
  status?: string;
  priority?: string;
  reason?: string;
};

export type BulkPlan =
  | { ok: true; ticketIds: string[]; action: BulkAction; patch: Record<string, unknown>; reason: string | null }
  | { ok: false; error: string };

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Turns a request into the exact change to write, or the reason it cannot be
 * made. Shared by the screen and the server so both agree.
 */
export function planBulkUpdate(request: BulkRequest): BulkPlan {
  const ids = Array.from(new Set((request.ticketIds ?? []).map((id) => String(id).trim())));
  if (ids.length === 0) return { ok: false, error: "Select at least one ticket." };
  if (ids.some((id) => !UUID.test(id))) return { ok: false, error: "One of those tickets is not valid." };
  if (ids.length > BULK_LIMIT)
    return { ok: false, error: `Up to ${BULK_LIMIT} tickets can be changed at once.` };

  if (request.action === "assign") {
    const assignee = request.assigneeId ? String(request.assigneeId).trim() : null;
    if (assignee && !UUID.test(assignee)) return { ok: false, error: "Choose who takes this work." };
    return {
      ok: true,
      ticketIds: ids,
      action: "assign",
      patch: { assigned_to: assignee },
      reason: null,
    };
  }

  if (request.action === "status") {
    const status = String(request.status ?? "");
    if (CLOSURE_STATUSES.includes(status))
      return {
        ok: false,
        error: "Resolving or closing needs the evidence on each ticket, so it is done one at a time.",
      };
    if (!isBulkStatus(status)) return { ok: false, error: "Choose a status." };
    return { ok: true, ticketIds: ids, action: "status", patch: { status }, reason: null };
  }

  const priority = String(request.priority ?? "").toLowerCase();
  if (!isBulkPriority(priority)) return { ok: false, error: "Choose P1, P2 or P3." };
  const reason = String(request.reason ?? "").trim();
  if (reason.length < PRIORITY_REASON_MIN)
    return { ok: false, error: "Write why these tickets get a different priority." };
  return {
    ok: true,
    ticketIds: ids,
    action: "priority",
    patch: { priority, priority_override_reason: reason },
    reason,
  };
}
