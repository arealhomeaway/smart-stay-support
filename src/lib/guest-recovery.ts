/**
 * Guest Recovery — what ARHA does FOR the guest after a service failure.
 *
 * Deliberately not a Claim. A Claim asks whether ARHA can recover money from a
 * responsible party; a Recovery asks what the guest is owed. One incident can
 * carry both, linked, each with its own state.
 *
 * Everything here is pure. Authority, escalation, communication checkpoints and
 * the derived Next Action all come from the centralised policy in
 * `recovery-policy.ts` — never from numbers written into a component. Resolve
 * never decides whether a guest deserves compensation or how much; it decides
 * who may approve it and what has to be true first.
 */
import { evidenceProgress, formatMoney, type RequirementLike } from "@/lib/claims";
import {
  ESCALATION_FLAGS,
  ESCALATION_FLAG_LABELS,
  ESCALATION_FLAG_REASONS,
  POLICY_VERSION,
  RECOVERY_POLICY,
  SUPERVISOR_TRIGGER_REASONS,
  communicationOverdue,
  isEscalationFlag,
  minutesSince,
  nextGuestUpdateDue,
  normalisePriority,
  type EscalationFlag,
  type Priority,
  type SupervisorTrigger,
} from "@/lib/recovery-policy";

export type { EscalationFlag, Priority, SupervisorTrigger };
export {
  POLICY_VERSION,
  RECOVERY_POLICY,
  ESCALATION_FLAGS,
  ESCALATION_FLAG_LABELS,
  nextGuestUpdateDue,
  normalisePriority,
};

export type RecoveryStage =
  | "reported"
  | "impact_confirmed"
  | "evidence"
  | "decision_drafted"
  | "awaiting_approval"
  | "approved"
  | "guest_offered"
  | "guest_accepted"
  | "completed"
  | "closed";

export type RecoveryOutcome = "resolved" | "declined_no_compensation" | "guest_disputed" | "withdrawn";

export type RecoveryAction =
  | "none"
  | "apology"
  | "courtesy_item"
  | "mitigation"
  | "credit"
  | "partial_refund"
  | "full_night_refund"
  | "full_refund"
  | "fee_waiver"
  | "shorten_stay"
  | "relocation"
  | "other";

export type AuthorityLevel = "pc" | "supervisor" | "director" | "emergency";

export type ApprovalStatus = "not_required" | "pending" | "approved" | "declined" | "returned";

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  not_required: "No approval required",
  pending: "Awaiting decision",
  approved: "Approved",
  declined: "Declined",
  returned: "Returned for information",
};

export const RECOVERY_STAGE_LABELS: Record<RecoveryStage, string> = {
  reported: "Reported",
  impact_confirmed: "Impact confirmed",
  evidence: "Gathering evidence",
  decision_drafted: "Decision drafted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  guest_offered: "Offered to guest",
  guest_accepted: "Guest accepted",
  completed: "Delivered",
  closed: "Closed",
};

export const RECOVERY_PIPELINE: RecoveryStage[] = [
  "reported",
  "impact_confirmed",
  "evidence",
  "decision_drafted",
  "awaiting_approval",
  "approved",
  "guest_offered",
  "guest_accepted",
  "completed",
  "closed",
];

export const OUTCOME_LABELS: Record<RecoveryOutcome, string> = {
  resolved: "Resolved with the guest",
  declined_no_compensation: "No compensation given",
  guest_disputed: "Guest still unhappy",
  withdrawn: "Withdrawn",
};

/** The remedies ARHA actually uses. Nothing here is aspirational. */
export const RECOVERY_ACTION_LABELS: Record<RecoveryAction, string> = {
  none: "No compensation",
  apology: "Non-monetary service recovery",
  courtesy_item: "Courtesy item / small recovery expense",
  mitigation: "Temporary mitigation",
  credit: "Credit toward a future stay",
  partial_refund: "Partial refund",
  full_night_refund: "Full-night refund",
  full_refund: "Multi-night / full-stay refund",
  fee_waiver: "Fee waiver",
  shorten_stay: "Shorten stay / early departure",
  relocation: "Relocation / alternate accommodation",
  other: "Other approved remedy",
};

