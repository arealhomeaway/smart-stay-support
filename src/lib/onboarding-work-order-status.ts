/**
 * Onboarding Task work orders in Breezeway: the status words a Task shows and
 * the instructions a work order carries. Pure, browser safe.
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

/** Line endings and trailing spaces never count as a difference. */
const norm = (v: string | null | undefined) =>
  (v ?? "").replace(/\r\n/g, "\n").split("\n").map((l) => l.trimEnd()).join("\n").trim();
const squash = (v: string) => v.replace(/\s+/g, " ").trim();

/**
 * What the work order's instructions must become, or null when Breezeway already shows exactly
 * what was in the box at send. The box text is written as it is, empty included.
 */
export function instructionsToWrite(intended: string | null | undefined, current: string | null | undefined): string | null {
  const want = norm(intended);
  return want === norm(current) ? null : want.slice(0, 4000);
}

/** A Resolve Task's step guidance (About this step, Instructions, Done when, Good to know); never sent to Breezeway. */
export function isStepGuidance(text: string | null | undefined): boolean {
  return /^\s*About this step:/i.test(text ?? "");
}

/**
 * A Breezeway template's own instructions, read from work orders Breezeway made from it (newest first).
 * Breezeway does not offer a template's text directly. The text found inside the most of them wins,
 * so a copy someone added lines to never replaces the template's own words; ties go to the shortest,
 * then the newest. Empty texts and Resolve step guidance never count.
 */
export function pickTemplateInstructions(found: { taskId: number; text: string | null }[]): { text: string; fromTaskId: number } | null {
  const usable = found
    .map((f) => ({ taskId: f.taskId, text: norm(f.text) }))
    .filter((f) => f.text && !isStepGuidance(f.text));
  let best: { text: string; fromTaskId: number; score: number } | null = null;
  for (const c of usable) {
    const key = squash(c.text);
    const score = usable.filter((o) => squash(o.text).includes(key)).length;
    if (!best || score > best.score || (score === best.score && c.text.length < best.text.length)) {
      best = { text: c.text, fromTaskId: c.taskId, score };
    }
  }
  return best ? { text: best.text.slice(0, 4000), fromTaskId: best.fromTaskId } : null;
}
