/**
 * ONE authoritative onboarding state model (browser-safe, pure, read-only).
 *
 * Every onboarding surface — property workspace, task drawer, my work, the
 * Director Hub — must answer three questions the same way:
 *
 *   Where is this project in its lifecycle?   -> deriveLifecycle()
 *   Is this piece of work actually actionable? -> releaseState()
 *   Can this home be handed off yet, and why not? -> handoffReadiness()
 *
 * Nothing here writes. Legacy or stale fields (an old open handoff row on an
 * accepted home, a legacy `onboarding_stage` value, template work injected
 * after acceptance) are reconciled here so no surface can render a
 * contradictory truth of its own.
 */

import { GATE_STEPS, type HandoffCheck } from "./onboarding";
import { ONBOARDING_STAGES } from "./onboarding";
import type { WorkflowTask } from "./onboarding-workflow";

/* -------------------------------------------------------------- lifecycle */

export type OnboardingPhase =
  | "not_started"
  | "pre_close"
  | "access_ready"
  | "setup"
  | "furnishing_repairs"
  | "final_prep"
  | "pm_readiness"
  | "director_onboarding_review"
  | "director_operations_review"
  | "operations_acceptance"
  | "live_confirmation"
  | "live";

/**
 * The handoff chain, exactly as the team says it out loud. `gate` links a
 * display step to the persisted `property_handoffs.gate_step` value; the two
 * steps without one are represented by the request itself and by acceptance.
 */
export const HANDOFF_CHAIN: { key: string; label: string; gate: string | null; blurb: string }[] = [
  {
    key: "pm_readiness",
    label: "PM readiness",
    gate: null,
    blurb: "The project manager confirms every applicable step is finished and submits the record.",
  },
  {
    key: "kati_review",
    label: "Director of Onboarding",
    gate: "kati_review",
    blurb: "The Director of Onboarding verifies the readiness record.",
  },
  {
    key: "micah_review",
    label: "Director of Operations",
    gate: "micah_review",
    blurb: "The Director of Operations reviews exceptions and assigns carryover work.",
  },
  {
    key: "operations_acceptance",
    label: "Operations accepts",
    gate: "operations_acceptance",
    blurb: "Operations takes ownership of the home.",
  },
  {
    key: "live_confirmation",
    label: "Operations Supervisor confirms Live",
    gate: "live_confirmation",
    blurb: "The Operations Supervisor confirms the home is live.",
  },
  {
    key: "complete",
    label: "Handoff complete",
    gate: "complete",
    blurb: "Handoff finished. The onboarding plan is locked to history.",
  },
];

export type LifecycleState = {
  phase: OnboardingPhase;
  label: string;
  /** True once Operations accepted the home. Overrides every other signal. */
  accepted: boolean;
  live: boolean;
  /** Returned from a review gate with corrections required. */
  corrections: boolean;
  /** No Onboarding Project record exists yet. */
  notStarted: boolean;
  /** The onboarding plan is closed to new work. */
  locked: boolean;
  lockedAt: string | null;
  /** Which chain step is current, for the handoff rail. */
  chainKey: string | null;
  /** A handoff row that contradicts acceptance and must be ignored. */
  staleHandoff: boolean;
  /** One sentence a human can read. */
  explain: string;
};

export type StateProperty = {
  id: string;
  name: string;
  lifecycle_status: string | null;
  onboarding_stage?: string | null;
  actual_access_on?: string | null;
  actual_closing_on?: string | null;
  planned_closing_on?: string | null;
  handoff_accepted_at?: string | null;
  access_notes?: string | null;
  is_demo?: boolean | null;
};

