/**
 * Plan catch-up on a home's Plan tab (Admin approval Nov 12): pure rules for selecting many
 * Tasks, the pinned action bar, the forms and the result line. The database
 * (bulk_complete_onboarding_tasks, plan_catch_up_tasks, undo_onboarding_task_batch) re-checks
 * everything; these only decide what the screen offers.
 */

export type CatchUpTask = {
  id: string;
  status: string;
  stage: string;
  assigned_to: string | null;
  assigned_seat?: string | null;
  archived_at?: string | null;
  parent_task_id?: string | null;
};

export const FINISHED = new Set(["complete", "done"]);
export const isFinishedTask = (t: Pick<CatchUpTask, "status">) => FINISHED.has(t.status);

/** Utilities and Design roles whose holders may act on Tasks given to the role. */
export const SHARED_ROLE_SEATS = ["utilities", "designer", "lead_designer", "design_staging", "staging_team"] as const;

export type CatchUpViewer = {
  userId: string | null;
  isAdmin: boolean;
  isOnboardingDirector: boolean;
  /** Holds the onboarding app role (Operations roles never do). */
  isOnboarding: boolean;
  /** This home's Project Manager. */
  isHomePm: boolean;
  /** Functional roles the viewer holds (utilities, designer...). */
  roleCodes: string[];
};

/** Item 7, mirrored from private.plan_catch_up_gate: may this person use plan catch-up at all? */
export function canUseCatchUp(v: CatchUpViewer): boolean {
  return Boolean(v.userId) && (v.isAdmin || v.isOnboardingDirector || v.isOnboarding);
}

/** Item 7, mirrored from private.plan_catch_up_can: may this person select this Task? */
export function canActOnTask(v: CatchUpViewer, t: Pick<CatchUpTask, "assigned_to" | "assigned_seat">): boolean {
  if (!v.userId) return false;
  if (v.isAdmin || v.isOnboardingDirector) return true;
  if (!v.isOnboarding) return false;
  if (v.isHomePm) return true;
  if (t.assigned_to && t.assigned_to === v.userId) return true;
  const seat = t.assigned_seat ?? null;
  return Boolean(seat && (SHARED_ROLE_SEATS as readonly string[]).includes(seat) && v.roleCodes.includes(seat));
}

/** Open and finished Tasks can be selected (finished ones for Reopen); carry overs and voided ones cannot. */
export function catchUpSelectable(v: CatchUpViewer, t: CatchUpTask): boolean {
  if (t.archived_at) return false;
  if (t.status === "carryover") return false;
  return canActOnTask(v, t);
}

/** Toggle one Task, or with Shift a range in the list the click came from. */
export function toggleSelection(
  current: ReadonlySet<string>,
  id: string,
  opts: { shift?: boolean; anchor?: string | null; order?: string[]; selectable?: ReadonlySet<string> } = {},
): Set<string> {
  const next = new Set(current);
  const turnOn = !current.has(id);
  const order = opts.order ?? [];
  const a = opts.anchor ? order.indexOf(opts.anchor) : -1;
  const b = order.indexOf(id);
  if (opts.shift && a >= 0 && b >= 0) {
    const [lo, hi] = a < b ? [a, b] : [b, a];
    for (const rid of order.slice(lo, hi + 1)) {
      if (opts.selectable && !opts.selectable.has(rid)) continue;
      if (turnOn) next.add(rid);
      else next.delete(rid);
    }
    return next;
  }
  if (turnOn) next.add(id);
  else next.delete(id);
  return next;
}

export type StageCheck = "none" | "some" | "all";

/** Stage header box: checked when every open Task in the stage is selected, a dash when some are. */
export function stageCheckState(stageIds: string[], openIds: string[], selected: ReadonlySet<string>): StageCheck {
  if (openIds.length > 0 && openIds.every((id) => selected.has(id))) return "all";
  return stageIds.some((id) => selected.has(id)) ? "some" : "none";
}

