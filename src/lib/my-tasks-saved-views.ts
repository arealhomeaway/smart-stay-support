/**
 * My Tasks saved views, Filter panel count and the Kanban board (Nov 23, filters, search and views
 * items 1, 4 and 5). A saved view keeps every Filter panel choice, the grouping, the sort, the search,
 * List or Board and the board's home. Each person saves their own; nothing here reads or writes.
 */
import {
  MY_TASKS_PREFS_DEFAULTS,
  WORK_FILTER_LABELS,
  FOLLOWED_HOMES,
  normalizeMyTasksQuicks,
  parseMyTasksPrefs,
  type MyTasksPrefs,
} from "@/lib/onboarding-work-views";
import type { DerivedStatus, TaskView } from "@/lib/onboarding-workflow";

/** The page address part of a view (who, program, home, work state, search). */
export type MyTasksAddress = { who: string; program: string; home: string; state: string; q?: string };
export type MyTasksViewSettings = MyTasksAddress & MyTasksPrefs;
export type MyTasksSavedView = { id: string; name: string; settings: MyTasksViewSettings };

export const MY_TASKS_ADDRESS_DEFAULTS: MyTasksAddress = { who: "me", program: "all", home: "all", state: "all" };
const UUID = /^[0-9a-f-]{36}$/i;

export function settingsOf(address: MyTasksAddress, prefs: MyTasksPrefs): MyTasksViewSettings {
  const out: MyTasksViewSettings = { ...prefs, who: address.who, program: address.program, home: address.home, state: address.state };
  if (address.q) out.q = address.q.slice(0, 120);
  return out;
}

/** A stored view, kept valid the same way the page address and the remembered choices are. */
export function parseViewSettings(raw: unknown): MyTasksViewSettings {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const who = text(r["who"]);
  const program = text(r["program"]);
  const home = text(r["home"]);
  const state = text(r["state"]);
  const q = text(r["q"]).slice(0, 120);
  const out: MyTasksViewSettings = {
    ...parseMyTasksPrefs(r),
    who: who === "all" || who === "unassigned" || UUID.test(who) ? who : "me",
    program: ["all", "active_owner", "standard"].includes(program) ? program : "all",
    home: home === FOLLOWED_HOMES || UUID.test(home) ? home : "all",
    state: Object.hasOwn(WORK_FILTER_LABELS, state) ? state : "all",
  };
  if (q) out.q = q;
  return out;
}

/** Splits a view back into the page address and the remembered choices. */
export function openSettings(s: MyTasksViewSettings): { address: MyTasksAddress; prefs: MyTasksPrefs } {
  const v = parseViewSettings(s);
  const address: MyTasksAddress = { who: v.who, program: v.program, home: v.home, state: v.state };
  if (v.q) address.q = v.q;
  return {
    address,
    prefs: { quick: v.quick, sort: v.sort, group: v.group, from: v.from, to: v.to, types: v.types, layout: v.layout, board: v.board },
  };
}

/** How many Filter panel choices differ from the plain view (sort and grouping are not filters). */
export function activeFilterCount(address: MyTasksAddress, prefs: MyTasksPrefs, canBrowseTeam: boolean): number {
  const quick = normalizeMyTasksQuicks(prefs.quick);
  return [
    canBrowseTeam && address.who !== "me",
    address.program !== "all",
    address.home !== "all",
    address.state !== "all",
    !(quick.length === 1 && quick[0] === "incomplete"),
    Boolean(prefs.from || prefs.to),
    prefs.types.length > 0,
  ].filter(Boolean).length;
}

/** Clear filters: back to the plain view, keeping the sort, grouping, layout and board home. */
export function clearedFilters(prefs: MyTasksPrefs): { address: MyTasksAddress; prefs: MyTasksPrefs } {
  return {
    address: { ...MY_TASKS_ADDRESS_DEFAULTS },
    prefs: { ...prefs, quick: MY_TASKS_PREFS_DEFAULTS.quick, from: "", to: "", types: [] },
  };
}

/* ------------------------------------------------------------------ Kanban board */

export const KANBAN_COLUMNS = [
  { key: "todo", label: "To do" },
  { key: "doing", label: "In progress" },
  { key: "waiting", label: "Waiting" },
  { key: "done", label: "Done" },
] as const;
export type KanbanColumnKey = (typeof KANBAN_COLUMNS)[number]["key"];

const COLUMN_OF: Record<DerivedStatus, KanbanColumnKey> = {
  future: "todo",
  not_ready: "todo",
  ready: "todo",
  in_progress: "doing",
  correction: "doing",
  blocked: "waiting",
  needs_review: "waiting",
  complete: "done",
  carryover: "done",
};

export function kanbanColumnOf(status: DerivedStatus): KanbanColumnKey {
  return COLUMN_OF[status] ?? "todo";
}

/** One home's Tasks in the four columns, each keeping the order it was given. */
export function kanbanColumns(views: readonly TaskView[], propertyId: string) {
  return KANBAN_COLUMNS.map((c) => ({
    ...c,
    items: views.filter((v) => v.task.property_id === propertyId && kanbanColumnOf(v.status) === c.key),
  }));
}

/**
 * The home the board shows: the one picked for the board if it still has Tasks in view, else the
 * home picked in the Filter panel, else the first home in the list.
 */
export function boardHome(picked: string, filterHome: string, homesInView: readonly string[]): string | null {
  if (picked && homesInView.includes(picked)) return picked;
  if (UUID.test(filterHome) && homesInView.includes(filterHome)) return filterHome;
  return homesInView[0] ?? null;
}
