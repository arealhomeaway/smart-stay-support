/**
 * Removing people (pure, browser safe).
 * Staff are deleted as a kept "former" record; homeowners and vendors are archived.
 * Nobody's row is ever deleted, so history always has a name to show.
 */
/**
 * Delete user and Archive stay hidden until docs/pending/remove-users is applied
 * in a separate approved step. Flip to true only then.
 */
export const USER_REMOVAL_ENABLED = true;

export type OpenWorkItem = { kind: "ticket" | "task" | "work_order" | "approval" | "seat"; item_id: string; label: string };

export const OPEN_WORK_LABEL: Record<OpenWorkItem["kind"], string> = {
  ticket: "Ticket",
  task: "Onboarding Task",
  work_order: "Work Order",
  approval: "Approval",
  seat: "Role",
};

/** Name shown in history for a deleted staff member. */
export function formerName(name: string | null | undefined, removedAt: string | null | undefined) {
  const n = name?.trim() || "Unknown";
  return removedAt ? `${n} (former)` : n;
}

export function canDeleteNow(openWork: OpenWorkItem[]) {
  return openWork.length === 0;
}

export const DELETE_CONFIRM =
  "Their login and all access are removed, and they leave every list, picker, role, shift, the on-call pattern and future on-call nights. Past on-call nights, tickets, approvals and history keep their name as \"(former)\". Their staff notifications are deleted. This cannot be undone from the screen.";
export const ARCHIVE_CONFIRM =
  "Their login is turned off and they are hidden from active lists. Every hour, approval, document, work order, invoice and record stays exactly as it is. You can restore them later.";

/** True when the database change for this feature is not applied yet. */
export function isPendingSchemaError(e: { code?: string; message?: string } | null | undefined) {
  if (!e) return false;
  return e.code === "PGRST202" || e.code === "42883" || e.code === "42703" || /could not find the function|does not exist/i.test(e.message ?? "");
}

export const BAN_FOREVER = "876000h";