/** Routine lifecycle edits cannot replace project start, stage review, or handoff. */
export function lifecycleEditIssue(
  property: Pick<StateProperty, "lifecycle_status" | "onboarding_stage" | "handoff_accepted_at">,
  input: { status: string; stage?: string | null | undefined },
): string | null {
  if (input.stage !== undefined && input.stage !== property.onboarding_stage)
    return "Use stage capture and review to advance or reopen work.";
  if (
    property.handoff_accepted_at ||
    !["onboarding", "paused"].includes(property.lifecycle_status ?? "")
  )
    return "Use Start Onboarding or the handoff review chain for this home's current lifecycle.";
  if (!["onboarding", "paused", "offboarded"].includes(input.status))
    return "Use the handoff review chain to request, return, accept or confirm this home Live.";
  return null;
}

export type StateProject = {
  id: string;
  status: string | null;
  completed_at?: string | null;
} | null;

export type StateHandoff = {
  id: string;
  status: string;
  gate_step: string | null;
  accepted_at?: string | null;
  live_confirmed_at?: string | null;
} | null;

export type StateInput = {
  property: StateProperty;
  project: StateProject;
  /** In-scope, non-archived tasks for this property. */
  tasks: WorkflowTask[];
  handoff: StateHandoff;
  stageCaptures?: { stage: string; revision: number; status: string }[] | undefined;
  excludedTaskIds?: string[] | undefined;
};

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A milestone counts once the date has actually arrived, never before. */
export function milestoneReached(date: string | null | undefined): boolean {
  return Boolean(date) && String(date).slice(0, 10) <= today();
}

export function accessConfirmed(p: StateProperty): boolean {
  return milestoneReached(p.actual_access_on) || milestoneReached(p.actual_closing_on);
}

const PHASE_LABEL: Record<OnboardingPhase, string> = {
  not_started: "Onboarding not started",
  pre_close: "Pre-Close",
  access_ready: "Access Ready",
  setup: "Setup",
  furnishing_repairs: "Furnishing / Repairs",
  final_prep: "Final Prep",
  pm_readiness: "PM readiness",
  director_onboarding_review: "Director of Onboarding review",
  director_operations_review: "Director of Operations review",
  operations_acceptance: "Operations acceptance",
  live_confirmation: "Operations Supervisor confirms Live",
  live: "Live",
};

export function phaseLabel(p: OnboardingPhase) {
  return PHASE_LABEL[p];
}

/** Work phases in canonical order; index drives sequential release. */
export const WORK_PHASES = ONBOARDING_STAGES.map((s) => s.value as string);

function workPhaseIndex(stage: string) {
  const i = WORK_PHASES.indexOf(stage);
  return i < 0 ? WORK_PHASES.length - 1 : i;
}

const PHASE_OF_STAGE: Record<string, OnboardingPhase> = {
  post_contract: "pre_close",
  phase1_inspection: "access_ready",
  phase2_estimates: "setup",
  phase3_work_orders: "setup",
  phase4_purchasing: "furnishing_repairs",
  phase5_monitor: "furnishing_repairs",
  phase6_handoff: "final_prep",
};

/**
 * The single authoritative lifecycle read.
 *
 * Precedence is absolute and defended in tests: acceptance beats an open
 * handoff row, an open handoff beats a corrections flag, and a project that
 * was never started beats every derived work signal.
 */