export const RECOVERY_ACTIONS: RecoveryAction[] = [
  "none",
  "apology",
  "courtesy_item",
  "mitigation",
  "credit",
  "partial_refund",
  "full_night_refund",
  "full_refund",
  "fee_waiver",
  "shorten_stay",
  "relocation",
  "other",
];

/** Remedies that move money and therefore need an amount and an authority check. */
export const MONETARY_ACTIONS: RecoveryAction[] = [
  "courtesy_item",
  "mitigation",
  "credit",
  "partial_refund",
  "full_night_refund",
  "full_refund",
  "fee_waiver",
  "relocation",
  "other",
];

/** Remedies a coordinator can fund out of the courtesy allowance. */
const COURTESY_ACTIONS: RecoveryAction[] = ["courtesy_item", "mitigation"];

/** Remedies that are, by definition, a multi-night or full-stay refund. */
const MULTI_NIGHT_ACTIONS: RecoveryAction[] = ["full_refund", "shorten_stay"];

export function isMonetary(action: RecoveryAction | null | undefined) {
  return !!action && MONETARY_ACTIONS.includes(action);
}

export const OPEN_STAGES: RecoveryStage[] = RECOVERY_PIPELINE.filter((s) => s !== "closed");

export function isOpenRecovery(stage: RecoveryStage) {
  return OPEN_STAGES.includes(stage);
}

