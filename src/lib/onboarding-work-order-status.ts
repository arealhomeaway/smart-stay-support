/**
 * Onboarding Task work orders in Breezeway: the status words a Task shows and
 * the instructions text a new work order must carry. Pure, browser safe.
 * The reopen rule itself lives only in DB reopen_tasks_for_work_orders.
 */
export type WorkOrderStatusLabel = "Scheduled" | "Not scheduled" | "In Progress" | "Completed" | "Canceled";

const DONE = ["finished", "approved", "closed", "completed", "complete"];
const CANCELED = ["deleted", "canceled", "cancelled"];

export function workOrderStatusLabel(stage: string | null | undefined, status: string | null | undefined, scheduledDate: string | null | undefined): WorkOrderStatusLabel {
  const s = (stage ?? "").trim().toLowerCase();
  const n = (status ?? "").trim().toLowerCase();
  if (CANCELED.includes(s) || CANCELED.includes(n)) return "Canceled";
  if (s === "finished" || DONE.includes(n)) return "Completed";
  if (s === "in_progress" || n === "in progress") return "In Progress";
  return scheduledDate ? "Scheduled" : "Not scheduled";
}

const squash = (v: string) => v.replace(/\s+/g, " ").trim();

/**
 * What the work order's instructions should become, or null when Breezeway
 * already shows ours. Our text comes first; a template's own text is kept under it.
 */
export function instructionsText(ours: string | null | undefined, current: string | null | undefined): string | null {
  const mine = (ours ?? "").trim();
  if (!mine) return null;
  const now = (current ?? "").trim();
  if (now && squash(now).includes(squash(mine))) return null;
  const next = now ? `${mine}\n\n${now}` : mine;
  return next.slice(0, 4000);
}
