/**
 * What may be changed on several tickets at once, and by whom.
 *
 * Bulk is a convenience, never a shortcut past a rule. Closing work still
 * goes through each ticket's own closing checks (change 4: Close selected), and priority
 * still needs a supervisor and a written reason — exactly as it does on the
 * ticket itself.
 */
export const BULK_ACTIONS = ["assign", "status", "priority", "due", "close"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** Statuses that are a simple statement of where the work stands. */
export const BULK_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
] as const;
// "Waiting" and "Dispatched" need per-ticket details (who, why, review date,
// assignee), so they are set one ticket at a time.

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
  if (action === "assign" || action === "priority" || action === "due" || action === "close") return supervisor(roles);
  return internal(roles);
}

/** Why the action is unavailable, in words the person can act on. */
export function bulkDenialReason(viewer: BulkViewer, action: BulkAction): string | null {
  if (canRunBulkAction(viewer, action)) return null;
  if (viewer.readOnly) return "You are previewing another role, so nothing can be changed.";
  if (action === "assign") return "Only a Supervisor can reassign other people's tickets.";
  if (action === "priority") return "Only a Supervisor can change priority.";
  if (action === "due") return "Only a Supervisor can move due dates for many tickets.";
  if (action === "close") return "Only a Supervisor can close many tickets at once.";
  return "Only Operations staff can update tickets.";
}

export type BulkRequest = {
  ticketIds: string[];
  action: BulkAction;
  assigneeId?: string | null;
  status?: string;
  priority?: string;
  reason?: string;
  /** Move due date: the new date, YYYY-MM-DD. */
  dueOn?: string;
  /** Move due date: true when any selected ticket has a locked due date. */
  anyLocked?: boolean;
};

export const DUE_REASON_MIN = 3;

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

  if (request.action === "due") {
    const dueOn = String(request.dueOn ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false, error: "Pick a date." };
    const reason = String(request.reason ?? "").trim();
    if (request.anyLocked && reason.length < DUE_REASON_MIN)
      return { ok: false, error: "Write a short reason. Some of these due dates are locked." };
    return { ok: true, ticketIds: ids, action: "due", patch: { due_on: dueOn }, reason: reason || null };
  }

  if (request.action === "close") {
    // Each ticket still goes through its own closing checks on the server.
    return { ok: true, ticketIds: ids, action: "close", patch: { status: "closed" }, reason: null };
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
