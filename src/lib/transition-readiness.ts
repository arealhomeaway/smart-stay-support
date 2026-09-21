/**
 * Transition readiness — one shared, pure definition of the gates a record
 * must clear to move from one part of Resolve to the next, and of who is
 * holding it up right now.
 *
 * Two transitions are covered:
 *   - a home moving from its Onboarding Project into live Operations
 *   - a homeowner moving from enrollment into the Active Owner program
 *
 * Nothing here reads or writes: the gates are derived from plain values so a
 * queue, a project workspace and a test all answer identically.
 */

export type TransitionKind = "home_to_operations" | "owner_to_active";

export const TRANSITION_LABEL: Record<TransitionKind, string> = {
  home_to_operations: "Home → Operations",
  owner_to_active: "Owner → Active Owner",
};

/** Who the next move belongs to. Never a person, always a responsibility. */
export type Holder =
  | "project_manager"
  | "director_onboarding"
  | "director_operations"
  | "operations"
  | "supervisor"
  | "homeowner"
  | "onboarding_staff";

export const HOLDER_LABEL: Record<Holder, string> = {
  project_manager: "Project manager",
  director_onboarding: "Director of Onboarding",
  director_operations: "Director of Operations",
  operations: "Operations",
  supervisor: "Operations Supervisor",
  homeowner: "Homeowner",
  onboarding_staff: "Onboarding staff",
};

export const HOLDERS = Object.keys(HOLDER_LABEL) as Holder[];

export type Gate = {
  key: string;
  label: string;
  passed: boolean;
  /** One plain sentence: what is true, or what is missing. */
  detail: string;
  holder: Holder;
};

export type TransitionItem = {
  id: string;
  kind: TransitionKind;
  /** Where the record lives, for the link back. */
  propertyId: string | null;
  programId: string | null;
  title: string;
  subtitle: string;
  /** Plain reading of where this sits right now. */
  stage: string;
  gates: Gate[];
  openGates: Gate[];
  ready: boolean;
  /** Who the next move belongs to, or null once everything has cleared. */
  holder: Holder | null;
  isTest: boolean;
};

/* ------------------------------------------------- home → operations */

export type HomeTransitionInput = {
  propertyId: string;
  name: string;
  lifecycleStatus: string | null;
  accessConfirmed: boolean;
  /** Applicable onboarding steps that are not complete or carried over. */
  openTasks: number;
  /** Steps that were reopened and are not finished again. */
  corrections: number;
  /** Steps still waiting on a recorded homeowner decision. */
  openApprovals: number;
  projectStarted: boolean;
  handoff: {
    gateStep: string | null;
    katiDecision: string | null;
    micahDecision: string | null;
    acceptedAt: string | null;
    liveConfirmedAt: string | null;
  } | null;
  isTest: boolean;
};

const GATE_ORDER = [
  "kati_review",
  "micah_review",
  "operations_acceptance",
  "live_confirmation",
  "complete",
];

function reachedGate(current: string | null, gate: string) {
  const a = GATE_ORDER.indexOf(current ?? "kati_review");
  const b = GATE_ORDER.indexOf(gate);
  return a > b;
}