export function stageState(stage: RecoveryStage): "new" | "active" | "waiting" | "done" | "info" {
  if (stage === "awaiting_approval" || stage === "guest_offered") return "waiting";
  if (stage === "completed" || stage === "guest_accepted" || stage === "approved") return "done";
  if (stage === "closed") return "info";
  if (stage === "reported") return "new";
  return "active";
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

export type RecoverySlot = {
  key: string;
  label: string;
  kind: string;
  instruction: string;
  required: boolean;
};

const IMPACT_PROOF: RecoverySlot = {
  key: "impact_proof",
  label: "Photo or video of the impact",
  kind: "damage",
  instruction: "Photo, video or thermostat reading showing what the guest actually lost.",
  required: true,
};

const STAFF_VERIFICATION: RecoverySlot = {
  key: "staff_verification",
  label: "Staff or vendor verification",
  kind: "general",
  instruction: "Who confirmed the issue on site, and what they found. Confirm before any number is discussed.",
  required: true,
};

const GUEST_MESSAGE: RecoverySlot = {
  key: "guest_message",
  label: "Guest message or screenshot",
  kind: "general",
  instruction: "The guest's own description of the problem and what they are asking for.",
  required: false,
};

const RECEIPT: RecoverySlot = {
  key: "guest_receipt",
  label: "Guest receipt",
  kind: "general",
  instruction: "Required before reimbursing an out-of-pocket cost such as spoiled food.",
  required: true,
};

const VENDOR_DIAGNOSIS: RecoverySlot = {
  key: "vendor_diagnosis",
  label: "Vendor diagnosis or Work Order history",
  kind: "general",
  instruction: "What the vendor found and when — attach the Work Order where one exists.",
  required: true,
};

const PLATFORM_MESSAGE: RecoverySlot = {
  key: "platform_message",
  label: "Platform communication",
  kind: "general",
  instruction: "The Airbnb or channel thread showing what was said to the guest.",
  required: true,
};

/** The situation drives the checklist — only evidence that fits the case. */
export type RecoverySituation =
  | "food_loss"
  | "construction_noise"
  | "maintenance_failure"
  | "guest_violation"
  | "general";

export const SITUATION_LABELS: Record<RecoverySituation, string> = {
  food_loss: "Food loss",
  construction_noise: "Construction or noise",
  maintenance_failure: "Maintenance failure",
  guest_violation: "Guest violation or property damage",
  general: "Other guest impact",
};

/**
 * Checklist by situation, with the remedy narrowing it further. Money-moving
 * remedies require verified impact; an apology does not need a receipt.
 */
export function evidenceSlots(
  action: RecoveryAction | null | undefined,
  situation: RecoverySituation = "general",
): RecoverySlot[] {
  if (action === "none" || action === "apology") return [GUEST_MESSAGE, STAFF_VERIFICATION];

  switch (situation) {
    case "food_loss":
      return [RECEIPT, STAFF_VERIFICATION, GUEST_MESSAGE];
    case "construction_noise":
      return [IMPACT_PROOF, GUEST_MESSAGE];
    case "maintenance_failure":
      return [VENDOR_DIAGNOSIS, IMPACT_PROOF, GUEST_MESSAGE];
    case "guest_violation":
      return [IMPACT_PROOF, STAFF_VERIFICATION, PLATFORM_MESSAGE];
    default:
      return action === "mitigation" || action === "courtesy_item"
        ? [IMPACT_PROOF, STAFF_VERIFICATION]
        : [IMPACT_PROOF, STAFF_VERIFICATION, GUEST_MESSAGE];
  }
}

/** Reimbursing an out-of-pocket loss always needs the receipt. */
export function slotsForReimbursement(
  action: RecoveryAction | null | undefined,
  situation: RecoverySituation = "general",
): RecoverySlot[] {
  const base = evidenceSlots(action, situation);
  return base.some((s) => s.key === RECEIPT.key) ? base : [...base, RECEIPT];
}

/* ------------------------------------------------------------------ */
/* Authority                                                           */
/* ------------------------------------------------------------------ */

export type AuthorityInput = {
  recovery_action?: RecoveryAction | string | null | undefined;
  proposed_amount?: number | string | null | undefined;
  /** null / undefined means nobody has answered the Airbnb-policy question yet. */
  within_airbnb_policy?: boolean | null | undefined;
  escalation_flags?: (EscalationFlag | string)[] | null | undefined;
  emergency?: boolean | undefined;
};

export type AuthorityVerdict = {
  level: AuthorityLevel;
  label: string;
  /** Plain-language reason. Always shown — staff learn the framework while working. */
  reason: string;
  /** True when a written decision reason is required before approval completes. */
  requiresDecisionReason: boolean;
  /** True when the Airbnb-policy question still has to be answered. */
  requiresPolicyAnswer: boolean;
  /** Triggers that forced Director review regardless of amount. */
  escalations: EscalationFlag[];
  policyVersion: string;
};

export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = {
  pc: "Within coordinator authority — proceed",
  supervisor: "Operations Supervisor approval required (James)",
  director: "Director of Operations approval required (Micah)",
  emergency: "Emergency — proceed and notify leadership",
};

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Flags forced by the remedy itself, on top of anything staff recorded. */
export function derivedEscalations(input: AuthorityInput): EscalationFlag[] {
  const out: EscalationFlag[] = [];
  const action = (input.recovery_action ?? null) as RecoveryAction | null;
  if (action && MULTI_NIGHT_ACTIONS.includes(action)) out.push("multi_night_refund");
  if (action === "relocation") out.push("relocation");
  if (input.within_airbnb_policy === false) out.push("outside_policy");
  return out;
}

export function allEscalations(input: AuthorityInput): EscalationFlag[] {
  const recorded = (input.escalation_flags ?? []).filter((f): f is EscalationFlag =>
    typeof f === "string" && isEscalationFlag(f),
  );
  return Array.from(new Set([...recorded, ...derivedEscalations(input)]));
}

/**
 * Who may approve this remedy, and why. Dollar value never overrides a
 * higher-risk escalation rule.
 */
export function evaluateAuthority(input: AuthorityInput): AuthorityVerdict {
  const action = (input.recovery_action ?? null) as RecoveryAction | null;
  const amount = num(input.proposed_amount);
  const escalations = allEscalations(input);
  const base = {
    escalations,
    policyVersion: POLICY_VERSION,
    requiresDecisionReason: false,
    requiresPolicyAnswer: false,
  };

  if (input.emergency) {
    return {
      ...base,
      level: "emergency",
      label: AUTHORITY_LABELS.emergency,
      reason:
        "Guest safety or displacement is immediate. Act now, then notify the Director — the decision is still reviewed.",
    };
  }

  if (escalations.length > 0) {
    const reasons = escalations.map((f) => ESCALATION_FLAG_REASONS[f]);
    return {
      ...base,
      level: "director",
      label: AUTHORITY_LABELS.director,
      reason: `Director approval required — ${reasons.join("; ")}.`,
      requiresDecisionReason: true,
    };
  }

  if (action === "none" || action === "apology") {
    return {
      ...base,
      level: "pc",
      label: AUTHORITY_LABELS.pc,
      reason: "Reasonable non-monetary service recovery is within coordinator authority.",
    };
  }

  if (amount === null) {
    return {
      ...base,
      level: "pc",
      label: AUTHORITY_LABELS.pc,
      reason:
        "No amount proposed yet. Confirm the impact and record the proposed amount before an authority is decided.",
    };
  }

  const courtesy = !!action && COURTESY_ACTIONS.includes(action);
  if (courtesy && amount <= RECOVERY_POLICY.pcCourtesyCeiling) {
    return {
      ...base,
      level: "pc",
      label: AUTHORITY_LABELS.pc,
      reason: `Coordinators may approve courtesy items and small recovery expenses up to ${formatMoney(
        RECOVERY_POLICY.pcCourtesyCeiling,
      )}.`,
    };
  }

  const policyAnswered = input.within_airbnb_policy === true;

  if (amount > RECOVERY_POLICY.supervisorRefundCeiling) {
    return {
      ...base,
      level: "director",
      label: AUTHORITY_LABELS.director,
      reason: `Director approval required — ${formatMoney(amount)} is above the ${formatMoney(
        RECOVERY_POLICY.supervisorRefundCeiling,
      )} supervisor limit.`,
      requiresDecisionReason: true,
    };
  }

  const requiresDecisionReason = amount > RECOVERY_POLICY.supervisorDocumentationThreshold;
  const documentation = requiresDecisionReason
    ? ` A written decision reason is required because compensation exceeds ${formatMoney(
        RECOVERY_POLICY.supervisorDocumentationThreshold,
      )}.`
    : "";

  if (!policyAnswered) {
    return {
      ...base,
      level: "supervisor",
      label: AUTHORITY_LABELS.supervisor,
      reason:
        "Confirm whether this fits normal Airbnb refund/discount policy before requesting approval — " +
        "anything outside it needs Director review whatever the amount." +
        documentation,
      requiresDecisionReason,
      requiresPolicyAnswer: true,
    };
  }

  return {
    ...base,
    level: "supervisor",
    label: AUTHORITY_LABELS.supervisor,
    reason:
      `James may approve because this recovery is within standard Airbnb policy and below ${formatMoney(
        RECOVERY_POLICY.supervisorRefundCeiling,
      )}.` + documentation,
    requiresDecisionReason,
  };
}

/** The badge shown when a case leaves the normal Airbnb framework. */
export const OUTSIDE_POLICY_BADGE = "Outside Standard Airbnb Policy — Director Review Required";

export function policyBoundaryLabel(within: boolean | null | undefined): string {
  if (within === true) return "Within normal Airbnb refund/discount policy";
  if (within === false) return OUTSIDE_POLICY_BADGE;
  return "Airbnb policy fit not yet confirmed";
}

/* ------------------------------------------------------------------ */
/* PC -> James escalation                                              */
/* ------------------------------------------------------------------ */

export type SupervisorTriggerInput = {
  priority?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  action_plan?: string | null;
  guest_requested_supervisor?: boolean | null;
  resolution_attempts?: number | null;
  outcome?: RecoveryOutcome | null;
  guest_requested_amount?: number | string | null;
  vendor_missed_commitments?: number | null;
  stay_departure?: string | null;
  stay_arrival?: string | null;
  hostile_conversation?: boolean | null;
  conflicting_information?: boolean | null;
  no_sop?: boolean | null;
  reopened_at?: string | null;
  stage?: RecoveryStage;
};

/**
 * Involving James is not a handoff — it is guidance, approval or coaching. The
 * coordinator stays the owner until someone explicitly accepts the work.
 */
export function supervisorTriggers(input: SupervisorTriggerInput, now = new Date()): SupervisorTrigger[] {
  const out: SupervisorTrigger[] = [];
  const priority = normalisePriority(input.priority ?? null);
  const openMinutes = minutesSince(input.created_at, now);
  const resolved = input.stage === "closed" || input.stage === "completed";

  if (!resolved && priority === "p1" && !input.accepted_at && (openMinutes ?? 0) > RECOVERY_POLICY.p1UnacceptedMinutes) {
    out.push("p1_unaccepted");
  }
  if (!resolved && priority === "p2" && !input.action_plan && (openMinutes ?? 0) > RECOVERY_POLICY.p2NoPlanMinutes) {
    out.push("p2_no_plan");
  }
  if (input.guest_requested_supervisor) out.push("guest_asked_supervisor");
  if ((input.resolution_attempts ?? 0) >= 1 && input.outcome === "guest_disputed") {
    out.push("resolution_attempt_failed");
  }
  const asked = num(input.guest_requested_amount);
  if (asked !== null && asked > RECOVERY_POLICY.pcCourtesyCeiling) out.push("monetary_beyond_pc");
  if ((input.vendor_missed_commitments ?? 0) >= RECOVERY_POLICY.vendorMissedCommitments) {
    out.push("vendor_missed_commitments");
  }
  if (!resolved && (openMinutes ?? 0) >= RECOVERY_POLICY.unresolvedActiveStayMinutes && isActiveStay(input, now)) {
    out.push("unresolved_two_hours");
  }
  if (input.no_sop) out.push("no_sop");
  if (input.conflicting_information) out.push("conflicting_information");
  if (input.hostile_conversation) out.push("hostile_conversation");
  if (input.reopened_at) out.push("reopened_issue");
  return out;
}

export function supervisorTriggerReason(trigger: SupervisorTrigger): string {
  return SUPERVISOR_TRIGGER_REASONS[trigger];
}

export function isActiveStay(
  input: { stay_arrival?: string | null; stay_departure?: string | null },
  now = new Date(),
): boolean {
  const departure = input.stay_departure ? daysUntil(input.stay_departure, now) : null;
  const arrival = input.stay_arrival ? daysUntil(input.stay_arrival, now) : null;
  if (departure === null && arrival === null) return true; // unknown stay: treat as live
  if (departure !== null && departure < 0) return false;
  if (arrival !== null && arrival > 0) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Next Action                                                         */
/* ------------------------------------------------------------------ */

export type RecoveryLike = {
  stage: RecoveryStage;
  outcome?: RecoveryOutcome | null;
  recovery_action?: RecoveryAction | string | null;
  impact_detail?: string | null;
  proposed_amount?: number | string | null;
  guest_requested_amount?: number | string | null;
  approved_amount?: number | string | null;
  delivered_amount?: number | string | null;
  within_airbnb_policy?: boolean | null;
  escalation_flags?: string[] | null;
  approval_status?: ApprovalStatus | string | null;
  decision_reason?: string | null;
  priority?: string | null;
  guest_notified_on?: string | null;
  last_guest_update_at?: string | null;
  promised_update_at?: string | null;
  final_communication_at?: string | null;
  corrective_action?: string | null;
  follow_up_on?: string | null;
  stay_arrival?: string | null;
  stay_departure?: string | null;
  handoff_status?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type NextActionContext = {
  requirements?: RequirementLike[];
  emergency?: boolean;
  now?: Date;
};

function verdictFor(recovery: RecoveryLike, ctx: NextActionContext = {}): AuthorityVerdict {
  return evaluateAuthority({
    recovery_action: recovery.recovery_action,
    proposed_amount: recovery.proposed_amount,
    within_airbnb_policy: recovery.within_airbnb_policy,
    escalation_flags: recovery.escalation_flags,
    emergency: ctx.emergency,
  });
}

/**
 * One sentence telling the employee what to do next. Derived from stage,
 * evidence, amount against policy authority and the approval state — never a
 * status somebody has to interpret.
 */
export function nextAction(recovery: RecoveryLike, ctx: NextActionContext = {}): string {
  const now = ctx.now ?? new Date();
  const reqs = ctx.requirements ?? [];
  const progress = evidenceProgress(reqs);

  if (recovery.stage === "closed") return "Closed — nothing outstanding.";

  if (communicationOverdue(recovery, now) && recovery.stage !== "completed") {
    return "Guest update is due now — send the next update before anything else.";
  }

  if (recovery.outcome === "guest_disputed") {
    return "Guest is still unhappy. Call them, then reassess the remedy with James.";
  }

  if (recovery.approval_status === "returned") {
    return "Returned for information — add what the approver asked for and resubmit.";
  }

  if (recovery.approval_status === "declined") {
    return "Approval declined. Agree the alternative remedy with James before contacting the guest.";
  }

  if (recovery.stage === "completed") {
    const gate = closureBlockers(recovery)[0];
    if (gate) return gate;
    return "Confirm the guest accepted the resolution, then close the recovery.";
  }

  if (recovery.stage === "guest_accepted") {
    const action = (recovery.recovery_action ?? "partial_refund") as RecoveryAction;
    return `Issue the approved ${RECOVERY_ACTION_LABELS[action].toLowerCase()} in OwnerRez, then record the actual amount issued here.`;
  }

  if (recovery.stage === "guest_offered") {
    return "Waiting on the guest to respond to the offer. Follow up if there is no reply today.";
  }

  if (recovery.stage === "approved") {
    return "Approved — deliver the decision to the guest by phone, then confirm it in writing.";
  }

  if (recovery.stage === "awaiting_approval") {
    const verdict = verdictFor(recovery, ctx);
    if (verdict.requiresDecisionReason && !recovery.decision_reason) {
      return `Waiting on approval — a written decision reason is required before it can complete. ${verdict.reason}`;
    }
    return `Waiting on approval. ${verdict.reason}`;
  }

  if (!recovery.impact_detail) {
    return "Confirm the impact: what the guest lost, for how many nights, and the nightly rate.";
  }

  if (progress.blocking.length > 0) {
    const first = progress.blocking[0];
    return `Obtain ${(first?.label ?? "impact confirmation").toLowerCase()}.`;
  }

  if (!recovery.recovery_action) {
    return "Impact is confirmed. Decide the remedy — a temporary fix first where one exists.";
  }

  if (isMonetary(recovery.recovery_action as RecoveryAction) && num(recovery.proposed_amount) === null) {
    return "Record the proposed amount so Resolve can show whose approval this needs.";
  }

  const verdict = verdictFor(recovery, ctx);
  if (verdict.requiresPolicyAnswer) {
    return "Confirm whether this fits normal Airbnb refund/discount policy — it decides who approves.";
  }
  if (verdict.level === "director") return `Request Director approval. ${verdict.reason}`;
  if (verdict.level === "supervisor") return `Request James's approval. ${verdict.reason}`;

  const checkout = daysUntil(recovery.stay_departure, now);
  if (checkout !== null && checkout <= 1) {
    return "Guest checks out within a day — deliver the decision before they leave.";
  }
  return "Within your authority — deliver the decision to the guest, then record what was sent.";
}

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** The stage the record has actually reached, offered as a suggestion only. */
export function proposeStage(recovery: RecoveryLike, requirements: RequirementLike[]): RecoveryStage {
  if (recovery.stage === "closed" || recovery.stage === "completed") return recovery.stage;
  if (num(recovery.delivered_amount) !== null) return "completed";
  if (num(recovery.approved_amount) !== null) return "approved";
  if (recovery.stage === "awaiting_approval" || recovery.stage === "guest_offered") return recovery.stage;
  if (!recovery.impact_detail) return "reported";
  const progress = evidenceProgress(requirements);
  if (progress.blocking.length > 0) return "evidence";
  if (!recovery.recovery_action) return "impact_confirmed";
  return "decision_drafted";
}

/* ------------------------------------------------------------------ */
/* Closure                                                             */
/* ------------------------------------------------------------------ */

/**
 * A recovery cannot close while the guest is still owed something. Each
 * blocker is the sentence shown to the employee, in the order it must be done.
 */
export function closureBlockers(recovery: RecoveryLike): string[] {
  const out: string[] = [];
  if (!recovery.corrective_action) out.push("Document the corrective action taken on the property.");
  if (!recovery.final_communication_at) out.push("Complete the final guest communication before closing.");
  const approved = num(recovery.approved_amount);
  if (approved !== null && num(recovery.delivered_amount) === null) {
    out.push("Record the actual amount issued to the guest.");
  }
  if (recovery.approval_status === "pending") out.push("The required approval is still outstanding.");
  if (recovery.handoff_status === "requested") {
    out.push("A handoff is still waiting to be accepted — you remain responsible until it is.");
  }
  return out;
}

export function canClose(recovery: RecoveryLike): boolean {
  return closureBlockers(recovery).length === 0;
}

/* ------------------------------------------------------------------ */
/* Ownership and handoff                                               */
/* ------------------------------------------------------------------ */

export type HandoffLike = {
  assigned_to?: string | null;
  handoff_to?: string | null;
  handoff_status?: string | null;
  handoff_accepted_at?: string | null;
};

/** Ownership changes only after explicit acceptance. Tagging is not a handoff. */
export function effectiveOwner(row: HandoffLike): string | null {
  if (row.handoff_status === "accepted" && row.handoff_to) return row.handoff_to;
  return row.assigned_to ?? null;
}

export function handoffPending(row: HandoffLike): boolean {
  return row.handoff_status === "requested";
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

export type RecoveryBucket =
  | "needs_attention"
  | "waiting_evidence"
  | "approval_required"
  | "approved_action_needed"
  | "waiting_guest"
  | "reassess"
  | "recently_resolved";

export const BUCKET_ORDER: RecoveryBucket[] = [
  "needs_attention",
  "waiting_evidence",
  "approval_required",
  "approved_action_needed",
  "waiting_guest",
  "reassess",
  "recently_resolved",
];

export const BUCKET_LABELS: Record<RecoveryBucket, string> = {
  needs_attention: "Needs attention",
  waiting_evidence: "Waiting on evidence",
  approval_required: "Approval required",
  approved_action_needed: "Approved — action needed",
  waiting_guest: "Waiting on guest",
  reassess: "Reassess",
  recently_resolved: "Recently resolved",
};

export function recoveryBucket(
  recovery: RecoveryLike,
  ctx: { requirements?: RequirementLike[]; now?: Date } = {},
): RecoveryBucket | null {
  const now = ctx.now ?? new Date();
  const progress = evidenceProgress(ctx.requirements ?? []);

  if (recovery.stage === "closed" || recovery.stage === "completed") {
    const when = recovery.updated_at ?? recovery.created_at ?? null;
    const days = when ? Math.abs(daysUntil(when, now) ?? 999) : 999;
    return days <= 30 ? "recently_resolved" : null;
  }

  if (recovery.outcome === "guest_disputed" || recovery.approval_status === "declined") return "reassess";
  if (recovery.approval_status === "returned") return "reassess";
  if (communicationOverdue(recovery, now)) return "needs_attention";

  const checkout = daysUntil(recovery.stay_departure, now);
  if (checkout !== null && checkout <= 1 && recovery.stage !== "guest_offered") return "needs_attention";

  if (recovery.stage === "awaiting_approval" || recovery.approval_status === "pending") return "approval_required";
  if (recovery.stage === "approved" || recovery.stage === "guest_accepted") return "approved_action_needed";
  if (recovery.stage === "guest_offered") return "waiting_guest";
  if (progress.blocking.length > 0) return "waiting_evidence";
  return "needs_attention";
}

const PRIORITY_WEIGHT: Record<Priority, number> = { p1: 0, p2: 1, p3: 2 };

export function recoverySort(a: RecoveryLike, b: RecoveryLike): number {
  const pa = PRIORITY_WEIGHT[normalisePriority(a.priority ?? null)];
  const pb = PRIORITY_WEIGHT[normalisePriority(b.priority ?? null)];
  if (pa !== pb) return pa - pb;
  const da = daysUntil(a.stay_departure) ?? 9999;
  const db = daysUntil(b.stay_departure) ?? 9999;
  if (da !== db) return da - db;
  return (b.created_at ?? "").localeCompare(a.created_at ?? "");
}

/* ------------------------------------------------------------------ */
/* Manager oversight                                                   */
/* ------------------------------------------------------------------ */

export type ManagerFilter =
  | "pending_approvals"
  | "above_supervisor_limit"
  | "documentation_missing"
  | "outside_policy"
  | "director_escalations"
  | "communication_overdue"
  | "unresolved_two_hours"
  | "near_checkout"
  | "approved_not_delivered"
  | "reopened";

export const MANAGER_FILTER_LABELS: Record<ManagerFilter, string> = {
  pending_approvals: "Pending approvals",
  above_supervisor_limit: `Refunds above ${formatMoney(RECOVERY_POLICY.supervisorRefundCeiling)}`,
  documentation_missing: `Approvals over ${formatMoney(RECOVERY_POLICY.supervisorDocumentationThreshold)} needing a written reason`,
  outside_policy: "Outside standard Airbnb policy",
  director_escalations: "Automatic Director escalations",
  communication_overdue: "Overdue guest communication",
  unresolved_two_hours: "Active-stay issues unresolved over 2 hours",
  near_checkout: "Guest checks out within a day",
  approved_not_delivered: "Approved but not yet delivered",
  reopened: "Reopened recoveries",
};

export type ManagerRow = RecoveryLike & { reopened_at?: string | null; property_id?: string | null };

export function matchesManagerFilter(row: ManagerRow, filter: ManagerFilter, now = new Date()): boolean {
  const amount = num(row.proposed_amount) ?? num(row.approved_amount);
  switch (filter) {
    case "pending_approvals":
      return row.approval_status === "pending";
    case "above_supervisor_limit":
      return amount !== null && amount > RECOVERY_POLICY.supervisorRefundCeiling;
    case "documentation_missing":
      return (
        amount !== null &&
        amount > RECOVERY_POLICY.supervisorDocumentationThreshold &&
        amount <= RECOVERY_POLICY.supervisorRefundCeiling &&
        !row.decision_reason
      );
    case "outside_policy":
      return row.within_airbnb_policy === false;
    case "director_escalations":
      return allEscalations({
        recovery_action: row.recovery_action,
        within_airbnb_policy: row.within_airbnb_policy,
        escalation_flags: row.escalation_flags,
      }).length > 0;
    case "communication_overdue":
      return isOpenRecovery(row.stage) && communicationOverdue(row, now);
    case "unresolved_two_hours":
      return (
        isOpenRecovery(row.stage) &&
        isActiveStay(row, now) &&
        (minutesSince(row.created_at, now) ?? 0) >= RECOVERY_POLICY.unresolvedActiveStayMinutes &&
        row.stage !== "completed"
      );
    case "near_checkout": {
      const days = daysUntil(row.stay_departure, now);
      return isOpenRecovery(row.stage) && days !== null && days <= 1 && days >= 0;
    }
    case "approved_not_delivered":
      return num(row.approved_amount) !== null && num(row.delivered_amount) === null;
    case "reopened":
      return !!row.reopened_at;
    default:
      return false;
  }
}

/** Properties with more than one recovery in the window — a pattern, not a case. */
export function repeatProperties(rows: ManagerRow[]): { property_id: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.property_id) continue;
    counts.set(row.property_id, (counts.get(row.property_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([property_id, count]) => ({ property_id, count }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------ */
/* Duplicate protection                                                */
/* ------------------------------------------------------------------ */

export type DuplicateCandidate = {
  id?: string;
  stage: RecoveryStage;
  ticket_id?: string | null;
  ownerrez_booking_id?: string | null;
  title?: string | null;
};

/** Warn, never block: two remedies on one stay can be legitimate. */
export function findDuplicates(
  draft: { ticket_id?: string | null; ownerrez_booking_id?: string | null },
  existing: DuplicateCandidate[],
): { candidate: DuplicateCandidate; reason: string }[] {
  const out: { candidate: DuplicateCandidate; reason: string }[] = [];
  for (const row of existing) {
    if (!isOpenRecovery(row.stage)) continue;
    if (draft.ticket_id && row.ticket_id === draft.ticket_id) {
      out.push({ candidate: row, reason: "An open recovery already exists for this ticket." });
      continue;
    }
    if (draft.ownerrez_booking_id && row.ownerrez_booking_id === draft.ownerrez_booking_id) {
      out.push({ candidate: row, reason: "An open recovery already exists for this reservation." });
    }
  }
  return out;
}

export { formatMoney, communicationOverdue };
