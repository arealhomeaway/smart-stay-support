/** Property lifecycle + onboarding model (browser-safe). */

export type LifecycleStatus =
  | "not_onboarded"
  | "onboarding"
  | "handoff_requested"
  | "handoff_corrections"
  | "active_operations"
  | "paused"
  | "offboarded";

export const LIFECYCLE: { value: LifecycleStatus; label: string; tone: string; blurb: string }[] = [
  {
    value: "not_onboarded",
    label: "Onboarding not started",
    tone: "bg-muted text-muted-foreground border-border",
    blurb: "The home exists in Resolve. No Onboarding Project has been started yet.",
  },
  {
    value: "onboarding",
    label: "Onboarding",
    tone: "bg-primary/10 text-primary border-primary/20",
    blurb: "Pre-handoff work. Not yet an operational home.",
  },
  {
    value: "handoff_requested",
    label: "Handoff requested",
    tone: "bg-amber-100 text-amber-900 border-amber-200",
    blurb: "Waiting on an Operations Supervisor review.",
  },
  {
    value: "handoff_corrections",
    label: "Corrections required",
    tone: "bg-destructive/10 text-destructive border-destructive/20",
    blurb: "Returned to onboarding with required corrections.",
  },
  {
    value: "active_operations",
    label: "Active operations",
    tone: "bg-emerald-100 text-emerald-900 border-emerald-200",
    blurb: "Accepted by operations. Full homeowner portal is live.",
  },
  {
    value: "paused",
    label: "Paused",
    tone: "bg-muted text-muted-foreground border-border",
    blurb: "Temporarily out of service.",
  },
  {
    value: "offboarded",
    label: "Offboarded",
    tone: "bg-muted text-muted-foreground border-border",
    blurb: "No longer managed. History retained.",
  },
];

export function lifecycleMeta(value: string | null | undefined) {
  // Unknown or missing lifecycle never reads as an accepted, live home.
  return LIFECYCLE.find((l) => l.value === value) ?? LIFECYCLE[0]!;
}

/**
 * The real ARHA onboarding phases.
 * Legacy stage values from the earlier sample template still resolve a label
 * so existing records keep reading correctly.
 */
export const ONBOARDING_STAGES = [
  { value: "post_contract", label: "Post contract — pre-inspection" },
  { value: "phase1_inspection", label: "Phase 1 — Inspection / repair estimates" },
  { value: "phase2_estimates", label: "Phase 2 — Estimates & installation purchases" },
  { value: "phase3_work_orders", label: "Phase 3 — Plan / schedule work orders" },
  { value: "phase4_purchasing", label: "Phase 4 — Purchasing / finalize work orders" },
  { value: "phase5_monitor", label: "Phase 5 — Monitor repairs / setup / staging" },
  { value: "phase6_handoff", label: "Phase 6 — Cost analysis / photos / handoff" },
] as const;

export type OnboardingStage = (typeof ONBOARDING_STAGES)[number]["value"];

const LEGACY_STAGE_LABELS: Record<string, string> = {
  intake: "Intake & agreement",
  records: "Records & systems",
  readiness: "Property readiness",
  listing: "Listing & launch prep",
  verification: "Inspection & verification",
};

export function stageLabel(value: string | null | undefined) {
  return (
    ONBOARDING_STAGES.find((s) => s.value === value)?.label ??
    LEGACY_STAGE_LABELS[value ?? ""] ??
    ONBOARDING_STAGES[0].label
  );
}