export function homeGates(input: HomeTransitionInput): Gate[] {
  const h = input.handoff;
  const accepted = Boolean(h?.acceptedAt) || input.lifecycleStatus === "active_operations";
  const live = Boolean(h?.liveConfirmedAt) || input.lifecycleStatus === "active_operations";
  return [
    {
      key: "project_started",
      label: "Onboarding started",
      passed: input.projectStarted,
      detail: input.projectStarted
        ? "An Onboarding Project is open for this home."
        : "No Onboarding Project has been started for this home.",
      holder: "onboarding_staff",
    },
    {
      key: "access",
      label: "Access confirmed",
      passed: input.accessConfirmed,
      detail: input.accessConfirmed
        ? "Access to the home is confirmed."
        : "Access is not confirmed, so onsite work is not released.",
      holder: "project_manager",
    },
    {
      key: "work_complete",
      label: "Onboarding work finished",
      passed: input.openTasks === 0,
      detail:
        input.openTasks === 0
          ? "Every applicable step is finished."
          : `${input.openTasks} applicable step(s) are still open.`,
      holder: "project_manager",
    },
    {
      key: "corrections",
      label: "Corrections closed",
      passed: input.corrections === 0,
      detail:
        input.corrections === 0
          ? "No reopened steps are outstanding."
          : `${input.corrections} reopened step(s) are not finished.`,
      holder: "project_manager",
    },
    {
      key: "owner_approvals",
      label: "Homeowner decisions recorded",
      passed: input.openApprovals === 0,
      detail:
        input.openApprovals === 0
          ? "Every step needing a homeowner decision has one."
          : `${input.openApprovals} step(s) are waiting on the homeowner.`,
      holder: "homeowner",
    },
    {
      key: "readiness_submitted",
      label: "Readiness record submitted",
      passed: Boolean(h) || accepted,
      detail: h || accepted
        ? "The project manager submitted the readiness record."
        : "The project manager has not submitted the readiness record yet.",
      holder: "project_manager",
    },
    {
      key: "kati_review",
      label: "Director of Onboarding review",
      passed: accepted || h?.katiDecision === "accepted" || reachedGate(h?.gateStep ?? null, "kati_review"),
      detail:
        h?.katiDecision === "returned"
          ? "Returned with corrections by the Director of Onboarding."
          : "Waiting on the Director of Onboarding to verify the readiness record.",
      holder: "director_onboarding",
    },
    {
      key: "micah_review",
      label: "Director of Operations review",
      passed: accepted || h?.micahDecision === "accepted" || reachedGate(h?.gateStep ?? null, "micah_review"),
      detail:
        h?.micahDecision === "returned"
          ? "Returned with corrections by the Director of Operations."
          : "Waiting on the Director of Operations to review exceptions and carryover.",
      holder: "director_operations",
    },
    {
      key: "operations_acceptance",
      label: "Operations accepts the home",
      passed: accepted,
      detail: accepted
        ? "Operations owns this home."
        : "Operations has not taken ownership of the home yet.",
      holder: "operations",
    },
    {
      key: "live_confirmation",
      label: "Supervisor confirms Live",
      passed: live,
      detail: live
        ? "The home is confirmed Live."
        : "The Operations Supervisor has not confirmed the home Live.",
      holder: "supervisor",
    },
  ];
}

/* --------------------------------------------- owner → Active Owner */

export type OwnerTransitionInput = {
  programId: string;
  ownerName: string | null;
  ownerEmail: string | null;
  status: string;
  startedOn: string | null;
  dfyConfirmed: boolean;
  properties: {
    propertyId: string;
    name: string;
    inclusionStatus: string;
    closingConfirmed: boolean;
  }[];
  isTest: boolean;
};

