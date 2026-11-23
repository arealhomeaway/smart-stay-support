import { taskRoleLabel, type TaskView } from "./onboarding-workflow";
import type { SearchSchemaInput } from "@tanstack/react-router";
import { ownerOfTask } from "./plan-task-owner";
import { isTaskTypeCode, type TaskTypeCode } from "./onboarding-task-search";

export const PROPERTY_QUEUE_FILTER_LABELS = {
  mine: "My Tasks",
  attention: "Needs attention",
  open: "Open",
  waiting: "Waiting",
  completed: "Completed",
  voided: "Voided",
  all: "All",
} as const;
export type PropertyQueueFilter = keyof typeof PROPERTY_QUEUE_FILTER_LABELS | "ready";

function isFinished(view: TaskView) {
  return view.status === "complete" || view.status === "carryover";
}

export function isWaitingTask(view: TaskView) {
  return (
    ["blocked", "not_ready", "needs_review", "future"].includes(view.status) ||
    view.task.owner_approval_status === "awaiting_owner"
  );
}

export function matchesPropertyQueueFilter(
  view: TaskView,
  filter: PropertyQueueFilter,
  viewerId: string | null,
) {
  if (filter === "mine") return !isFinished(view) && view.task.assigned_to === viewerId;
  if (filter === "completed") return isFinished(view);
  if (filter === "open") return !isFinished(view);
  if (filter === "ready") return !isFinished(view) && view.status === "ready";
  // Voided Tasks are archived records, listed separately by the queue.
  if (filter === "voided") return false;
  if (filter === "waiting") return !isFinished(view) && isWaitingTask(view);
  if (filter === "attention") {
    return (
      !isFinished(view) &&
      (view.overdue ||
        view.status === "correction" ||
        view.status === "in_progress" ||
        Boolean((view.task.blocker ?? "").trim()))
    );
  }
  return true;
}

/** One stable queue: workable steps first, waiting work next, finished history last. */
export function orderPropertyWorkQueue(views: TaskView[]) {
  const rank = (view: TaskView) => {
    if (isFinished(view)) return 3;
    if (isWaitingTask(view)) return 2;
    return 1;
  };

  return [...views].sort((a, b) => {
    const rankDifference = rank(a) - rank(b);
    if (rankDifference) return rankDifference;
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const aDue = a.task.due_on ?? "";
    const bDue = b.task.due_on ?? "";
    if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
    if (aDue !== bDue) return aDue ? -1 : 1;
    return a.task.sort_order - b.task.sort_order;
  });
}

export const WORK_FILTER_LABELS = {
  all: "All work",
  attention: "Needs attention",
  blocked: "Waiting",
  corrections: "Corrections",
  review: "Awaiting review",
} as const;
export type WorkFilter = keyof typeof WORK_FILTER_LABELS;
export function matchesWorkFilter(view: TaskView, filter: WorkFilter, stageStatus?: string) {
  if (filter === "all") return true;
  if (filter === "review")
    return view.status === "needs_review" || stageStatus === "awaiting_review";
  if (filter === "corrections")
    return view.status === "correction" || stageStatus === "correction_required";
  if (filter === "blocked") return view.status === "blocked" || view.status === "not_ready";
  return (
    view.overdue ||
    ["ready", "in_progress", "correction", "needs_review", "blocked"].includes(view.status) ||
    ["awaiting_review", "correction_required"].includes(stageStatus ?? "")
  );
}

export function workspaceSearchFromLens(lens: string, hasHandoffGate: boolean) {
  if ((lens === "review" || lens === "mine") && hasHandoffGate)
    return { tab: "handoff", workFilter: "all" as WorkFilter };
  const workFilter: WorkFilter =
    lens === "corrections"
      ? "corrections"
      : lens === "blocked"
        ? "blocked"
        : lens === "review" || lens === "mine"
          ? "review"
          : lens === "attention" || lens === "at_risk"
            ? "attention"
            : "all";
  return { tab: "work", workFilter };
}

