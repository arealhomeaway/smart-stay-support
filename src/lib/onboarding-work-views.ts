import type { TaskView } from "./onboarding-workflow";
import type { SearchSchemaInput } from "@tanstack/react-router";

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
  return { tab: workFilter === "all" ? "overview" : "workflow", workFilter };
}

export function parseWorkspaceSearch(search: {
  tab?: unknown;
  workFilter?: unknown;
  from?: unknown;
}) {
  const aliases: Record<string, string> = {
    timeline: "workflow",
    calendar: "workflow",
    files: "property",
    work: "workflow",
    history: "activity",
  };
  const candidate =
    typeof search.tab === "string" ? (aliases[search.tab] ?? search.tab) : "overview";
  return {
    tab: [
      "overview",
      "workflow",
      "property",
      "budget",
      "findings",
      "workorders",

      "vendors",
      "financial",
      "handoff",
      "activity",
    ].includes(candidate)
      ? candidate
      : "overview",
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
    who:
      who === "unassigned" || who === "all" || /^[0-9a-f-]{36}$/i.test(who) ? who : "me",
    program: ["all", "active_owner", "standard"].includes(program) ? program : "all",
    home: /^[0-9a-f-]{36}$/i.test(text(search.home, "")) ? text(search.home, "all") : "all",
    state: Object.hasOwn(WORK_FILTER_LABELS, state) ? state : "all",
  };
}
