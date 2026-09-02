/**
 * Work Order rules — the maintenance judgment that used to live in Telegram.
 *
 * A Work Order is the execution and money record hanging off a Ticket: what a
 * vendor is being asked to do, what it costs, who may authorise it, whether a
 * warranty might cover it, and what still stands between it and closure.
 *
 * Everything here is pure. The thresholds come from maintenance-policy.ts and
 * are never restated.
 */

import {
  EMERGENCY_REASON_CLAUSES,
  EMERGENCY_REASON_LABELS,
  MAINTENANCE_POLICY,
  MAINTENANCE_POLICY_VERSION,
  SECOND_QUOTE_LABELS,
  money,
  minutesSince,
  normalisePriority,
  type EmergencyReason,
  type Priority,
  type SecondQuoteSignal,
} from "./maintenance-policy";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/** One Work Order, two phases. Mitigation never authorises the permanent fix. */
export const WORK_ORDER_PHASES = ["mitigation", "permanent"] as const;
export type WorkOrderPhase = (typeof WORK_ORDER_PHASES)[number];

export const PHASE_LABELS: Record<WorkOrderPhase, string> = {
  mitigation: "Emergency mitigation",
  permanent: "Permanent repair",
};

export const WORK_ORDER_STAGES = [
  "needs_diagnosis",
  "quote_requested",
  "quote_received",
  "awaiting_approval",
  "approved",
  "scheduled",
  "in_progress",
  "evidence",
  "closed",
] as const;
export type WorkOrderStage = (typeof WORK_ORDER_STAGES)[number];

export const STAGE_LABELS: Record<WorkOrderStage, string> = {
  needs_diagnosis: "Diagnosis needed",
  quote_requested: "Quote requested",
  quote_received: "Quote received",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  scheduled: "Scheduled",
  in_progress: "In progress",
  evidence: "Completion evidence",
  closed: "Closed",
};

export type ApprovalStatus = "not_required" | "pending" | "approved" | "declined" | "info_requested";

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  not_required: "No approval required",
  pending: "Waiting on owner",
  approved: "Approved",
  declined: "Declined",
  info_requested: "Owner asked for more information",
};

/** The shape the rules read. Every field is optional so partial rows work. */
export type WorkOrderLike = {
  phase?: WorkOrderPhase | null;
  priority?: string | null;
  emergency_reason?: EmergencyReason | string | null;
  contractual_exception?: boolean | null;

  quote_requested_at?: string | null;
  quote_received_at?: string | null;
  quote_amount?: number | string | null;
  second_quote_amount?: number | string | null;

  approval_status?: ApprovalStatus | string | null;
  approved_amount?: number | string | null;

  vendor_org_id?: string | null;
  vendor_name?: string | null;
  vendor_contacted_at?: string | null;
  vendor_acknowledged_at?: string | null;
  scheduled_for?: string | null;
  vendor_eta_at?: string | null;
  vendor_arrived_at?: string | null;
  vendor_completed_at?: string | null;
  missed_commitments?: number | null;

  warranty_may_apply?: boolean | null;
  warranty_contacted_at?: string | null;
  warranty_eta_at?: string | null;
  warranty_override_reason?: string | null;

  temporary_mitigation?: string | null;
  permanent_repair_needed?: boolean | null;

  final_cost?: number | string | null;
  evidence_complete?: boolean | null;
  guest_notified_at?: string | null;
  occupied_now?: boolean | null;
  follow_up_ticket_id?: string | null;
  closed_at?: string | null;
};