/** Five tabs: Overview, Tasks ("work"), Property Details, Files & History, Handoff. */
export const WORKSPACE_TABS = ["overview", "work", "active-owner", "property", "files", "handoff"] as const;

export function parseWorkspaceSearch(search: {
  tab?: unknown;
  workFilter?: unknown;
  from?: unknown;
  task?: unknown;
  opp?: unknown;
}) {
  // Older links used nine tabs; send each to the tab that now holds it.
  const aliases: Record<string, string> = {
    tasks: "work",
    workflow: "work",
    timeline: "work",
    calendar: "work",
    budget: "property",
    findings: "property",
    workorders: "property",
    vendors: "property",
    financial: "property",
    activity: "files",
    history: "files",
  };
  // A tab the person picked always wins. A linked Opportunity only chooses the
  // starting tab, so it can never lock someone out of Tasks or other tabs.
  const candidate =
    typeof search.tab === "string"
      ? (aliases[search.tab] ?? search.tab)
      : typeof search.opp === "string" && typeof search.task !== "string"
        ? "active-owner"
        : "overview";
  return {
    tab: (WORKSPACE_TABS as readonly string[]).includes(candidate) ? candidate : "overview",
    workFilter:
      typeof search.workFilter === "string" && Object.hasOwn(WORK_FILTER_LABELS, search.workFilter)
        ? (search.workFilter as WorkFilter)
        : ("all" as WorkFilter),
    ...(typeof search.from === "string" ? { from: search.from } : {}),
    ...(typeof search.task === "string" ? { task: search.task } : {}),
    ...(typeof search.opp === "string" ? { opp: search.opp } : {}),
  };
}

// Router input is optional even though the parsed output supplies defaults.
export const validateWorkspaceSearch = (
  search: Parameters<typeof parseWorkspaceSearch>[0] & SearchSchemaInput,
) => parseWorkspaceSearch(search);

/** Each task appears in exactly one daily-work group. Future work never looks actionable. */
export function groupMyWork(views: TaskView[], today: string) {
  const groups = [
    { key: "correction", label: "Corrections", hint: "Returned work needing a correction." },
    { key: "review", label: "Needs review", hint: "Evidence or a decision is outstanding." },
    { key: "blocked", label: "Waiting", hint: "A blocker or prerequisite must clear first." },
    { key: "overdue", label: "Overdue", hint: "Released work past its due date." },
    { key: "today", label: "Due today", hint: "Released work scheduled for today." },
    { key: "upcoming", label: "Upcoming", hint: "Released work dated for a later day." },
    { key: "undated", label: "No date yet", hint: "Released work without a scheduled date." },
    {
      key: "future",
      label: "Future",
      hint: "Not released yet; waiting on an earlier stage or milestone.",
    },
  ].map((group) => ({ ...group, items: [] as TaskView[] }));
  for (const view of views) {
    if (view.status === "complete" || view.status === "carryover") continue;
    const key =
      view.status === "correction"
        ? "correction"
        : view.status === "needs_review"
          ? "review"
          : ["blocked", "not_ready"].includes(view.status)
            ? "blocked"
            : view.status === "future"
              ? "future"
              : view.overdue
                ? "overdue"
                : view.task.due_on === today
                  ? "today"
                  : view.task.due_on && view.task.due_on > today
                    ? "upcoming"
                    : "undated";
    groups.find((group) => group.key === key)!.items.push(view);
  }
  return groups;
}

/**
 * My Work's three everyday buckets (plus a collapsed "Later" so nothing
 * disappears): due today & overdue, upcoming this week, blocked / waiting.
 */