/** Pressing the stage box: select every open Task in it, or clear them when all are already selected. */
export function toggleStage(selected: ReadonlySet<string>, openIds: string[], state: StageCheck): Set<string> {
  const next = new Set(selected);
  if (state === "all") for (const id of openIds) next.delete(id);
  else for (const id of openIds) next.add(id);
  return next;
}

export type BarAction = "mark_done" | "not_needed" | "assign" | "due_date" | "reopen";

/** Item 2: the bar appears with one selected Task; Reopen only when every selected Task is finished. */
export function barActions(selected: CatchUpTask[]): BarAction[] {
  if (selected.length === 0) return [];
  const all = selected.every(isFinishedTask);
  return all ? ["mark_done", "not_needed", "assign", "due_date", "reopen"] : ["mark_done", "not_needed", "assign", "due_date"];
}

export function selectedLabel(n: number) {
  return `${n} selected`;
}

const DAY = 86_400_000;
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Date(d.getTime() + days * DAY).toISOString().slice(0, 10);
}
/** Earlier may go back up to two years (730 days), the same limit the database keeps. */
export function earliestDoneOn(today: string) {
  return addDays(today, -730);
}

export type DoneWhen = "today" | "earlier";

/** Item 3: one form for all selected Tasks. Returns the first problem, or null when it can save. */
export function markDoneProblem(input: { note: string; when: DoneWhen; doneOn: string | null; today: string; count: number }): string | null {
  if (input.count === 0) return "None of the selected Tasks can be marked done.";
  if (input.when === "earlier") {
    if (!input.doneOn) return "Pick the date it was done.";
    if (input.doneOn > input.today) return "Pick a date that is not in the future.";
    if (input.doneOn < earliestDoneOn(input.today)) return "Pick a date in the last two years.";
  }
  if (input.note.trim().length < 5) return "Add a note that says where the proof is (at least 5 characters).";
  return null;
}

/** Item 4: Not needed needs one reason. Reopen asks for one too, as the one-at-a-time Reopen does. */
export function reasonProblem(reason: string, count: number): string | null {
  if (count === 0) return "None of the selected Tasks can be changed.";
  return reason.trim().length < 3 ? "Add a reason (at least 3 characters)." : null;
}

export const NOT_NEEDED_EXAMPLES = ["No HOA", "Owner manages lawn", "No pool"] as const;

function monthDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
const tasks = (n: number) => `${n} Task${n === 1 ? "" : "s"}`;
const cards = (n: number) => `${n} owner card${n === 1 ? "" : "s"}`;

/** Item 6: the line after saving, for example "6 Tasks marked done (Oct 22). 5 owner cards will not be sent." */
export function resultLine(input: {
  action: BarAction;
  done: number;
  doneOn?: string | null;
  covered?: number;
  skipped?: number;
}): string {
  const parts: string[] = [];
  const n = input.done;
  if (input.action === "mark_done") parts.push(`${tasks(n)} marked done${input.doneOn ? ` (${monthDay(input.doneOn)})` : ""}.`);
  else if (input.action === "not_needed") parts.push(`${tasks(n)} marked not needed.`);
  else if (input.action === "assign") parts.push(`${tasks(n)} assigned.`);
  else if (input.action === "due_date") parts.push(`${tasks(n)} given a new due date.`);
  else parts.push(`${tasks(n)} reopened.`);
  if (input.covered) parts.push(`${cards(input.covered)} will not be sent.`);
  if (input.skipped) parts.push(`${tasks(input.skipped)} left as they are.`);
  return parts.join(" ");
}

export const UNDO_MINUTES = 10;
export function undoAvailable(savedAt: number, now: number = Date.now()) {
  return now - savedAt < UNDO_MINUTES * 60_000;
}

/** Roles offered by Assign to (the onboarding roles the database accepts). */
export const ASSIGN_ROLES = [
  "onboarding_director",
  "onboarding_manager",
  "onboarding_project_manager",
  "utilities",
  "lead_designer",
  "designer",
  "staging_team",
] as const;
