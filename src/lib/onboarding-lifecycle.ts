/**
 * Onboarding lifecycle model (browser-safe, pure, read-only).
 *
 * Resolve owns the journey. This module answers, for one home, the only four
 * questions the team actually asks:
 *
 *   Where is this project?      -> deriveStage()
 *   What happens next?          -> deriveNextAction()
 *   What is it waiting on?      -> deriveBlockers()
 *   Is it going to make it?     -> deriveRisk()
 *
 * Everything is derived at read time from records that already exist
 * (`onboarding_tasks`, the property row, the open handoff). No new schema, no
 * persisted status, no permission or routing decisions. The backend workflow —
 * dependencies, anchors, evidence, owner approval, handoff gates — is
 * untouched; this only makes it legible.
 */

import { GATE_STEPS, gateLabel } from "./onboarding";
import { rollupProperty, viewTask, type TaskView, type WorkflowTask } from "./onboarding-workflow";
import type { WorkState } from "./semantic";

/* ------------------------------------------------------------ the lifecycle */

export type LifecycleStage =
  | "pre_close"
  | "access_ready"
  | "setup"
  | "furnishing_repairs"
  | "final_prep"
  | "director_review"
  | "operations_review"
  | "live";

export const LIFECYCLE_STAGES: {
  value: LifecycleStage;
  label: string;
  blurb: string;
  /** Onboarding is a design team's workspace: stages carry their own colour. */
  accent: string;
}[] = [
  {
    value: "pre_close",
    label: "Pre-Close",
    blurb: "Contract signed, no access yet. Nothing onsite can start.",
    accent: "bg-slate-100 text-slate-700 border-slate-200",
  },
  {
    value: "access_ready",
    label: "Access Ready",
    blurb: "Access confirmed. Assessment and setup can begin.",
    accent: "bg-sky-100 text-sky-800 border-sky-200",
  },
  {
    value: "setup",
    label: "Setup",
    blurb: "Utilities, internet, access devices and property information.",
    accent: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  {
    value: "furnishing_repairs",
    label: "Furnishing / Repairs",
    blurb: "Purchasing, delivery, assembly, staging and approved repairs.",
    accent: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  },
  {
    value: "final_prep",
    label: "Final Prep",
    blurb: "Cleaning, photography, readiness evidence.",
    accent: "bg-amber-100 text-amber-900 border-amber-200",
  },
  {
    value: "director_review",
    label: "Director Review",
    blurb: "Director of Onboarding verifies the readiness record.",
    accent: "bg-violet-100 text-violet-800 border-violet-200",
  },
  {
    value: "operations_review",
    label: "Operations Review",
    blurb: "Operations reviews exceptions and accepts the home.",
    accent: "bg-teal-100 text-teal-800 border-teal-200",
  },
  {
    value: "live",
    label: "Live",
    blurb: "Operations confirmed the home is live. Handoff complete.",
    accent: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
];

export function lifecycleStageMeta(value: LifecycleStage) {
  return LIFECYCLE_STAGES.find((s) => s.value === value) ?? LIFECYCLE_STAGES[0]!;
}

export function stageIndex(value: LifecycleStage) {
  return LIFECYCLE_STAGES.findIndex((s) => s.value === value);
}

/** The workflow phase each stored task stage belongs to. */
const PHASE_STAGE: Record<string, LifecycleStage> = {
  post_contract: "pre_close",
  phase1_inspection: "access_ready",
  phase2_estimates: "setup",
  phase3_work_orders: "setup",
  phase4_purchasing: "furnishing_repairs",
  phase5_monitor: "furnishing_repairs",
  phase6_handoff: "final_prep",
};

export function lifecycleStageForTask(taskStage: string): LifecycleStage {
  return PHASE_STAGE[taskStage] ?? "setup";
}

/* ------------------------------------------------------------------ inputs */

export type ProjectProperty = {
  id: string;
  name: string;
  lifecycle_status: string | null;
  onboarding_stage: string | null;
  onboarding_owner: string | null;
  actual_access_on?: string | null;
  actual_closing_on?: string | null;
  planned_closing_on?: string | null;
  handoff_accepted_at?: string | null;
  access_notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type OpenHandoff = {
  id: string;
  property_id: string;
  status: string;
  gate_step: string | null;
} | null;

export type ProjectInput = {
  property: ProjectProperty;
  tasks: WorkflowTask[];
  handoff: OpenHandoff;
};

/* ------------------------------------------------------------------- stage */

export function deriveStage(input: ProjectInput): LifecycleStage {
  const { property, handoff, tasks } = input;

  if (property.lifecycle_status === "active_operations" || property.handoff_accepted_at)
    return "live";

  if (handoff) {
    const step = handoff.gate_step ?? "kati_review";
    if (step === "kati_review") return "director_review";
    if (step === "live_confirmation") return "operations_review";
    if (step === "complete") return "live";
    return "operations_review";
  }
  if (property.lifecycle_status === "handoff_corrections") return "director_review";

  // Access is the hard gate: nothing onsite is real before it.
  const hasAccess =
    Boolean(property.actual_access_on) || Boolean((property.access_notes ?? "").trim());
  if (!hasAccess) return "pre_close";

  // Otherwise the stage is the earliest phase with unfinished work.
  const views = tasks.map((t) => viewTask(t, tasks));
  const open = views.filter((v) => v.status !== "complete" && v.status !== "carryover");
  if (open.length === 0) return tasks.length === 0 ? "access_ready" : "final_prep";

  const earliest = open
    .map((v) => stageIndex(lifecycleStageForTask(v.task.stage)))
    .sort((a, b) => a - b)[0]!;
  const stage = LIFECYCLE_STAGES[Math.max(earliest, 1)]!.value;
  return stage;
}

/* ------------------------------------------------------------- next action */

export type NextAction = {
  /** The dominant line: what happens next, in the team's words. */
  headline: string;
  /** Why this is next, or what is standing in the way. */
  detail: string;
  /** A task the user should open to do it, when there is exactly one. */
  taskId: string | null;
  /** True when no ARHA person can act yet. */
  waiting: boolean;
};

export function deriveNextAction(input: ProjectInput): NextAction {
  const { property, tasks, handoff } = input;
  const stage = deriveStage(input);

  if (stage === "live")
    return {
      headline: "Handoff complete",
      detail: "This home is live with Operations. Nothing further is required from onboarding.",
      taskId: null,
      waiting: false,
    };

  if (handoff)
    return {
      headline: gateLabel(handoff.gate_step),
      detail:
        "The readiness record is at a review gate. The reviewer either accepts it or returns exact corrections.",
      taskId: null,
      waiting: true,
    };

  if (stage === "pre_close")
    return {
      headline: "Waiting for closing and access",
      detail: property.planned_closing_on
        ? `Planned closing ${property.planned_closing_on}. No onsite work is available until access is confirmed.`
        : "No team action is available until closing and access are confirmed.",
      taskId: null,
      waiting: true,
    };

  if (tasks.length === 0)
    return {
      headline: "Create the onboarding project",
      detail:
        "Apply the standard ARHA workflow so this home gets its stages, dates and dependencies.",
      taskId: null,
      waiting: false,
    };

  const views = tasks.map((t) => viewTask(t, tasks));
  const open = views.filter((v) => v.status !== "complete" && v.status !== "carryover");

  if (open.length === 0)
    return {
      headline: "Request handoff",
      detail: "Every onboarding step is finished. Send the readiness record to Director Review.",
      taskId: null,
      waiting: false,
    };

  // Actionable work first, oldest due date wins; only then explain the wait.
  const actionable = open
    .filter((v) => v.status === "ready" || v.status === "in_progress")
    .sort((a, b) => (a.task.due_on ?? "9999").localeCompare(b.task.due_on ?? "9999"));

  const first = actionable[0];
  if (first)
    return {
      headline: first.task.title,
      detail:
        first.task.detail?.trim() ||
        (first.task.due_on ? `Due ${first.task.due_on}.` : "Next step in the current stage."),
      taskId: first.task.id,
      waiting: false,
    };

  const blockers = deriveBlockers(input);
  const b = blockers[0];
  return {
    headline: b ? b.what : "Waiting on earlier work",
    detail: b
      ? `${b.owner} owns the next step${b.followUp ? ` · follow up ${b.followUp}` : ""}.`
      : "Every remaining step is waiting on a prerequisite.",
    taskId: b?.taskId ?? null,
    waiting: true,
  };
}

/* ---------------------------------------------------------------- blockers */

export type Blocker = {
  taskId: string;
  /** What the project is waiting on. */
  what: string;
  /** Who owns the next step. */
  owner: string;
  /** When follow-up is due, when a date exists. */
  followUp: string | null;
  kind:
    "owner" | "dependency" | "evidence" | "review" | "access" | "field" | "correction" | "other";
};

function blockerKind(v: TaskView): Blocker["kind"] {
  if (
    v.reason === "Blocked — Waiting on Owner" ||
    v.reason === "Blocked — Homeowner requested changes"
  )
    return "owner";
  if (v.status === "not_ready") return "dependency";
  if (v.reason === "Blocked — Missing Evidence") return "evidence";
  if (v.reason === "Blocked — Internal Review") return "review";
  if (v.template?.breezewayTemplateId) return "field";
  return "other";
}

const KIND_OWNER: Record<Blocker["kind"], string> = {
  owner: "Homeowner",
  dependency: "Onboarding team",
  evidence: "Assigned team member",
  review: "Reviewer",
  access: "Closing / access",
  field: "Field team (Breezeway)",
  correction: "Assigned team member",
  other: "Onboarding team",
};

/**
 * Blockers are first class: never "this project is blocked". Each one names
 * what is being waited on, who owns the next step, and when to follow up.
 */
export function deriveBlockers(input: ProjectInput): Blocker[] {
  const { property, tasks } = input;
  const out: Blocker[] = [];

  const hasAccess =
    Boolean(property.actual_access_on) || Boolean((property.access_notes ?? "").trim());
  if (!hasAccess)
    out.push({
      taskId: "",
      what: "Waiting on closing and access",
      owner: "Closing / access",
      followUp: property.planned_closing_on ?? null,
      kind: "access",
    });

  const views = tasks.map((t) => viewTask(t, tasks));
  for (const v of views) {
    if (v.status === "complete" || v.status === "carryover") continue;
    if (v.status !== "blocked" && v.status !== "needs_review" && v.status !== "not_ready") continue;
    const kind = blockerKind(v);
    out.push({
      taskId: v.task.id,
      what: v.reason ? `${v.task.title} — ${v.reason.replace(/^Blocked — /, "")}` : v.task.title,
      owner: KIND_OWNER[kind],
      followUp: v.task.due_on,
      kind,
    });
  }

  // Homeowner and access waits are the ones that quietly kill a schedule.
  const weight: Record<Blocker["kind"], number> = {
    access: 0,
    owner: 1,
    review: 2,
    field: 3,
    evidence: 4,
    correction: 5,
    dependency: 6,
    other: 7,
  };
  return out.sort((a, b) => weight[a.kind] - weight[b.kind]);
}

/* -------------------------------------------------------------------- risk */

export type RiskLevel = "on_track" | "watch" | "at_risk" | "blocked";

export const RISK_LABEL: Record<RiskLevel, string> = {
  on_track: "On track",
  watch: "Watch",
  at_risk: "At risk",
  blocked: "Blocked",
};

export const RISK_STATE: Record<RiskLevel, WorkState> = {
  on_track: "done",
  watch: "waiting",
  at_risk: "blocked",
  blocked: "blocked",
};

export type Risk = { level: RiskLevel; reasons: string[] };

function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(new Date().toDateString());
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Risk is derived, never picked from a dropdown, and always explained.
 * "At risk — final cleaning unfinished · handoff in 2 days", not "Yellow".
 */
export function deriveRisk(input: ProjectInput): Risk {
  // A home already live with Operations carries no onboarding risk.
  if (deriveStage(input) === "live") return { level: "on_track", reasons: [] };

  const roll = rollupProperty(input.tasks);
  const reasons: string[] = [];
  let level: RiskLevel = "on_track";

  const target = targetHandoff(input);
  const runway = daysUntil(target);

  if (roll.overdue > 0)
    reasons.push(`${roll.overdue} overdue step${roll.overdue === 1 ? "" : "s"}`);
  if (roll.ownerPending > 0)
    reasons.push(
      `${roll.ownerPending} homeowner decision${roll.ownerPending === 1 ? "" : "s"} outstanding`,
    );
  if (roll.missingEvidence > 0)
    reasons.push(
      `${roll.missingEvidence} step${roll.missingEvidence === 1 ? "" : "s"} missing required evidence`,
    );
  if (roll.blocked > 0)
    reasons.push(`${roll.blocked} blocked step${roll.blocked === 1 ? "" : "s"}`);
  if (input.property.lifecycle_status === "handoff_corrections")
    reasons.push("returned from review with corrections");
  if (runway != null && runway <= 7 && roll.total > 0 && roll.done < roll.total)
    reasons.push(
      `handoff in ${runway} day${runway === 1 ? "" : "s"} with ${roll.total - roll.done} step(s) open`,
    );

  if (reasons.length > 0) level = "watch";
  if (
    roll.blocked > 0 ||
    roll.overdue > 1 ||
    input.property.lifecycle_status === "handoff_corrections"
  )
    level = "at_risk";
  if (runway != null && runway <= 2 && roll.done < roll.total) level = "at_risk";

  const blockers = deriveBlockers(input);
  const stopped =
    blockers.length > 0 &&
    input.tasks.every(
      (t) =>
        t.status === "complete" ||
        t.status === "carryover" ||
        blockers.some((b) => b.taskId === t.id),
    );
  if (stopped && input.tasks.length > 0) {
    level = "blocked";
    if (blockers[0]) reasons.unshift(blockers[0].what);
  }

  return { level, reasons };
}

/** The latest blocking due date is the honest target handoff date. */
export function targetHandoff(input: ProjectInput): string | null {
  const dates = input.tasks
    .filter((t) => t.blocks_handoff && t.status !== "complete" && t.due_on)
    .map((t) => t.due_on!)
    .sort();
  return dates.at(-1) ?? null;
}

/* ------------------------------------------------- conditional activation */

/**
 * Branches Resolve knows do not apply to this home are not unfinished work.
 * A branch is inapplicable when the project carries no live task for it — the
 * template application decided that already; the UI must not render N/A rows.
 */
export const BRANCHES = [
  {
    key: "furnishing",
    label: "Furnishing & purchasing",
    match: /furnish|purchas|deliver|assembl|stag|decor/i,
  },
  { key: "repairs", label: "Repairs", match: /repair|estimate|punch/i },
  { key: "cleaning", label: "Cleaning", match: /clean/i },
  { key: "photography", label: "Photography", match: /photo/i },
  { key: "access_devices", label: "Access & devices", match: /lock|device|garage|access|keypad/i },
  { key: "landscaping", label: "Landscaping & pest", match: /landscap|lawn|pest|trash/i },
  { key: "permits", label: "Permits", match: /permit|licen/i },
  {
    key: "utilities",
    label: "Utilities & internet",
    match: /utilit|internet|wifi|wi-fi|power|water/i,
  },
] as const;

export type BranchKey = (typeof BRANCHES)[number]["key"];

export function activeBranches(
  tasks: WorkflowTask[],
): { key: BranchKey; label: string; done: number; total: number }[] {
  return BRANCHES.map((b) => {
    const inBranch = tasks.filter((t) => b.match.test(t.title));
    return {
      key: b.key,
      label: b.label,
      done: inBranch.filter((t) => t.status === "complete" || t.status === "carryover").length,
      total: inBranch.length,
    };
  }).filter((b) => b.total > 0);
}

/* ------------------------------------------------------------ review gates */

/** Future gates are visible as milestones but never actionable early. */
export function gateProgress(handoff: OpenHandoff, accepted: boolean) {
  const current = accepted ? "complete" : (handoff?.gate_step ?? null);
  const index = current ? GATE_STEPS.findIndex((s) => s.value === current) : -1;
  return GATE_STEPS.map((s, i) => ({
    value: s.value,
    label: s.label,
    blurb: s.blurb,
    state:
      index < 0
        ? ("upcoming" as const)
        : i < index
          ? ("done" as const)
          : i === index
            ? ("current" as const)
            : ("upcoming" as const),
  }));
}

/* --------------------------------------------------------------- portfolio */

export type ProjectSummary = {
  property: ProjectProperty;
  stage: LifecycleStage;
  next: NextAction;
  risk: Risk;
  blockers: Blocker[];
  target: string | null;
  progress: number;
  done: number;
  total: number;
  hasProject: boolean;
  inReview: boolean;
  owner: string | null;
};

export function summarizeProject(input: ProjectInput, ownerName: string | null): ProjectSummary {
  const roll = rollupProperty(input.tasks);
  return {
    property: input.property,
    stage: deriveStage(input),
    next: deriveNextAction(input),
    risk: deriveRisk(input),
    blockers: deriveBlockers(input),
    target: targetHandoff(input),
    progress: roll.progress,
    done: roll.done,
    total: roll.total,
    hasProject: input.tasks.length > 0,
    inReview: Boolean(input.handoff),
    owner: ownerName,
  };
}

/** Forward-looking capacity windows for the Director Hub. */
export function withinDays(date: string | null, days: number) {
  const d = daysUntil(date);
  return d != null && d >= 0 && d <= days;
}

export function bottleneckStage(projects: ProjectSummary[]): LifecycleStage | null {
  const counts = new Map<LifecycleStage, number>();
  for (const p of projects) counts.set(p.stage, (counts.get(p.stage) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export function workloadByOwner(projects: ProjectSummary[]) {
  const map = new Map<
    string,
    { owner: string; projects: number; atRisk: number; blockers: number }
  >();
  for (const p of projects) {
    const key = p.owner ?? "Unassigned";
    const row = map.get(key) ?? { owner: key, projects: 0, atRisk: 0, blockers: 0 };
    row.projects += 1;
    if (p.risk.level === "at_risk" || p.risk.level === "blocked") row.atRisk += 1;
    row.blockers += p.blockers.length;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.projects - a.projects);
}