export function ownerGates(input: OwnerTransitionInput): Gate[] {
  const included = input.properties.filter((p) => p.inclusionStatus === "included");
  const unconfirmed = included.filter((p) => !p.closingConfirmed);
  const active = input.status === "active" || input.status === "complete";
  return [
    {
      key: "owner_contact",
      label: "Homeowner contact on file",
      passed: Boolean(input.ownerEmail?.trim()),
      detail: input.ownerEmail?.trim()
        ? "The homeowner has an email address on file."
        : "No email address is on file, so nothing can be sent to the homeowner.",
      holder: "onboarding_staff",
    },
    {
      key: "properties_included",
      label: "Homes chosen for the program",
      passed: included.length > 0,
      detail: included.length
        ? `${included.length} home(s) are included.`
        : "No home has been included in this program yet.",
      holder: "onboarding_staff",
    },
    {
      key: "closings_confirmed",
      label: "Closings confirmed",
      passed: included.length > 0 && unconfirmed.length === 0,
      detail: unconfirmed.length
        ? `${unconfirmed.length} included home(s) have no confirmed closing.`
        : "Every included home has a confirmed closing.",
      holder: "homeowner",
    },
    {
      key: "dfy_confirmed",
      label: "Program terms confirmed",
      passed: input.dfyConfirmed,
      detail: input.dfyConfirmed
        ? "The homeowner confirmed the program terms."
        : "The homeowner has not confirmed the program terms.",
      holder: "homeowner",
    },
    {
      key: "start_date",
      label: "Start date set",
      passed: Boolean(input.startedOn),
      detail: input.startedOn
        ? `Starts ${input.startedOn}.`
        : "No start date has been set for the program.",
      holder: "onboarding_staff",
    },
    {
      key: "activated",
      label: "Program activated",
      passed: active,
      detail: active
        ? "The program is running."
        : "The program has not been activated yet.",
      holder: "operations",
    },
  ];
}

/* ------------------------------------------------------------- queue */

function assemble(
  id: string,
  kind: TransitionKind,
  base: {
    propertyId: string | null;
    programId: string | null;
    title: string;
    subtitle: string;
    stage: string;
    isTest: boolean;
  },
  gates: Gate[],
): TransitionItem {
  const openGates = gates.filter((g) => !g.passed);
  return {
    id,
    kind,
    ...base,
    gates,
    openGates,
    ready: openGates.length === 0,
    holder: openGates[0]?.holder ?? null,
  };
}

export function homeItem(input: HomeTransitionInput): TransitionItem {
  const gates = homeGates(input);
  const open = gates.filter((g) => !g.passed);
  return assemble("home:" + input.propertyId, "home_to_operations", {
    propertyId: input.propertyId,
    programId: null,
    title: input.name,
    subtitle: "Onboarding handoff",
    stage: open[0]?.label ?? "Live",
    isTest: input.isTest,
  }, gates);
}

export function ownerItem(input: OwnerTransitionInput): TransitionItem {
  const gates = ownerGates(input);
  const open = gates.filter((g) => !g.passed);
  return assemble("owner:" + input.programId, "owner_to_active", {
    propertyId: input.properties[0]?.propertyId ?? null,
    programId: input.programId,
    title: input.ownerName?.trim() || "Homeowner",
    subtitle:
      input.properties.length === 1
        ? (input.properties[0]?.name ?? "One home")
        : `${input.properties.length} homes`,
    stage: open[0]?.label ?? "Running",
    isTest: input.isTest,
  }, gates);
}

export type QueueFilters = {
  kind?: TransitionKind | "all";
  holder?: Holder | "all";
  state?: "all" | "ready" | "blocked";
  find?: string;
};

export function filterQueue(items: TransitionItem[], f: QueueFilters): TransitionItem[] {
  const find = f.find?.trim().toLowerCase() ?? "";
  return items.filter((i) => {
    if (f.kind && f.kind !== "all" && i.kind !== f.kind) return false;
    if (f.holder && f.holder !== "all" && i.holder !== f.holder) return false;
    if (f.state === "ready" && !i.ready) return false;
    if (f.state === "blocked" && i.ready) return false;
    if (find && !`${i.title} ${i.subtitle}`.toLowerCase().includes(find)) return false;
    return true;
  });
}

/** Most stuck first, then by how much is left, so the queue reads top-down. */
export function sortQueue(items: TransitionItem[]): TransitionItem[] {
  return [...items].sort(
    (a, b) => b.openGates.length - a.openGates.length || a.title.localeCompare(b.title),
  );
}

export function countByHolder(items: TransitionItem[]): { holder: Holder; count: number }[] {
  return HOLDERS.map((holder) => ({
    holder,
    count: items.filter((i) => i.holder === holder).length,
  })).filter((r) => r.count > 0);
}