function num(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/* Authority                                                           */
/* ------------------------------------------------------------------ */

export type AuthorityLevel = "self" | "supervisor" | "owner" | "emergency";

export type AuthorityVerdict = {
  level: AuthorityLevel;
  label: string;
  reason: string;
  ownerApprovalRequired: boolean;
  /** True when mitigation may proceed but the permanent repair still cannot. */
  mitigationOnly: boolean;
  policyVersion: string;
  amount: number | null;
};

/**
 * Who may authorise this work.
 *
 * A coordinator may always get quotes and dispatch an approved vendor. James
 * may approve normal operational work up to the owner threshold. Above it the
 * owner decides. Emergency mitigation proceeds on its own authority and never
 * carries the permanent repair with it — Micah is not pulled in merely because
 * a routine repair costs more than $250.
 */
export function evaluateAuthority(input: WorkOrderLike): AuthorityVerdict {
  const amount = num(input.quote_amount) ?? num(input.approved_amount);
  const threshold = MAINTENANCE_POLICY.ownerApprovalThreshold;
  const phase: WorkOrderPhase = input.phase === "mitigation" ? "mitigation" : "permanent";
  const emergency = input.emergency_reason as EmergencyReason | null | undefined;

  if (phase === "mitigation" && emergency) {
    const clause = EMERGENCY_REASON_CLAUSES[emergency] ?? "contain the immediate issue";
    return {
      level: "emergency",
      label: "Emergency mitigation may proceed",
      reason: `Mitigation may proceed without prior owner approval to ${clause}. The permanent repair is evaluated separately and may still require owner approval.`,
      ownerApprovalRequired: false,
      mitigationOnly: true,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount,
    };
  }

  if (amount == null) {
    return {
      level: "self",
      label: "Get the quote",
      reason: "A coordinator may request quotes and dispatch an approved vendor. Authority is evaluated once an amount is known.",
      ownerApprovalRequired: false,
      mitigationOnly: false,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount: null,
    };
  }

  if (amount > threshold && !input.contractual_exception) {
    return {
      level: "owner",
      label: "Owner approval required",
      reason: `Owner approval is required because the permanent repair of ${money(amount)} exceeds ${money(threshold)}.`,
      ownerApprovalRequired: true,
      mitigationOnly: false,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount,
    };
  }

  if (amount > threshold && input.contractual_exception) {
    return {
      level: "supervisor",
      label: "James may approve",
      reason: `${money(amount)} exceeds ${money(threshold)}, but a recorded contractual exception applies, so it stays within ARHA's authority.`,
      ownerApprovalRequired: false,
      mitigationOnly: false,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount,
    };
  }

  return {
    level: "supervisor",
    label: "James may approve",
    reason: `${money(amount)} is within ARHA's established authority of ${money(threshold)}, so James may approve and coordinate the work.`,
    ownerApprovalRequired: false,
    mitigationOnly: false,
    policyVersion: MAINTENANCE_POLICY_VERSION,
    amount,
  };
}

/* ------------------------------------------------------------------ */
/* Warranty                                                            */
/* ------------------------------------------------------------------ */

export type PropertyWarranty = {
  builder_present?: boolean | null;
  builder_expires_on?: string | null;
  furniture_expires_on?: string | null;
  ["claim_process + external_links"]?: string | null;
} | null;

export type WarrantyHint = {
  mayApply: boolean;
  kind: "builder" | "furniture" | null;
  expiresOn: string | null;
  contact: string | null;
  reason: string;
};

const FURNITURE_CATEGORIES = ["furniture", "furnishing", "mattress", "sofa", "bed"];
const BUILDER_CATEGORIES = ["plumbing", "electrical", "hvac", "roof", "structural", "foundation", "appliance"];

function unexpired(date: string | null | undefined, now: Date) {
  if (!date) return false;
  const t = new Date(date).getTime();
  return Number.isFinite(t) && t >= now.getTime();
}

function usableContact(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || ["none", "n/a", "na", "-"].includes(trimmed.toLowerCase())) return null;
  return trimmed;
}

/**
 * "Warranty may apply" — never "warranty covers this". Resolve only speaks
 * when the property actually has unexpired warranty data on file; it never
 * infers HVAC or appliance coverage, because that data does not exist.
 */