export function deriveLifecycle(input: StateInput): LifecycleState {
  const { property, project, handoff, tasks } = input;
  const lockedAt = property.handoff_accepted_at ?? project?.completed_at ?? null;

  // A home with no persisted Onboarding Project has no onboarding state at
  // all. This is checked FIRST so a default/unknown lifecycle value can never
  // manufacture "Live / Handoff complete" for a property nobody has started.
  // Homes accepted before Resolve keep their accepted reading: they carry an
  // explicit operational lifecycle and/or an acceptance timestamp.
  const preStartLifecycle =
    !property.lifecycle_status || property.lifecycle_status === "not_onboarded";
  const notStartedNow =
    !project &&
    tasks.length === 0 &&
    !handoff &&
    !property.handoff_accepted_at &&
    preStartLifecycle;
  if (notStartedNow) {
    return {
      phase: "not_started",
      label: PHASE_LABEL.not_started,
      accepted: false,
      live: false,
      corrections: false,
      notStarted: true,
      locked: false,
      lockedAt: null,
      chainKey: null,
      staleHandoff: false,
      explain:
        "This home is in Resolve, but no Onboarding Project has been started, so there is no plan to work.",
    };
  }

  const accepted =
    !preStartLifecycle &&
    (Boolean(property.handoff_accepted_at) || property.lifecycle_status === "active_operations");

  if (accepted) {
    const live =
      property.lifecycle_status === "active_operations" || Boolean(handoff?.live_confirmed_at);
    return {
      phase: live ? "live" : "live_confirmation",
      label: live ? PHASE_LABEL.live : PHASE_LABEL.live_confirmation,
      accepted: true,
      live,
      corrections: false,
      notStarted: false,
      locked: true,
      lockedAt,
      chainKey: live ? "complete" : "live_confirmation",
      staleHandoff: live && Boolean(handoff),
      explain: live
        ? "Operations confirmed this home Live. The onboarding plan is locked to history."
        : "Operations accepted ownership. The Supervisor must still confirm the home Live.",
    };
  }

  const notStarted = !project && tasks.length === 0;
  if (notStarted) {
    return {
      phase: "not_started",
      label: PHASE_LABEL.not_started,
      accepted: false,
      live: false,
      corrections: false,
      notStarted: true,
      locked: false,
      lockedAt: null,
      chainKey: null,
      staleHandoff: false,
      explain:
        "This home is in Resolve, but no Onboarding Project has been started, so there is no plan to work.",
    };
  }

  if (handoff) {
    const step = handoff.gate_step ?? "kati_review";
    const phase: OnboardingPhase =
      step === "kati_review"
        ? "director_onboarding_review"
        : step === "micah_review"
          ? "director_operations_review"
          : step === "operations_acceptance"
            ? "operations_acceptance"
            : "live_confirmation";
    return {
      phase,
      label: PHASE_LABEL[phase],
      accepted: false,
      live: false,
      corrections: false,
      notStarted: false,
      locked: true,
      lockedAt,
      chainKey: step,
      staleHandoff: false,
      explain: `The readiness record is with ${PHASE_LABEL[phase]}. The plan is closed while it is under review.`,
    };
  }

  if (property.lifecycle_status === "handoff_corrections") {
    return {
      phase: "final_prep",
      label: "Corrections required",
      accepted: false,
      live: false,
      corrections: true,
      notStarted: false,
      locked: false,
      lockedAt: null,
      chainKey: "pm_readiness",
      staleHandoff: false,
      explain: "A review gate returned this home with corrections. Fix them, then resubmit.",
    };
  }

  if (!accessConfirmed(property)) {
    return {
      phase: "pre_close",
      label: PHASE_LABEL.pre_close,
      accepted: false,
      live: false,
      corrections: false,
      notStarted: false,
      locked: false,
      lockedAt: null,
      chainKey: null,
      staleHandoff: false,
      explain: property.planned_closing_on
        ? `Access is not confirmed yet. Planned closing ${property.planned_closing_on}.`
        : "Access is not confirmed yet, so no onsite work is released.",
    };
  }

  const open = tasks.filter((t) => t.status !== "complete" && t.status !== "carryover");
  if (tasks.length > 0 && open.length === 0) {
    return {
      phase: "pm_readiness",
      label: PHASE_LABEL.pm_readiness,
      accepted: false,
      live: false,
      corrections: false,
      notStarted: false,
      locked: false,
      lockedAt: null,
      chainKey: "pm_readiness",
      staleHandoff: false,
      explain:
        "Every applicable step is finished. The project manager can submit the readiness record.",
    };
  }

  const earliest = open.map((t) => workPhaseIndex(t.stage)).sort((a, b) => a - b)[0];
  const phase =
    earliest == null ? "access_ready" : (PHASE_OF_STAGE[WORK_PHASES[earliest]!] ?? "setup");
  return {
    phase,
    label: PHASE_LABEL[phase],
    accepted: false,
    live: false,
    corrections: false,
    notStarted: false,
    locked: false,
    lockedAt: null,
    chainKey: null,
    staleHandoff: false,
    explain: `Work is open in ${PHASE_LABEL[phase]}.`,
  };
}