export const TASK_STATUSES = ["open", "blocked", "complete", "carryover"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type HandoffCheck = {
  key: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
};

export type OnboardingTask = {
  id: string;
  property_id: string;
  stage: string;
  title: string;
  detail: string | null;
  assigned_to: string | null;
  due_on: string | null;
  blocker: string | null;
  requires_owner_approval: boolean;
  owner_approval_status: string;
  evidence_required: boolean;
  evidence_note: string | null;
  status: string;
  blocks_handoff: boolean;
  carryover_reason: string | null;
  completed_at: string | null;
  created_at: string;
};

export function isOverdue(task: Pick<OnboardingTask, "due_on" | "status">) {
  if (!task.due_on || task.status === "complete") return false;
  return new Date(task.due_on) < new Date(new Date().toDateString());
}

/** Deterministic readiness gate. Every rule reads real records only. */
export function validateHandoff(
  property: {
    address_line1: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    latitude: number | null;
    longitude: number | null;
    access_notes: string | null;
    quarterly_review_due_on: string | null;
  },
  tasks: {
    id: string;
    status: string;
    blocks_handoff: boolean;
    requires_owner_approval: boolean;
    owner_approval_status: string;
    evidence_required: boolean;
    evidence_note: string | null;
    blocker: string | null;
  }[],
  /**
   * Quarterly reviews sit behind a launch-state flag. While it is OFF the
   * readiness checklist must not show a review warning; the stored review
   * dates and the paused scheduler are untouched.
   */
  opts: { includeQuarterlyReview?: boolean } = {},
): { checks: HandoffCheck[]; openBlocking: string[]; ready: boolean } {
  const includeQuarterlyReview = opts.includeQuarterlyReview !== false;
  const open = tasks.filter((t) => t.status !== "complete" && t.status !== "carryover");
  const openBlocking = open.filter((t) => t.blocks_handoff).map((t) => t.id);
  const missingApproval = tasks.filter(
    (t) => t.requires_owner_approval && t.owner_approval_status !== "approved",
  );
  const missingEvidence = tasks.filter(
    (t) => t.evidence_required && !(t.evidence_note ?? "").trim() && t.status === "complete",
  );
  const blockers = tasks.filter((t) => (t.blocker ?? "").trim() && t.status !== "complete");

  const checks: HandoffCheck[] = [
    {
      key: "address",
      label: "Property address is complete",
      passed: Boolean(
        property.address_line1 && property.city && property.state && property.postal_code,
      ),
      blocking: true,
      detail: "Street, city, state and postal code are required for dispatch and mapping.",
    },
    {
      key: "geocode",
      label: "Property is geocoded",
      passed: property.latitude != null && property.longitude != null,
      blocking: true,
      detail: "Needed for nearest-vendor dispatch, the job map and verified check-ins.",
    },
    {
      key: "access",
      label: "Access instructions recorded",
      passed: Boolean((property.access_notes ?? "").trim()),
      blocking: true,
      detail: "Operations cannot dispatch a vendor to a home with no access path.",
    },
    ...(includeQuarterlyReview
      ? [
          {
            key: "review_due",
            label: "Quarterly review date set",
            passed: Boolean(property.quarterly_review_due_on),
            blocking: false,
            detail: "The first cleaning-supervisor review must be scheduled.",
          } as HandoffCheck,
        ]
      : []),
    {
      key: "tasks",
      label: "Blocking onboarding tasks complete",
      passed: openBlocking.length === 0,
      blocking: true,
      detail: `${openBlocking.length} blocking task(s) still open.`,
    },
    {
      key: "approvals",
      label: "Owner approvals obtained",
      passed: missingApproval.length === 0,
      blocking: true,
      detail: `${missingApproval.length} task(s) awaiting a homeowner decision.`,
    },
    {
      key: "evidence",
      label: "Required evidence captured",
      passed: missingEvidence.length === 0,
      blocking: true,
      detail: `${missingEvidence.length} completed task(s) missing required evidence.`,
    },
    {
      key: "blockers",
      label: "No unresolved blockers",
      passed: blockers.length === 0,
      blocking: true,
      detail: `${blockers.length} task(s) carry an unresolved blocker note.`,
    },
  ];

  return { checks, openBlocking, ready: checks.every((c) => !c.blocking || c.passed) };
}

/* ---------------------------------------------------------------------------
 * Stage 2 — formal handoff gate
 *
 * A property is only "ready for Operations" after two documented reviews and
 * an explicit Operations acceptance, followed by live confirmation. Every step
 * is recorded in handoff_reviews with reviewer, date, decision and exception.
 * ------------------------------------------------------------------------ */

export const GATE_STEPS = [
  {
    value: "kati_review",
    label: "Director of Onboarding review",
    blurb: "The Director of Onboarding verifies the readiness record.",
  },
  {
    value: "micah_review",
    label: "Director of Operations review",
    blurb:
      "The Director of Operations reviews exceptions and assigns every carryover item to Operations with an owner and due date.",
  },
  {
    value: "operations_acceptance",
    label: "Operations acceptance",
    blurb: "An Operations supervisor accepts ownership of the home.",
  },
  {
    value: "live_confirmation",
    label: "Live confirmation",
    blurb: "Operations confirms the home is live.",
  },
  { value: "complete", label: "Complete", blurb: "Handoff finished and archived to history." },
] as const;

export type GateStep = (typeof GATE_STEPS)[number]["value"];

export function gateLabel(value: string | null | undefined) {
  return GATE_STEPS.find((s) => s.value === value)?.label ?? "Director of Onboarding review";
}

export function nextGateStep(step: string | null | undefined): GateStep {
  const order = GATE_STEPS.map((s) => s.value);
  const i = order.indexOf((step ?? "kati_review") as GateStep);
  return (order[Math.min(i + 1, order.length - 1)] ?? "complete") as GateStep;
}

/** A task is dependency-blocked while any prerequisite is not complete. */
export function dependencyBlocked(
  task: { depends_on?: string[] | null },
  all: { id: string; status: string }[],
): string[] {
  const ids = task.depends_on ?? [];
  return ids.filter((id) => {
    const dep = all.find((t) => t.id === id);
    return !dep || (dep.status !== "complete" && dep.status !== "carryover");
  });
}

export function isActiveTask(t: { archived_at?: string | null }) {
  return !t.archived_at;
}