export function warrantyHint(
  warranty: PropertyWarranty,
  category: string | null | undefined,
  now = new Date(),
): WarrantyHint {
  const none: WarrantyHint = {
    mayApply: false,
    kind: null,
    expiresOn: null,
    contact: null,
    reason: "No warranty on file for this home.",
  };
  if (!warranty) return none;

  const cat = (category ?? "").toLowerCase();
  const contact = usableContact(warranty["claim_process + external_links"]);

  const builderLive = warranty.builder_present === true && unexpired(warranty.builder_expires_on, now);
  const furnitureLive = unexpired(warranty.furniture_expires_on, now);

  const builderFit = !cat || BUILDER_CATEGORIES.some((c) => cat.includes(c));
  const furnitureFit = !cat || FURNITURE_CATEGORIES.some((c) => cat.includes(c));

  if (builderLive && builderFit) {
    return {
      mayApply: true,
      kind: "builder",
      expiresOn: warranty.builder_expires_on ?? null,
      contact,
      reason: `Builder warranty on file through ${warranty.builder_expires_on}. Confirm coverage with the provider before scheduling a paid repair.`,
    };
  }

  if (furnitureLive && furnitureFit) {
    return {
      mayApply: true,
      kind: "furniture",
      expiresOn: warranty.furniture_expires_on ?? null,
      contact,
      reason: `Furniture warranty on file through ${warranty.furniture_expires_on}. Confirm coverage with the provider before replacing at ARHA cost.`,
    };
  }

  if (warranty.builder_present === true && !unexpired(warranty.builder_expires_on, now)) {
    return { ...none, reason: "Builder warranty on file has expired." };
  }

  return none;
}

/** A human decided not to keep waiting. Elapsed time alone never does this. */
export function warrantyBypassed(wo: WorkOrderLike) {
  return Boolean(wo.warranty_override_reason);
}

/* ------------------------------------------------------------------ */
/* Second quote                                                        */
/* ------------------------------------------------------------------ */

export type SecondQuoteAdvice = { recommended: boolean; signals: SecondQuoteSignal[]; reason: string };

/**
 * Advice, never a block. Signals are the ones a coordinator would notice; no
 * new financial thresholds are invented beyond the ones policy already sets.
 */