/* ---------------------------------------------------------- task release */

export type ReleaseState =
  | "future"
  | "waiting"
  | "ready"
  | "in_progress"
  | "awaiting_review"
  | "correction_required"
  | "complete"
  | "not_applicable";

export const RELEASE_LABEL: Record<ReleaseState, string> = {
  future: "Future",
  waiting: "Waiting",
  ready: "Ready",
  in_progress: "In Progress",
  awaiting_review: "Awaiting Review",
  correction_required: "Correction Required",
  complete: "Complete",
  not_applicable: "Not Applicable",
};

export type ReleaseContext = {
  excludedTaskIds?: string[] | undefined;
  /** Stage keys whose work is released for action. */
  released: Set<string>;
  /** Why each unreleased stage is not released yet. */
  reasons: Map<string, string>;
  accessOn: string | null;
  closingOn: string | null;
  accessReached: boolean;
  closingReached: boolean;
  /** Plan lock instant; work created after it is not part of the plan. */
  lockedAt: string | null;
  locked: boolean;
};

/**
 * Sequential release: a phase opens when access exists and every applicable
 * step in the phases before it is finished. "Ready" therefore always means
 * "someone can genuinely do this today".
 */
export function buildReleaseContext(input: StateInput): ReleaseContext {
  const { property, tasks } = input;
  const life = deriveLifecycle(input);
  const accessReached = accessConfirmed(property);
  const closingReached = milestoneReached(property.actual_closing_on);

  const released = new Set<string>();
  const reasons = new Map<string, string>();

  const planTasks = tasks.filter((t) => !isPostLock(t, life.lockedAt));
  let priorOpen: string | null = null;

  WORK_PHASES.forEach((stage, i) => {
    const label = ONBOARDING_STAGES[i]?.label ?? stage;
    if (life.locked) {
      reasons.set(stage, "The onboarding plan is locked — this home is with Operations.");
      return;
    }
    if (i > 0 && !accessReached) {
      reasons.set(stage, "Access to the home is not confirmed yet.");
      return;
    }
    if (priorOpen) {
      reasons.set(stage, `Releases when ${priorOpen} is complete.`);
      return;
    }
    released.add(stage);
    const openHere = planTasks.filter(
      (t) => t.stage === stage && t.status !== "complete" && t.status !== "carryover",
    );
    if (openHere.length > 0) priorOpen = label;
    else if (input.stageCaptures !== undefined && planTasks.some((t) => t.stage === stage)) {
      const capture = input.stageCaptures
        .filter((c) => c.stage === stage)
        .sort((a, b) => b.revision - a.revision)[0];
      if (capture?.status !== "complete") priorOpen = `${label} review`;
    }
  });

  return {
    released,
    reasons,
    accessOn: property.actual_access_on ?? null,
    closingOn: property.actual_closing_on ?? property.planned_closing_on ?? null,
    accessReached,
    closingReached,
    lockedAt: life.lockedAt,
    locked: life.locked,
    excludedTaskIds: input.excludedTaskIds,
  };
}

/** Work recorded after the plan was locked is not part of that plan. */
export function isPostLock(
  task: { created_at?: string | null; status: string },
  lockedAt: string | null,
): boolean {
  if (!lockedAt || !task.created_at) return false;
  return task.created_at > lockedAt && task.status !== "complete" && task.status !== "carryover";
}

export type ReleaseVerdict = {
  state: ReleaseState;
  /** Plain-language reason, always present for anything not Ready. */
  reason: string | null;
  /** Whether "Mark complete" may be offered at all. */
  canComplete: boolean;
};

