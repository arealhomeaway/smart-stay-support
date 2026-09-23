import type { TaskView } from "./onboarding-workflow";
import type { SearchSchemaInput } from "@tanstack/react-router";

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
export const WORKSPACE_TABS = ["overview", "work", "property", "files", "handoff"] as const;

export function parseWorkspaceSearch(search: {
  tab?: unknown;
  workFilter?: unknown;
  from?: unknown;
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
  const candidate = typeof search.tab === "string" ? (aliases[search.tab] ?? search.tab) : "overview";
  return {
    tab: (WORKSPACE_TABS as readonly string[]).includes(candidate) ? candidate : "overview",
    workFilter:
      typeof search.workFilter === "string" && Object.hasOwn(WORK_FILTER_LABELS, search.workFilter)
        ? (search.workFilter as WorkFilter)
        : ("all" as WorkFilter),
    ...(typeof search.from === "string" ? { from: search.from } : {}),
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

/** A step simple enough to tick off from a list: nothing to attach or approve. */
export function canQuickComplete(view: TaskView) {
  const t = view.task;
  return (
    view.canComplete &&
    !t.evidence_required &&
    !t.requires_owner_approval &&
    !(t.blocker ?? "").trim() &&
    !["needs_review", "correction", "complete"].includes(view.status)
  );
}

/** Team browsing is a work view, not an additional data permission. */
export function myWorkSelection<T extends { assigned_to: string | null; property_id: string }>(
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
      if (who === "me") return Boolean(viewerId) && task.assigned_to === viewerId;
      return inScope(task.property_id) && task.assigned_to === target;
    }),
  };
}

export function validateMyWorkSearch(
  search: { who?: unknown; program?: unknown; home?: unknown; state?: unknown } & SearchSchemaInput,
) {
  const text = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback);
  const who = text(search.who, "me");
  const program = text(search.program, "all");
  const state = text(search.state, "all");
  return {
    who: who === "unassigned" || who === "all" || /^[0-9a-f-]{36}$/i.test(who) ? who : "me",
    program: ["all", "active_owner", "standard"].includes(program) ? program : "all",
    home: /^[0-9a-f-]{36}$/i.test(text(search.home, "")) ? text(search.home, "all") : "all",
    state: Object.hasOwn(WORK_FILTER_LABELS, state) ? state : "all",
  };
}
