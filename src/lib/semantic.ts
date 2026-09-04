/**
 * Resolve's semantic colour language.
 *
 * Three controlled axes, each with one meaning:
 *  - ownership  — which team or seat owns the work
 *  - state      — where the work sits in its process
 *  - module     — which part of Resolve you are looking at
 *
 * Colour never carries meaning alone. Every helper here is paired with a word
 * at the call site, so the interface still reads correctly in greyscale and to
 * anyone who does not perceive the hue difference.
 *
 * Pure presentation: nothing here reads data, decides permissions or changes
 * routing.
 */

export type Ownership = "team_a" | "team_b" | "leadership" | "vendor" | "owner" | "unassigned";

/** Workflow states shared across tickets, onboarding, approvals and coverage. */
export type WorkState = "new" | "active" | "waiting" | "blocked" | "done" | "info";

export type ModuleKey =
  "operations" | "onboarding" | "owner" | "approval" | "coverage" | "override";

const OWNERSHIP_CHIP: Record<Ownership, string> = {
  team_a: "bg-team-a/10 text-team-a",
  team_b: "bg-team-b/10 text-team-b",
  leadership: "bg-leadership/10 text-leadership",
  vendor: "bg-module-override/12 text-module-override",
  owner: "bg-module-owner/12 text-module-owner",
  unassigned: "bg-cool-grey/12 text-cool-grey",
};

const STATE_CHIP: Record<WorkState, string> = {
  new: "bg-sky/10 text-sky",
  active: "bg-state-active/12 text-state-active",
  waiting: "bg-state-waiting/14 text-state-waiting",
  blocked: "bg-state-blocked/12 text-state-blocked",
  done: "bg-state-done/12 text-state-done",
  info: "bg-state-info/12 text-state-info",
};

const MODULE_CHIP: Record<ModuleKey, string> = {
  operations: "bg-module-ops/10 text-module-ops",
  onboarding: "bg-module-onboarding/12 text-module-onboarding",
  owner: "bg-module-owner/12 text-module-owner",
  approval: "bg-module-approval/12 text-module-approval",
  coverage: "bg-module-coverage/12 text-module-coverage",
  override: "bg-module-override/14 text-module-override",
};

export function ownershipChip(kind: Ownership) {
  return OWNERSHIP_CHIP[kind];
}

export function stateChip(state: WorkState) {
  return STATE_CHIP[state];
}

export function moduleChip(key: ModuleKey) {
  return MODULE_CHIP[key];
}

/** Solid module accent, for rails and left borders. */
export function moduleBar(key: ModuleKey) {
  return {
    operations: "bg-module-ops",
    onboarding: "bg-module-onboarding",
    owner: "bg-module-owner",
    approval: "bg-module-approval",
    coverage: "bg-module-coverage",
    override: "bg-module-override",
  }[key];
}

/** Team code from the coverage model → ownership colour. */
export function ownershipForTeam(team: string | null | undefined): Ownership {
  if (team === "guest_experience") return "team_a";
  if (team === "property_operations") return "team_b";
  if (team === "leadership") return "leadership";
  return "unassigned";
}

export const TEAM_SHORT: Record<string, string> = {
  guest_experience: "Team A",
  property_operations: "Team B",
  leadership: "Leadership",
};

/* -------------------------------------------------------------------------
 * Ticket lifecycle
 *
 * The visible lifecycle uses only statuses the ticket architecture already
 * supports. `dispatched` and `in_progress` are both "In progress" work;
 * `waiting` and `awaiting_guest` are both "Waiting". Nothing new is invented
 * and nothing is written back.
 * ---------------------------------------------------------------------- */

export type LifecycleStep = {
  key: string;
  label: string;
  /** Ticket statuses that put a ticket at this step. */
  statuses: string[];
};

export const TICKET_LIFECYCLE: LifecycleStep[] = [
  { key: "new", label: "New", statuses: ["open"] },
  { key: "progress", label: "In progress", statuses: ["dispatched", "in_progress"] },
  { key: "waiting", label: "Waiting", statuses: ["waiting", "awaiting_guest"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
];

export function lifecycleIndex(status: string | null | undefined): number {
  const i = TICKET_LIFECYCLE.findIndex((s) => s.statuses.includes(String(status)));
  return i === -1 ? 0 : i;
}

/** Which state colour a ticket status carries. */
export function ticketState(status: string | null | undefined): WorkState {
  switch (status) {
    case "open":
      return "new";
    case "dispatched":
    case "in_progress":
      return "active";
    case "waiting":
    case "awaiting_guest":
      return "waiting";
    case "resolved":
    case "closed":
      return "done";
    default:
      return "info";
  }
}

/** Onboarding task status → shared workflow state. */
export function taskState(status: string | null | undefined): WorkState {
  switch (status) {
    case "complete":
      return "done";
    case "blocked":
      return "blocked";
    case "carryover":
      return "waiting";
    default:
      return "active";
  }
}