export function releaseState(
  task: WorkflowTask,
  all: WorkflowTask[],
  ctx: ReleaseContext,
): ReleaseVerdict {
  if (task.status === "complete" || task.status === "carryover")
    return { state: "complete", reason: null, canComplete: false };

  if (isPostLock(task, ctx.lockedAt))
    return {
      state: "future",
      reason:
        "Recorded after this home was accepted by Operations. Handle it as a correction or an Operations ticket.",
      canComplete: false,
    };

  if (!ctx.released.has(task.stage))
    return {
      state: "future",
      reason: ctx.reasons.get(task.stage) ?? "This phase has not been released yet.",
      canComplete: false,
    };

  // Milestone-anchored work waits for the milestone itself.
  if (task.schedule_anchor === "actual_closing") {
    if (!ctx.closingReached)
      return {
        state: "future",
        reason: `Released after closing${ctx.closingOn ? ` (${ctx.closingOn})` : ""}.`,
        canComplete: false,
      };
  }
  if (task.schedule_anchor === "actual_access" && !ctx.accessReached)
    return {
      state: "future",
      reason: `Released after possession${ctx.accessOn ? ` (${ctx.accessOn})` : ""}.`,
      canComplete: false,
    };

  const waitingOn = (task.depends_on ?? [])
    .filter((id) => !ctx.excludedTaskIds?.includes(id))
    .map((id) => all.find((t) => t.id === id))
    .filter((t) => !t || (t.status !== "complete" && t.status !== "carryover"))
    .map((t) => t?.title ?? "a prerequisite that is not available");
  if (waitingOn.length > 0)
    return { state: "waiting", reason: `Waiting on ${waitingOn.join(", ")}.`, canComplete: false };

  if (task.owner_approval_status === "changes_requested")
    return {
      state: "correction_required",
      reason: "The homeowner asked for changes before this can be completed.",
      canComplete: false,
    };

  if (task.requires_owner_approval && task.owner_approval_status === "awaiting_owner")
    return {
      state: "awaiting_review",
      reason: "Sent to the homeowner — waiting on their recorded decision.",
      canComplete: false,
    };

  if (task.requires_owner_approval && task.owner_approval_status !== "approved")
    return {
      state: "waiting",
      reason: "A homeowner decision is required before this step can be completed.",
      canComplete: false,
    };

  if ((task.blocker ?? "").trim())
    return { state: "waiting", reason: `Blocked — ${task.blocker!.trim()}`, canComplete: false };

  const evidenceMissing = task.evidence_required && !(task.evidence_note ?? "").trim();
  if (evidenceMissing)
    return {
      state: "in_progress",
      reason: "Required evidence is not recorded yet.",
      canComplete: false,
    };

  const reopened = Boolean(task.completed_at) && task.status !== "complete";
  if (reopened)
    return {
      state: "correction_required",
      reason: "Reopened after completion — a correction is required.",
      canComplete: true,
    };

  if ((task.evidence_note ?? "").trim() || task.exception_reason)
    return { state: "in_progress", reason: null, canComplete: true };

  return { state: "ready", reason: null, canComplete: true };
}

/* ------------------------------------------------------ handoff readiness */

export type ReadinessReason = { key: string; label: string; detail: string };

export type Readiness = {
  ready: boolean;
  /** Everything standing between this home and PM readiness. */
  reasons: ReadinessReason[];
  /** Reasons carryover cannot excuse. While any exists, handoff cannot be requested. */
  hardReasons: ReadinessReason[];
  /** True when handoff may not be requested at all, whatever the client shows. */
  blocked: boolean;
  checks: HandoffCheck[];
};

/**
 * Open plan work can move to Operations as accepted carryover. Everything
 * else is a hard stop: it means the record itself is not trustworthy yet.
 */
const CARRYOVER_EXCUSABLE = new Set(["open_work"]);