export function groupMyWorkSimple(views: TaskView[], today: string) {
  const weekEnd = new Date(`${today}T12:00:00Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  const end = weekEnd.toISOString().slice(0, 10);
  const groups = [
    {
      key: "due",
      label: "Due today & overdue",
      hint: "Past due, due today, or returned for a correction.",
    },
    { key: "week", label: "Upcoming this week", hint: "Due in the next seven days." },
    {
      key: "blocked",
      label: "Blocked / Waiting on others",
      hint: "A blocker, prerequisite, review or homeowner answer must come first.",
    },
    { key: "later", label: "Later & undated", hint: "Due after this week, or not dated yet." },
  ].map((group) => ({ ...group, items: [] as TaskView[] }));
  for (const view of views) {
    if (view.status === "complete" || view.status === "carryover") continue;
    const due = view.task.due_on;
    const key =
      view.status === "correction" ||
      (view.overdue && !["blocked", "not_ready"].includes(view.status))
        ? "due"
        : ["blocked", "not_ready", "needs_review", "future"].includes(view.status) ||
            view.task.owner_approval_status === "awaiting_owner"
          ? "blocked"
          : due && due <= today
            ? "due"
            : due && due <= end
              ? "week"
              : "later";
    groups.find((group) => group.key === key)!.items.push(view);
  }
  return groups;
}

// ============= My Tasks: quick filters, sorting, grouping, saved view =============

export const MY_TASKS_QUICK_LABELS = {
  incomplete: "Incomplete",
  completed: "Completed",
  due_today: "Due today",
  this_week: "Due this week",
  next_week: "Due next week",
  overdue: "Overdue",
} as const;
export type MyTasksQuick = keyof typeof MY_TASKS_QUICK_LABELS;
export type MyTasksSort = "due" | "home";
export type MyTasksGroup = "due" | "home" | "role";

/** Monday-start week bounds around a YYYY-MM-DD today, as date strings. */
export function myTasksWeeks(today: string) {
  const day = new Date(`${today}T12:00:00Z`);
  const sinceMonday = (day.getUTCDay() + 6) % 7;
  const start = new Date(day);
  start.setUTCDate(day.getUTCDate() - sinceMonday);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const DAY = 24 * 60 * 60 * 1000;
  return {
    thisStart: iso(start),
    thisEnd: iso(new Date(start.getTime() + 6 * DAY)),
    nextStart: iso(new Date(start.getTime() + 7 * DAY)),
    nextEnd: iso(new Date(start.getTime() + 13 * DAY)),
  };
}

function isFinishedTask(view: TaskView) {
  return view.status === "complete" || view.status === "carryover";
}

/** One quick filter button's rule. Date filters only apply to work still open. */
export function matchesMyTasksQuick(view: TaskView, quick: MyTasksQuick, today: string) {
  if (quick === "completed") return isFinishedTask(view);
  if (isFinishedTask(view)) return false;
  if (quick === "incomplete") return true;
  const due = view.task.due_on;
  const weeks = myTasksWeeks(today);
  if (quick === "due_today") return due === today;
  if (quick === "overdue") return view.overdue || Boolean(due && due < today);
  if (quick === "this_week") return Boolean(due && due >= weeks.thisStart && due <= weeks.thisEnd);
  return Boolean(due && due >= weeks.nextStart && due <= weeks.nextEnd);
}

/** The four date buttons; any number can be on at once. */
export const MY_TASKS_DATE_QUICKS: readonly MyTasksQuick[] = ["due_today", "this_week", "next_week", "overdue"];
const isDateQuick = (q: MyTasksQuick) => MY_TASKS_DATE_QUICKS.includes(q);
const QUICK_ORDER = Object.keys(MY_TASKS_QUICK_LABELS) as MyTasksQuick[];

/**
 * The buttons that are on, kept valid: Completed alone, Incomplete alone, or one or more date
 * buttons. Anything else (empty, unknown, a mix) falls back the same way a click would.
 */
export function normalizeMyTasksQuicks(input: readonly MyTasksQuick[]): MyTasksQuick[] {
  const on = QUICK_ORDER.filter((q) => input.includes(q));
  if (on.includes("completed") && on.length === 1) return ["completed"];
  const dates = on.filter(isDateQuick);
  if (dates.length > 0) return dates;
  if (on.includes("completed")) return ["completed"];
  return ["incomplete"];
}

/**
 * One button press. Completed and Incomplete each turn every other button off. A date button
 * turns Completed and Incomplete off; turning the last date button off turns Incomplete back on.
 * Pressing Completed or Incomplete while it is on goes back to Incomplete, so one view is always on.
 */
export function toggleMyTasksQuick(current: readonly MyTasksQuick[], key: MyTasksQuick): MyTasksQuick[] {
  const on = normalizeMyTasksQuicks(current);
  if (key === "completed") return on.includes("completed") ? ["incomplete"] : ["completed"];
  if (key === "incomplete") return ["incomplete"];
  if (on.includes(key)) return normalizeMyTasksQuicks(on.filter((q) => q !== key));
  return normalizeMyTasksQuicks([...on.filter(isDateQuick), key]);
}

/** A Task shows if it matches ANY button that is on. */
export function matchesMyTasksQuicks(view: TaskView, quicks: readonly MyTasksQuick[], today: string) {
  return normalizeMyTasksQuicks(quicks).some((q) => matchesMyTasksQuick(view, q, today));
}

/** Optional due-date range on top of the quick filter. Undated work only shows with no range. */
export function matchesMyTasksDueRange(view: TaskView, from: string, to: string) {
  if (!from && !to) return true;
  const due = view.task.due_on;
  if (!due) return false;
  if (from && due < from) return false;
  if (to && due > to) return false;
  return true;
}

/** Due date (oldest first, undated last) or home name then due date. */
export function sortMyTasks(
  views: TaskView[],
  sort: MyTasksSort,
  homeName: (propertyId: string) => string,
) {
  const byDue = (a: TaskView, b: TaskView) => {
    const aDue = a.task.due_on ?? "9999-12-31";
    const bDue = b.task.due_on ?? "9999-12-31";
    if (aDue !== bDue) return aDue.localeCompare(bDue);
    return a.task.sort_order - b.task.sort_order;
  };
  return [...views].sort((a, b) => {
    if (sort === "home") {
      const aName = homeName(a.task.property_id);
      const bName = homeName(b.task.property_id);
      if (aName !== bName) return aName.localeCompare(bName);
    }
    return byDue(a, b);
  });
}

/**
 * Nov 21: one group per Task role, Utilities first so utilities work is together and easy to find,
 * then the other roles by name, Tasks with no role last. Items keep the sort already applied.
 */
export function groupMyTasksByRole(views: TaskView[]) {
  const labelOf = (v: TaskView) => taskRoleLabel(v.task) ?? "";
  const labels = [...new Set(views.map(labelOf))].sort((a, b) => {
    const rank = (l: string) => (l === "Utilities" ? 0 : l === "" ? 2 : 1);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return labels.map((label) => ({
    key: `role:${label || "none"}`,
    label: label || "No role",
    hint: label === "Utilities" ? "Every utilities Task, all homes." : label ? `${label} Tasks.` : "Tasks with no role.",
    items: views.filter((v) => labelOf(v) === label),
  }));
}

/** Nov 22: in the due-date grouping, Later and No date start folded; every other group starts open. */
export const MY_TASKS_FOLDED_GROUPS = ["later", "nodate"] as const;
export function myTasksGroupStartsOpen(group: MyTasksGroup, key: string) {
  return group !== "due" || !(MY_TASKS_FOLDED_GROUPS as readonly string[]).includes(key);
}

/** Group by due date buckets or by home. Items keep the sort already applied. */
export function groupMyTasks(
  views: TaskView[],
  group: MyTasksGroup,
  today: string,
  homeName: (propertyId: string) => string,
) {
  if (group === "role") return groupMyTasksByRole(views);
  if (group === "home") {
    const names = [...new Set(views.map((v) => homeName(v.task.property_id)))].sort((a, b) =>
      a.localeCompare(b),
    );
    return names.map((name) => ({
      key: `home:${name}`,
      label: name,
      hint: "Tasks at this home.",
      items: views.filter((v) => homeName(v.task.property_id) === name),
    }));
  }
  const weeks = myTasksWeeks(today);
  const groups = [
    { key: "overdue", label: "Overdue", hint: "Past its due date." },
    { key: "today", label: "Today", hint: "Due today." },
    { key: "week", label: "This week", hint: "Due later this week." },
    { key: "later", label: "Later", hint: "Due after this week." },
    { key: "nodate", label: "No date", hint: "Not dated yet." },
  ].map((g) => ({ ...g, items: [] as TaskView[] }));
  for (const view of views) {
    const due = view.task.due_on;
    const key = !due
      ? "nodate"
      : due < today
        ? "overdue"
        : due === today
          ? "today"
          : due <= weeks.thisEnd
            ? "week"
            : "later";
    groups.find((g) => g.key === key)!.items.push(view);
  }
  return groups;
}

export type MyTasksLayout = "list" | "board";
export type MyTasksPrefs = {
  /** The quick filter buttons that are on, as a list. */
  quick: MyTasksQuick[];
  sort: MyTasksSort;
  group: MyTasksGroup;
  from: string;
  to: string;
  /** Nov 23: Task types picked in the Filter panel; none picked shows every type. */
  types: TaskTypeCode[];
  /** Nov 23: List, or the Kanban board for one home. */
  layout: MyTasksLayout;
  /** The home the board shows (a property id), or "" for the first home in the list. */
  board: string;
};
export const MY_TASKS_PREFS_DEFAULTS: MyTasksPrefs = {
  quick: ["incomplete"],
  sort: "due",
  group: "due",
  from: "",
  to: "",
  types: [],
  layout: "list",
  board: "",
};

export function myTasksPrefsKey(userId: string | null) {
  return `resolve.myTasks.prefs.${userId ?? "anonymous"}`;
}

/** Any stored view choices (browser or the person's saved record), kept valid; unknown parts fall back. */
export function parseMyTasksPrefs(raw: unknown): MyTasksPrefs {
  if (!raw || typeof raw !== "object") return MY_TASKS_PREFS_DEFAULTS;
  const parsed = raw as Partial<Record<keyof MyTasksPrefs, unknown>>;
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  return {
    // A view saved before the buttons combined is one value; it loads as that one button.
    quick: normalizeMyTasksQuicks(
      (Array.isArray(parsed.quick) ? parsed.quick : [parsed.quick]).filter(
        (q): q is MyTasksQuick => typeof q === "string" && Object.hasOwn(MY_TASKS_QUICK_LABELS, q),
      ),
    ),
    sort: parsed.sort === "home" ? "home" : "due",
    group: parsed.group === "home" || parsed.group === "role" ? parsed.group : "due",
    from: date(parsed.from),
    to: date(parsed.to),
    types: Array.isArray(parsed.types) ? [...new Set(parsed.types.filter(isTaskTypeCode))] : [],
    layout: parsed.layout === "board" ? "board" : "list",
    board: typeof parsed.board === "string" && /^[0-9a-f-]{36}$/i.test(parsed.board) ? parsed.board : "",
  };
}

/** Each person's last My Tasks view, remembered in their own browser. */
export function loadMyTasksPrefs(
  storage: Pick<Storage, "getItem"> | null,
  userId: string | null,
): MyTasksPrefs {
  if (!storage) return MY_TASKS_PREFS_DEFAULTS;
  try {
    const raw = storage.getItem(myTasksPrefsKey(userId));
    if (!raw) return MY_TASKS_PREFS_DEFAULTS;
    return parseMyTasksPrefs(JSON.parse(raw));
  } catch {
    return MY_TASKS_PREFS_DEFAULTS;
  }
}

export function saveMyTasksPrefs(
  storage: Pick<Storage, "setItem"> | null,
  userId: string | null,
  prefs: MyTasksPrefs,
) {
  if (!storage) return;
  try {
    storage.setItem(myTasksPrefsKey(userId), JSON.stringify(prefs));
  } catch {
    // Private browsing or a full quota: the view still works, it just is not remembered.
  }
}

/** A step simple enough to tick off from a list: nothing to attach or approve. */
export function canQuickComplete(view: TaskView) {
  const t = view.task;
  return (
    view.canComplete &&
    !t.requires_owner_approval &&
    !(t.blocker ?? "").trim() &&
    !["needs_review", "correction", "complete"].includes(view.status)
  );
}

/** Team browsing is a work view, not an additional data permission. */
export function myWorkSelection<T extends { assigned_to: string | null; plan_owner?: string | null; property_id: string }>(
  tasks: T[],
  viewerId: string | null,
  requested: string,
  supervisor: boolean,
  projects: {
    property_id: string;
    project_manager: string | null;
    director: string | null;
    status: string;
  }[],
) {
  const managed = new Set(
    projects
      .filter(
        (p) =>
          p.status !== "cancelled" &&
          viewerId &&
          (p.project_manager === viewerId || p.director === viewerId),
      )
      .map((p) => p.property_id),
  );
  const canBrowseTeam = supervisor || managed.size > 0;
  const who = canBrowseTeam ? requested : "me";
  const target = who === "me" ? viewerId : who === "unassigned" ? null : who;
  const inScope = (propertyId: string) => supervisor || managed.has(propertyId);
  return {
    canBrowseTeam,
    who,
    tasks: tasks.filter((task) => {
      // "all" shows every task the viewer is allowed to see, so work can be
      // filtered and dispatched without hunting through each home.
      if (who === "all") return inScope(task.property_id);
      // A person's Tasks are the ones planTaskOwner gives them: named, their role on the home, or
      // unassigned on a home they run as PM. Date, stage and kind never take a Task out.
      if (who === "me") return Boolean(viewerId) && ownerOfTask(task) === viewerId;
      if (who === "unassigned") return inScope(task.property_id) && task.assigned_to === null;
      return inScope(task.property_id) && ownerOfTask(task) === target;
    }),
  };
}

export const FOLLOWED_HOMES = "followed";

/**
 * Part 3 (3.5): Tasks on the homes a person added to My homes. Every Task on those homes, or only
 * one person's (or Unassigned) when chosen; never homes outside the list.
 */
export function followedHomeTasks<T extends { assigned_to: string | null; plan_owner?: string | null; property_id: string }>(
  tasks: T[],
  followed: ReadonlySet<string>,
  who: string,
  viewerId: string | null,
): T[] {
  return tasks.filter((t) => {
    if (!followed.has(t.property_id)) return false;
    if (who === "all") return true;
    if (who === "unassigned") return t.assigned_to === null;
    if (who === "me") return true;
    return ownerOfTask(t) === who;
  });
}

export function validateMyWorkSearch(
  search: { who?: unknown; program?: unknown; home?: unknown; state?: unknown; task?: unknown; q?: unknown } & SearchSchemaInput,
) {
  const text = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
  const who = text(search.who, "me");
  const program = text(search.program, "all");
  const state = text(search.state, "all");
  // Nov 12 item 30: Search Resolve opens a Task's drawer here by its id.
  const task = text(search.task, "");
  // Nov 23: the search bar's words ride in the address so Back keeps them.
  const q = text(search.q, "").slice(0, 120);
  return {
    ...(/^[0-9a-f-]{36}$/i.test(task) ? { task } : {}),
    ...(q ? { q } : {}),
    who: who === "unassigned" || who === "all" || /^[0-9a-f-]{36}$/i.test(who) ? who : "me",
    program: ["all", "active_owner", "standard"].includes(program) ? program : "all",
    // Part 3 (3.5): "followed" is the homes in the viewer's My homes list.
    home: /^[0-9a-f-]{36}$/i.test(text(search.home, "")) || text(search.home, "") === FOLLOWED_HOMES ? text(search.home, "all") : "all",
    state: Object.hasOwn(WORK_FILTER_LABELS, state) ? state : "all",
  };
}
