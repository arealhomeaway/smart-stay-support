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

export type ApprovalStatus =
  "not_required" | "pending" | "approved" | "declined" | "info_requested";

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
  /** Supervisor decision for the $200–$350 band. */
  supervisor_approval_status?: ApprovalStatus | string | null;
  /** When the homeowner was told about supervisor-authorised work. */
  owner_fyi_at?: string | null;

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
  /** True in the $200–$350 band: a supervisor decides before work starts. */
  supervisorApprovalRequired: boolean;
  /** True when the homeowner is told afterwards rather than asked first. */
  ownerFyiRequired: boolean;
  /** True when mitigation may proceed but the permanent repair still cannot. */
  mitigationOnly: boolean;
  policyVersion: string;
  amount: number | null;
};

/**
 * Who may authorise this work — one ladder, matching the maintenance policy:
 *
 *  - under $200 — proceed, record the cost;
 *  - $200 to $350 — a supervisor approves first, the homeowner is told after;
 *  - above $350 — the homeowner decides before work starts;
 *  - emergency mitigation — proceeds under a documented exception, and never
 *    carries the permanent repair with it.
 */
export function evaluateAuthority(input: WorkOrderLike): AuthorityVerdict {
  const amount = num(input.quote_amount) ?? num(input.approved_amount);
  const threshold = MAINTENANCE_POLICY.ownerApprovalThreshold;
  const supThreshold = MAINTENANCE_POLICY.supervisorApprovalThreshold;
  const phase: WorkOrderPhase = input.phase === "mitigation" ? "mitigation" : "permanent";
  const emergency = input.emergency_reason as EmergencyReason | null | undefined;

  if (phase === "mitigation" && emergency) {
    const clause = EMERGENCY_REASON_CLAUSES[emergency] ?? "contain the immediate issue";
    return {
      level: "emergency",
      label: "Emergency mitigation may proceed",
      reason: `Mitigation may proceed without prior approval to ${clause}. Record the exception — reason, scope, amount, who decided and evidence. The permanent repair is evaluated separately.`,
      ownerApprovalRequired: false,
      supervisorApprovalRequired: false,
      ownerFyiRequired: true,
      mitigationOnly: true,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount,
    };
  }

  if (amount == null) {
    return {
      level: "self",
      label: "Get the quote",
      reason:
        "A coordinator may request quotes and dispatch an approved vendor. Authority is evaluated once an amount is known.",
      ownerApprovalRequired: false,
      supervisorApprovalRequired: false,
      ownerFyiRequired: false,
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
      supervisorApprovalRequired: false,
      ownerFyiRequired: false,
      mitigationOnly: false,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount,
    };
  }

  if (amount > threshold && input.contractual_exception) {
    return {
      level: "supervisor",
      label: "Supervisor approval",
      reason: `${money(amount)} exceeds ${money(threshold)}, but a recorded contractual exception applies, so a supervisor approves and the homeowner is told afterwards.`,
      ownerApprovalRequired: false,
      supervisorApprovalRequired: true,
      ownerFyiRequired: true,
      mitigationOnly: false,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount,
    };
  }

  if (amount < supThreshold) {
    return {
      level: "self",
      label: "Proceed — no approval needed",
      reason: `${money(amount)} is under ${money(supThreshold)}, so ARHA proceeds and records the cost.`,
      ownerApprovalRequired: false,
      supervisorApprovalRequired: false,
      ownerFyiRequired: false,
      mitigationOnly: false,
      policyVersion: MAINTENANCE_POLICY_VERSION,
      amount,
    };
  }

  return {
    level: "supervisor",
    label: "Supervisor approval",
    reason: `${money(amount)} falls between ${money(supThreshold)} and ${money(threshold)}, so a supervisor approves before work starts and the homeowner is told afterwards.`,
    ownerApprovalRequired: false,
    supervisorApprovalRequired: true,
    ownerFyiRequired: true,
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
const BUILDER_CATEGORIES = [
  "plumbing",
  "electrical",
  "hvac",
  "roof",
  "structural",
  "foundation",
  "appliance",
];

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

  const builderLive =
    warranty.builder_present === true && unexpired(warranty.builder_expires_on, now);
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

export type SecondQuoteAdvice = {
  recommended: boolean;
  signals: SecondQuoteSignal[];
  reason: string;
};

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
    return {
      recommended: false,
      signals,
      reason: "Nothing suggests a comparison quote is needed.",
    };
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
  if (verdict.supervisorApprovalRequired && !supervisorApproved(wo)) return "awaiting_approval";
  if (status === "approved") return "approved";

  if (wo.quote_received_at || num(wo.quote_amount) != null) return "quote_received";
  if (wo.quote_requested_at) return "quote_requested";
  return "needs_diagnosis";
}

/** Has a supervisor signed off the $200–$350 band? */
export function supervisorApproved(wo: WorkOrderLike): boolean {
  return wo.supervisor_approval_status === "approved";
}

export type WaitingOn = "vendor" | "quote" | "owner" | "supervisor" | "warranty" | null;

export function waitingOn(wo: WorkOrderLike): WaitingOn {
  if (wo.closed_at) return null;
  const authority = evaluateAuthority(wo);
  if (authority.ownerApprovalRequired && wo.approval_status !== "approved") return "owner";
  if (authority.supervisorApprovalRequired && !supervisorApproved(wo)) return "supervisor";
  if (
    wo.warranty_may_apply &&
    wo.warranty_contacted_at &&
    !warrantyBypassed(wo) &&
    !wo.vendor_completed_at
  ) {
    return "warranty";
  }
  if (wo.quote_requested_at && !wo.quote_received_at && num(wo.quote_amount) == null)
    return "quote";
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
  if (
    wo.warranty_may_apply &&
    wo.warranty_contacted_at &&
    !wo.warranty_eta_at &&
    !warrantyBypassed(wo)
  ) {
    return "Record the warranty appointment or next available ETA, then judge the impact on the stay.";
  }

  const verdict = evaluateAuthority(wo);
  const status = (wo.approval_status ?? "not_required") as ApprovalStatus;

  if (verdict.mitigationOnly && wo.permanent_repair_needed && wo.vendor_completed_at) {
    return "Mitigation is done — scope the permanent repair and evaluate approval on its own amount.";
  }
  if (verdict.ownerApprovalRequired) {
    if (status === "pending")
      return "Waiting on the owner's decision. Owner notified is not owner approved.";
    if (status === "info_requested")
      return "Owner asked for more information — send the detail they need.";
    if (status === "declined")
      return "Owner declined — record the alternative or close with the reason.";
    if (status !== "approved") return verdict.reason;
  }
  if (verdict.supervisorApprovalRequired && !supervisorApproved(wo)) {
    const sup = (wo.supervisor_approval_status ?? "not_required") as ApprovalStatus;
    if (sup === "pending") return "Waiting on the supervisor's decision on this amount.";
    if (sup === "declined")
      return "Supervisor declined — record the alternative before going further.";
    return "Request supervisor approval for this amount, then tell the homeowner once it is authorised.";
  }
  if (verdict.ownerFyiRequired && supervisorApproved(wo) && !wo.owner_fyi_at && !wo.closed_at) {
    return "Approved — send the homeowner the FYI that this work is going ahead.";
  }

  const stage = derivedStage(wo);
  if (stage === "needs_diagnosis")
    return "Diagnose the issue or request a quote from an approved vendor.";
  if (stage === "quote_requested")
    return "Chase the quote — nothing can be authorised without an amount.";
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
export function closureBlockers(
  wo: WorkOrderLike,
  requirements?: { required?: boolean | null; status?: string | null; label?: string | null }[],
): string[] {
  const blockers: string[] = [];
  if (!wo.vendor_completed_at) blockers.push("Vendor completion has not been confirmed.");
  const outstanding = (requirements ?? []).filter(
    (r) => r.required !== false && r.status !== "verified" && r.status !== "accepted_exception",
  );
  if (outstanding.length) {
    blockers.push(`Evidence outstanding: ${outstanding[0]?.label ?? "required item"}.`);
  }
  if (!wo.evidence_complete) blockers.push("Completion photo or video evidence is missing.");
  if (num(wo.final_cost) == null) blockers.push("Final cost has not been recorded.");
  if (wo.occupied_now && !wo.guest_notified_at)
    blockers.push("The guest in the home has not been updated.");

  const verdict = evaluateAuthority(wo);
  if (verdict.ownerApprovalRequired && wo.approval_status !== "approved") {
    blockers.push("Owner approval for this repair is not documented.");
  }
  if (verdict.supervisorApprovalRequired && !supervisorApproved(wo)) {
    blockers.push("Supervisor approval for this amount is not documented.");
  }
  if (verdict.mitigationOnly && !wo.emergency_reason) {
    blockers.push("Record the emergency exception — reason, scope, amount and evidence.");
  }
  if (wo.permanent_repair_needed && wo.phase === "mitigation" && !wo.follow_up_ticket_id) {
    blockers.push("Permanent repair is still outstanding — create the follow-up before closing.");
  }
  return blockers;
}

export function canClose(
  wo: WorkOrderLike,
  requirements?: { required?: boolean | null; status?: string | null; label?: string | null }[],
) {
  return closureBlockers(wo, requirements).length === 0;
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

/* ------------------------------------------------------------------ */
/* Ownership                                                           */
/* ------------------------------------------------------------------ */

export type WorkOrderReassignment = {
  patch: { assigned_to: string };
  event: "reassigned";
  body: string;
  detail: { from: string | null; to: string; actor: string | null };
};

/**
 * A supervisor moving internal ownership of a Work Order — who inside
 * Resolve is on the hook for getting it done — to someone else. This is
 * deliberately narrow: `patch` can only ever carry `assigned_to`, so a
 * reassignment can never touch `vendor_name` or any other field, however
 * the caller assembles it. The internal owner is not the vendor, and
 * reassigning the former must never imply anything about the latter —
 * `vendor_name`/vendor contact stays exactly what it was, and a future
 * vendor-delivery recipient (PDF/email/share, not built yet) is a
 * separate concept this never touches or assumes.
 */
export function workOrderReassignment(input: {
  fromOwnerId: string | null;
  toUserId: string;
  toUserName: string;
  actorId: string | null;
}): WorkOrderReassignment {
  return {
    patch: { assigned_to: input.toUserId },
    event: "reassigned",
    body: input.fromOwnerId
      ? `Reassigned to ${input.toUserName}`
      : `Assigned to ${input.toUserName}`,
    detail: { from: input.fromOwnerId, to: input.toUserId, actor: input.actorId },
  };
}

/* ------------------------------------------------------------------ */
/* Owner approval                                                      */
/* ------------------------------------------------------------------ */

/**
 * The owner approval request Resolve sends into the existing approvals
 * architecture. There is no second approval system: `approvals` stays the
 * record, and the Work Order keeps the mirror of the decision.
 */
export const OWNER_APPROVAL_KIND = "maintenance_owner_approval";

/** The same approvals architecture, asked of a supervisor instead of the owner. */
export const SUPERVISOR_APPROVAL_KIND = "maintenance_supervisor_approval";

/** The supervisor request for the $200–$350 band. */
export function supervisorApprovalRequest(
  wo: WorkOrderLike & {
    id?: string;
    title?: string | null;
    scope?: string | null;
    property_id?: string | null;
    ticket_id?: string | null;
    service_category?: string | null;
  },
) {
  const verdict = evaluateAuthority({ ...wo, phase: "permanent" });
  return {
    kind: SUPERVISOR_APPROVAL_KIND,
    title: `Supervisor approval — ${wo.title ?? "maintenance repair"}`,
    amount: num(wo.quote_amount),
    detail: {
      work_order_id: wo.id ?? null,
      ticket_id: wo.ticket_id ?? null,
      property_id: wo.property_id ?? null,
      scope: wo.scope ?? null,
      vendor: wo.vendor_name ?? null,
      quote_amount: num(wo.quote_amount),
      authority_reason: verdict.reason,
      owner_fyi_required: verdict.ownerFyiRequired,
      policy_version: MAINTENANCE_POLICY_VERSION,
    },
  };
}

export type OwnerApprovalOutcome = "approved" | "declined" | "info_requested";

export const OWNER_APPROVAL_OUTCOME_LABELS: Record<OwnerApprovalOutcome, string> = {
  approved: "Owner approved",
  declined: "Owner declined",
  info_requested: "Owner asked for more information",
};

/** Explicitly authored owner copy; never default to internal title or scope. */
export function ownerApprovalText(summary: string) {
  const detail = summary.trim();
  if (detail.length < 20 || detail.length > 4000) {
    throw new Error("Explain the repair and proposed work for the owner in 20–4,000 characters.");
  }
  return { title: "Owner approval — property repair", detail };
}

/** Internal authority/evidence snapshot. Narrative fields are staff-only. */
export function ownerApprovalRequest(
  wo: WorkOrderLike & {
    id?: string;
    title?: string | null;
    scope?: string | null;
    property_id?: string | null;
    ticket_id?: string | null;
    service_category?: string | null;
  },
) {
  const verdict = evaluateAuthority({ ...wo, phase: "permanent" });
  const mitigationDone = Boolean(wo.temporary_mitigation || wo.emergency_reason);
  return {
    kind: OWNER_APPROVAL_KIND,
    title: `Owner approval — ${wo.title ?? "maintenance repair"}`,
    amount: num(wo.quote_amount),
    detail: {
      work_order_id: wo.id ?? null,
      ticket_id: wo.ticket_id ?? null,
      property_id: wo.property_id ?? null,
      scope: wo.scope ?? null,
      service_category: wo.service_category ?? null,
      vendor: wo.vendor_name ?? null,
      quote_amount: num(wo.quote_amount),
      second_quote_amount: num(wo.second_quote_amount),
      emergency_mitigation_performed: mitigationDone,
      emergency_reason: wo.emergency_reason ?? null,
      temporary_mitigation: wo.temporary_mitigation ?? null,
      warranty_may_apply: Boolean(wo.warranty_may_apply),
      warranty_kind: (wo as { warranty_kind?: string | null }).warranty_kind ?? null,
      warranty_override_reason: wo.warranty_override_reason ?? null,
      authority_reason: verdict.reason,
      policy_version: MAINTENANCE_POLICY_VERSION,
    },
  };
}

/**
 * A declined owner approval never quietly ends the operational problem. This
 * is the sentence Resolve shows so the consequence stays visible.
 */
export function declineConsequence(wo: WorkOrderLike): string | null {
  if (wo.approval_status !== "declined") return null;
  if (wo.occupied_now) {
    return "Owner declined the permanent repair — a guest is in the home and the impact is unresolved. Decide the alternative: temporary mitigation, guest refund or credit, or leadership follow-up.";
  }
  if (wo.permanent_repair_needed) {
    return "Owner declined the permanent repair — the home still has an open defect. Record the alternative solution or escalate to leadership.";
  }
  return "Owner declined — record what happens instead before this Work Order is closed.";
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

export type WorkOrderEvidenceSlot = {
  key: string;
  label: string;
  kind: string;
  required: boolean;
  instruction: string;
};

/**
 * Work Order evidence reuses the shared evidence architecture. Linked Claims
 * and Guest refunds & credits reference these same items rather than re-uploading.
 */
export function workOrderEvidenceSlots(
  phase: WorkOrderPhase,
  warrantyMayApply = false,
): WorkOrderEvidenceSlot[] {
  const slots: WorkOrderEvidenceSlot[] = [
    {
      key: "diagnostic_photos",
      label: "Diagnostic photos",
      kind: "photo",
      required: true,
      instruction: "What the problem looked like before anyone worked on it.",
    },
    {
      key: "completion_photos",
      label: "Completion photos",
      kind: "photo",
      required: true,
      instruction: "The finished work, from the same angle where possible.",
    },
    {
      key: "vendor_report",
      label: "Vendor report",
      kind: "general",
      required: false,
      instruction: "What the vendor found and did, in their words.",
    },
    {
      key: "invoice",
      label: "Invoice or receipt",
      kind: "general",
      required: true,
      instruction: "The amount actually paid — this is the final cost of record.",
    },
  ];

  if (phase === "permanent") {
    slots.splice(1, 0, {
      key: "vendor_quote",
      label: "Vendor quote",
      kind: "general",
      required: false,
      instruction: "The written estimate the approval decision was made on.",
    });
  }
  if (warrantyMayApply) {
    slots.push({
      key: "warranty_correspondence",
      label: "Warranty correspondence",
      kind: "general",
      required: false,
      instruction: "What the warranty provider said — coverage, appointment or refusal.",
    });
  }
  return slots;
}

/* ------------------------------------------------------------------ */
/* Queue views                                                         */
/* ------------------------------------------------------------------ */

/** The default order of the queue: action first, completed work last. */
export const BUCKET_ORDER: WorkOrderBucket[] = [
  "needs_action",
  "waiting_quote",
  "waiting_owner",
  "warranty_pending",
  "waiting_vendor",
  "evidence_missing",
  "permanent_pending",
  "closed",
];

const PRIORITY_RANK: Record<string, number> = { p1: 0, p2: 1, p3: 2 };

/** Most urgent first, then the oldest work. */
export function workOrderSort(
  a: WorkOrderLike & { created_at?: string | null },
  b: WorkOrderLike & { created_at?: string | null },
) {
  const pa = PRIORITY_RANK[normalisePriority(a.priority)] ?? 2;
  const pb = PRIORITY_RANK[normalisePriority(b.priority)] ?? 2;
  if (pa !== pb) return pa - pb;
  return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
}

export function isOpenWorkOrder(wo: WorkOrderLike) {
  return !wo.closed_at;
}

/** Closed inside the window — visible, but never crowding out live work. */
export function recentlyCompleted(
  wo: WorkOrderLike & { closed_at?: string | null },
  days = 30,
  now = new Date(),
) {
  if (!wo.closed_at) return false;
  const closed = new Date(wo.closed_at).getTime();
  return Number.isFinite(closed) && now.getTime() - closed <= days * 86400000;
}

/* ------------------------------------------------------------------ */
/* Manager oversight                                                   */
/* ------------------------------------------------------------------ */

/**
 * Operational oversight, not analytics: each filter is a list of jobs a
 * supervisor may need to act on today.
 */
export const MANAGER_FILTER_LABELS = {
  owner_approval_pending: "Owner approval outstanding",
  owner_declined: "Owner declined",
  missed_commitments: "Vendor missed a commitment",
  mitigated_not_repaired: "Mitigated, not permanently repaired",
  warranty_open: "Warranty route open",
  evidence_missing: "Work done, record incomplete",
} as const;

export type WorkOrderManagerFilter = keyof typeof MANAGER_FILTER_LABELS;

export function matchesManagerFilter(
  wo: WorkOrderLike & { closed_at?: string | null },
  filter: WorkOrderManagerFilter,
  now = new Date(),
): boolean {
  if (wo.closed_at) return false;
  switch (filter) {
    case "owner_approval_pending":
      // Outstanding means "the owner has not decided yet" — including the
      // repair that needs their decision but was never sent to them.
      return (
        wo.approval_status === "pending" ||
        (wo.approval_status === "not_required" && evaluateAuthority(wo).ownerApprovalRequired)
      );
    case "owner_declined":
      return wo.approval_status === "declined";
    case "missed_commitments":
      return Boolean(commitmentStatus(wo, now).action) || (wo.missed_commitments ?? 0) > 0;
    case "mitigated_not_repaired":
      return wo.phase === "mitigation" && Boolean(wo.permanent_repair_needed);
    case "warranty_open":
      return Boolean(wo.warranty_may_apply) && !wo.warranty_override_reason;
    case "evidence_missing":
      return Boolean(wo.vendor_completed_at) && !wo.evidence_complete;
    default:
      return false;
  }
}

/** Homes with more than one work order inside the window. */
export function repeatMaintenanceProperties(
  rows: Array<{ property_id?: string | null; created_at?: string | null }>,
  days = 90,
  now = new Date(),
): Array<{ property_id: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.property_id) continue;
    const created = new Date(row.created_at ?? 0).getTime();
    if (!Number.isFinite(created) || now.getTime() - created > days * 86400000) continue;
    counts.set(row.property_id, (counts.get(row.property_id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([property_id, count]) => ({ property_id, count }))
    .sort((a, b) => b.count - a.count);
}