export type ReadinessExtras = {
  /** Permanent-fact proposals still waiting on a review decision. */
  pendingFacts?: number;
  /** Financial requests that block launch (awaiting approval or unsettled). */
  openFinancials?: number;
  /** Field work still open in Breezeway or on the property. */
  openFieldWork?: number;
};

/**
 * The handoff CTA is only enabled when every applicable condition passes, and
 * a blocked handoff always says exactly why.
 */
export function handoffReadiness(
  input: StateInput,
  baseChecks: HandoffCheck[],
  extras: ReadinessExtras = {},
): Readiness {
  const ctx = buildReleaseContext(input);
  const life = deriveLifecycle(input);
  const reasons: ReadinessReason[] = [];

  for (const c of baseChecks) {
    if (c.blocking && !c.passed) reasons.push({ key: c.key, label: c.label, detail: c.detail });
  }

  const plan = input.tasks.filter((t) => !isPostLock(t, ctx.lockedAt));
  if (input.stageCaptures !== undefined && !life.accepted) {
    const unreviewed = [...new Set(plan.map((t) => t.stage))].filter(
      (stage) =>
        input
          .stageCaptures!.filter((c) => c.stage === stage)
          .sort((a, b) => b.revision - a.revision)[0]?.status !== "complete",
    );
    if (unreviewed.length)
      reasons.push({
        key: "stage_reviews",
        label: "Stage reviews outstanding",
        detail: `${unreviewed.length} applicable stage(s) need an approved capture.`,
      });
  }
  const open = plan.filter((t) => t.status !== "complete" && t.status !== "carryover");
  if (open.length > 0)
    reasons.push({
      key: "open_work",
      label: "Applicable onboarding work is still open",
      detail: `${open.length} applicable step(s) are not complete.`,
    });

  const corrections = plan.filter(
    (t) => Boolean(t.completed_at) && t.status !== "complete" && t.status !== "carryover",
  );
  if (corrections.length > 0)
    reasons.push({
      key: "corrections",
      label: "Unresolved corrections",
      detail: `${corrections.length} step(s) were reopened and are not finished.`,
    });

  const approvals = plan.filter(
    (t) => t.requires_owner_approval && t.owner_approval_status !== "approved",
  );
  if (approvals.length > 0)
    reasons.push({
      key: "owner_approvals",
      label: "Owner approvals outstanding",
      detail: `${approvals.length} step(s) still need a recorded homeowner decision.`,
    });

  if (extras.pendingFacts)
    reasons.push({
      key: "facts",
      label: "Permanent property facts need review",
      detail: `${extras.pendingFacts} proposed fact change(s) are waiting on a decision.`,
    });

  if (extras.openFinancials)
    reasons.push({
      key: "financial",
      label: "Launch-blocking financial items are open",
      detail: `${extras.openFinancials} financial request(s) are not approved or settled.`,
    });

  if (extras.openFieldWork)
    reasons.push({
      key: "field",
      label: "Field work is still open",
      detail: `${extras.openFieldWork} field job(s) have not been completed.`,
    });

  if (life.notStarted)
    reasons.push({
      key: "not_started",
      label: "Onboarding has not been started",
      detail: "Start an Onboarding Project before requesting handoff.",
    });

  const hardReasons = reasons.filter((r) => !CARRYOVER_EXCUSABLE.has(r.key));
  return {
    ready: reasons.length === 0,
    reasons,
    hardReasons,
    blocked: hardReasons.length > 0,
    checks: baseChecks,
  };
}

/** Display state of the handoff chain for the rail. */
export function chainProgress(input: StateInput) {
  const life = deriveLifecycle(input);
  const currentKey = life.live ? "complete" : life.chainKey;
  const index = currentKey ? HANDOFF_CHAIN.findIndex((s) => s.key === currentKey) : -1;
  return HANDOFF_CHAIN.map((s, i) => ({
    ...s,
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

export const GATE_ORDER = GATE_STEPS.map((s) => s.value);