export function secondQuoteAdvice(input: {
  quote_amount?: number | string | null;
  second_quote_amount?: number | string | null;
  replacement_cost?: number | string | null;
  diagnosis_uncertain?: boolean | null;
  owner_requested_comparison?: boolean | null;
}): SecondQuoteAdvice {
  const signals: SecondQuoteSignal[] = [];
  const first = num(input.quote_amount);
  const second = num(input.second_quote_amount);
  const replacement = num(input.replacement_cost);

  if (first != null && second != null) {
    const low = Math.min(first, second);
    const high = Math.max(first, second);
    if (low > 0 && high >= low * 1.5) signals.push("quotes_differ");
  }
  if (first != null && replacement != null && replacement > 0 && first >= replacement * 0.6) {
    signals.push("approaches_replacement");
  }
  if (input.diagnosis_uncertain) signals.push("diagnosis_uncertain");
  if (input.owner_requested_comparison) signals.push("owner_requested");

  if (!signals.length) {
    return { recommended: false, signals, reason: "Nothing suggests a comparison quote is needed." };
  }
  return {
    recommended: true,
    signals,
    reason: `Consider a second quote — ${signals.map((s) => SECOND_QUOTE_LABELS[s].toLowerCase()).join("; ")}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Vendor commitments and checkpoints                                  */
/* ------------------------------------------------------------------ */

export type CommitmentStatus = {
  acknowledgeOverdue: boolean;
  etaMissed: boolean;
  misses: number;
  action: string | null;
};

/** Resolve counts the misses so nobody has to remember them. */
export function commitmentStatus(wo: WorkOrderLike, now = new Date()): CommitmentStatus {
  const priority: Priority = normalisePriority(wo.priority);
  const misses = wo.missed_commitments ?? 0;

  const sinceContact = minutesSince(wo.vendor_contacted_at, now);

  const acknowledgeOverdue =
    Boolean(wo.vendor_contacted_at) &&
    !wo.vendor_acknowledged_at &&
    sinceContact != null &&
    sinceContact > MAINTENANCE_POLICY.vendorAcknowledgeMinutes[priority];


  const etaMissed =
    Boolean(wo.vendor_eta_at) &&
    !wo.vendor_arrived_at &&
    new Date(wo.vendor_eta_at as string).getTime() < now.getTime();

  let action: string | null = null;
  if (misses >= MAINTENANCE_POLICY.missPerformanceReview) {
    action = "Repeated missed commitments — open a vendor performance review with Micah.";
  } else if (misses >= MAINTENANCE_POLICY.missNotifySupervisor) {
    action = "Backup vendor should be considered — two commitments missed. Notify James.";
  } else if (misses >= MAINTENANCE_POLICY.missFollowUp) {
    action = "Vendor missed a commitment — follow up before it becomes a second miss.";
  } else if (acknowledgeOverdue) {
    action = `No vendor acknowledgment within ${MAINTENANCE_POLICY.vendorAcknowledgeMinutes[priority]} minutes — move to the backup vendor.`;
  } else if (etaMissed) {
    action = "Vendor missed the ETA — get a new arrival time or dispatch a backup.";
  }

  return { acknowledgeOverdue, etaMissed, misses, action };
}

export type Checkpoint =
  | "contact_vendor"
  | "await_acknowledgment"
  | "confirm_eta"
  | "missed_eta"
  | "await_arrival"
  | "await_completion"
  | "collect_evidence"
  | "update_guest"
  | "none";

export const CHECKPOINT_LABELS: Record<Checkpoint, string> = {
  contact_vendor: "Contact the vendor",
  await_acknowledgment: "Waiting on vendor acknowledgment",
  confirm_eta: "Confirm the arrival window",
  missed_eta: "Vendor missed the ETA",
  await_arrival: "Waiting for the vendor on site",
  await_completion: "Work in progress",
  collect_evidence: "Completion evidence outstanding",
  update_guest: "Guest update outstanding",
  none: "Nothing outstanding",
};

/** The next vendor checkpoint, derived rather than typed by staff. */
export function nextCheckpoint(wo: WorkOrderLike, now = new Date()): Checkpoint {
  if (wo.closed_at) return "none";
  if (!wo.vendor_org_id && !wo.vendor_name) return "contact_vendor";
  if (!wo.vendor_contacted_at) return "contact_vendor";
  if (!wo.vendor_acknowledged_at) return "await_acknowledgment";
  if (!wo.scheduled_for && !wo.vendor_eta_at) return "confirm_eta";
  if (!wo.vendor_arrived_at) {
    return commitmentStatus(wo, now).etaMissed ? "missed_eta" : "await_arrival";
  }
  if (!wo.vendor_completed_at) return "await_completion";
  if (!wo.evidence_complete) return "collect_evidence";
  if (wo.occupied_now && !wo.guest_notified_at) return "update_guest";
  return "none";
}

/* ------------------------------------------------------------------ */
/* Derived stage and next action                                       */
/* ------------------------------------------------------------------ */

/** The stage is read off the record, never typed by staff. */
export function derivedStage(wo: WorkOrderLike): WorkOrderStage {
  if (wo.closed_at) return "closed";
  if (wo.vendor_completed_at) return "evidence";
  if (wo.vendor_arrived_at) return "in_progress";
  if (wo.scheduled_for || wo.vendor_eta_at) return "scheduled";

  const verdict = evaluateAuthority(wo);
  const status = (wo.approval_status ?? "not_required") as ApprovalStatus;
  if (verdict.ownerApprovalRequired && status !== "approved") return "awaiting_approval";
  if (status === "approved") return "approved";

  if (wo.quote_received_at || num(wo.quote_amount) != null) return "quote_received";
  if (wo.quote_requested_at) return "quote_requested";
  return "needs_diagnosis";
}

export type WaitingOn = "vendor" | "quote" | "owner" | "warranty" | null;

export function waitingOn(wo: WorkOrderLike): WaitingOn {
  if (wo.closed_at) return null;
  if (evaluateAuthority(wo).ownerApprovalRequired && wo.approval_status !== "approved") return "owner";
  if (wo.warranty_may_apply && wo.warranty_contacted_at && !warrantyBypassed(wo) && !wo.vendor_completed_at) {
    return "warranty";
  }
  if (wo.quote_requested_at && !wo.quote_received_at && num(wo.quote_amount) == null) return "quote";
  if (wo.vendor_contacted_at && !wo.vendor_completed_at) return "vendor";
  return null;
}

/** One sentence: the single thing this Work Order needs next. */
export function nextAction(wo: WorkOrderLike, now = new Date()): string {
  if (wo.closed_at) return "Closed — nothing outstanding.";

  const commitments = commitmentStatus(wo, now);
  if (commitments.action) return commitments.action;

  if (wo.warranty_may_apply && !wo.warranty_contacted_at && !warrantyBypassed(wo)) {
    return "Warranty may apply — contact the warranty provider before committing to a paid repair.";
  }
  if (wo.warranty_may_apply && wo.warranty_contacted_at && !wo.warranty_eta_at && !warrantyBypassed(wo)) {
    return "Record the warranty appointment or next available ETA, then judge the impact on the stay.";
  }

  const verdict = evaluateAuthority(wo);
  const status = (wo.approval_status ?? "not_required") as ApprovalStatus;

  if (verdict.mitigationOnly && wo.permanent_repair_needed && wo.vendor_completed_at) {
    return "Mitigation is done — scope the permanent repair and evaluate approval on its own amount.";
  }
  if (verdict.ownerApprovalRequired) {
    if (status === "pending") return "Waiting on the owner's decision. Owner notified is not owner approved.";
    if (status === "info_requested") return "Owner asked for more information — send the detail they need.";
    if (status === "declined") return "Owner declined — record the alternative or close with the reason.";
    if (status !== "approved") return verdict.reason;
  }

  const stage = derivedStage(wo);
  if (stage === "needs_diagnosis") return "Diagnose the issue or request a quote from an approved vendor.";
  if (stage === "quote_requested") return "Chase the quote — nothing can be authorised without an amount.";
  if (stage === "quote_received") return verdict.reason;
  if (stage === "approved" || stage === "scheduled" || stage === "in_progress") {
    return CHECKPOINT_LABELS[nextCheckpoint(wo, now)];
  }

  const blockers = closureBlockers(wo);
  if (blockers.length) return blockers[0] as string;
  return "Ready to close.";
}

/* ------------------------------------------------------------------ */
/* Closure                                                             */
/* ------------------------------------------------------------------ */

/** What still stands between this Work Order and closure. */
export function closureBlockers(wo: WorkOrderLike): string[] {
  const blockers: string[] = [];
  if (!wo.vendor_completed_at) blockers.push("Vendor completion has not been confirmed.");
  if (!wo.evidence_complete) blockers.push("Completion photo or video evidence is missing.");
  if (num(wo.final_cost) == null) blockers.push("Final cost has not been recorded.");
  if (wo.occupied_now && !wo.guest_notified_at) blockers.push("The guest in the home has not been updated.");

  const verdict = evaluateAuthority(wo);
  if (verdict.ownerApprovalRequired && wo.approval_status !== "approved") {
    blockers.push("Owner approval for this repair is not documented.");
  }
  if (wo.permanent_repair_needed && wo.phase === "mitigation" && !wo.follow_up_ticket_id) {
    blockers.push("Permanent repair is still outstanding — create the follow-up before closing.");
  }
  return blockers;
}

export function canClose(wo: WorkOrderLike) {
  return closureBlockers(wo).length === 0;
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

export const WORK_ORDER_BUCKETS = [
  "needs_action",
  "waiting_quote",
  "waiting_owner",
  "warranty_pending",
  "waiting_vendor",
  "evidence_missing",
  "permanent_pending",
  "closed",
] as const;
export type WorkOrderBucket = (typeof WORK_ORDER_BUCKETS)[number];

export const BUCKET_LABELS: Record<WorkOrderBucket, string> = {
  needs_action: "Needs action now",
  waiting_quote: "Waiting for a quote",
  waiting_owner: "Waiting for owner approval",
  warranty_pending: "Warranty pending",
  waiting_vendor: "Waiting for the vendor",
  evidence_missing: "Completion evidence missing",
  permanent_pending: "Permanent repair still pending",
  closed: "Closed",
};

export function workOrderBucket(wo: WorkOrderLike, now = new Date()): WorkOrderBucket {
  if (wo.closed_at) return "closed";
  const commitments = commitmentStatus(wo, now);
  if (commitments.action) return "needs_action";
  if (wo.vendor_completed_at && !wo.evidence_complete) return "evidence_missing";
  if (
    wo.phase === "mitigation" &&
    wo.permanent_repair_needed &&
    wo.vendor_completed_at &&
    !wo.follow_up_ticket_id
  ) {
    return "permanent_pending";
  }
  switch (waitingOn(wo)) {
    case "owner":
      return "waiting_owner";
    case "warranty":
      return "warranty_pending";
    case "quote":
      return "waiting_quote";
    case "vendor":
      return "waiting_vendor";
    default:
      return "needs_action";
  }
}

export { EMERGENCY_REASON_LABELS, MAINTENANCE_POLICY_VERSION, money };
