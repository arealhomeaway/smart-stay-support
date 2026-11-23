/**
 * Onboarding Task search and Task type (Nov 23, filters, search and views items 2 and 3).
 * One rule for My Tasks and a home's Tasks list: a search matches the Task's text (title and
 * description), its type, its assignee role and its tags (plan tags and the Whose Task tag).
 * Pure and browser-safe.
 */
import { TASK_KIND_LABEL, type TaskKindCode } from "@/lib/onboarding-task-kinds";
import { taskRoleLabel } from "@/lib/onboarding-workflow";

export type SearchableTask = {
  title: string;
  description?: string | null;
  detail?: string | null;
  task_kind?: string | null;
  assigned_seat?: string | null;
  tags?: readonly string[] | null;
};

/** Task types, in the order the Filter panel lists them. */
export const TASK_TYPE_ORDER = [
  "project_manager",
  "designer",
  "utilities",
  "homeowner",
  "onboarding_manager",
  "director",
  "operations",
  "none",
] as const;
export type TaskTypeCode = (typeof TASK_TYPE_ORDER)[number];

export const TASK_TYPE_LABEL: Record<TaskTypeCode, string> = {
  project_manager: "Project Manager",
  designer: "Designer",
  utilities: "Utilities",
  homeowner: "Homeowner",
  onboarding_manager: "Onboarding Manager",
  director: "Director of Onboarding",
  operations: "Operations",
  none: "No role",
};

const DESIGN_SEATS = new Set(["designer", "lead_designer", "design_staging"]);
const OPERATIONS_SEATS = new Set(["director_ops", "director_operations", "operations_supervisor", "property_coordinator"]);

/** A Task's type: Homeowner for homeowner work, else the plan role it belongs to. */
export function taskTypeOf(t: Pick<SearchableTask, "task_kind" | "assigned_seat">): TaskTypeCode {
  if (t.task_kind === "send_to_owner") return "homeowner";
  const seat = t.assigned_seat ?? null;
  if (!seat) return "none";
  if (DESIGN_SEATS.has(seat)) return "designer";
  if (seat === "utilities") return "utilities";
  if (seat === "onboarding_project_manager" || seat === "project_manager") return "project_manager";
  if (seat === "onboarding_manager") return "onboarding_manager";
  if (seat === "onboarding_director" || seat === "director_onboarding") return "director";
  if (OPERATIONS_SEATS.has(seat)) return "operations";
  return "none";
}

export function isTaskTypeCode(v: unknown): v is TaskTypeCode {
  return typeof v === "string" && (TASK_TYPE_ORDER as readonly string[]).includes(v);
}

/** No type picked shows every Task; otherwise a Task shows when its type is one picked. */
export function matchesTaskTypes(t: Pick<SearchableTask, "task_kind" | "assigned_seat">, types: readonly TaskTypeCode[]): boolean {
  return types.length === 0 || types.includes(taskTypeOf(t));
}

/** The one search bar wording, on My Tasks and inside a home's Tasks list. */
export const TASK_SEARCH_PLACEHOLDER = "Search task, type, role or tag";

const norm = (s: string) => s.toLocaleLowerCase().replace(/[_\s]+/g, " ").trim();

const TAG_WORDS: Record<string, string> = { active_owner: "Active Owner" };

/** Every word a search can match on one Task. `extra` adds page words such as the Whose Task tag. */
export function taskSearchText(t: SearchableTask, extra: readonly (string | null | undefined)[] = []): string {
  const kind = t.task_kind && t.task_kind in TASK_KIND_LABEL ? TASK_KIND_LABEL[t.task_kind as TaskKindCode] : "";
  const role = taskRoleLabel({ assigned_seat: t.assigned_seat ?? null }) ?? "";
  const tags = (t.tags ?? []).map((tag) => TAG_WORDS[tag] ?? tag);
  return norm(
    [t.title, t.description ?? "", t.detail ?? "", kind, TASK_TYPE_LABEL[taskTypeOf(t)], role, ...tags, ...extra.map((x) => x ?? "")].join(" | "),
  );
}

/** Blank search matches everything. Every word typed must appear somewhere in the Task's words. */
export function matchesTaskSearch(t: SearchableTask, term: string, extra: readonly (string | null | undefined)[] = []): boolean {
  const words = norm(term).split(" ").filter(Boolean);
  if (words.length === 0) return true;
  const text = taskSearchText(t, extra);
  return words.every((w) => text.includes(w));
}
