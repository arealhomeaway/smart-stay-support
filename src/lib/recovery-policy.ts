/**
 * ARHA Operations Policy Thresholds for Resolve — v1.
 *
 * Every dollar threshold, escalation trigger and communication interval used
 * by Guest refunds & credits lives here. Routes, components and server code read these
 * values; none of them restate a number. When leadership changes a threshold,
 * this file changes and history keeps the version it was decided under.
 */

export const POLICY_VERSION = "ARHA Operations Policy Thresholds for Resolve — v1";

export type Priority = "p1" | "p2" | "p3";

export const RECOVERY_POLICY = {
  version: POLICY_VERSION,

  /** A Property Coordinator may approve courtesy items and small recovery expenses up to this. */
  pcCourtesyCeiling: 50,
  /** James (Operations Supervisor) may approve refunds and credits up to this. */
  supervisorRefundCeiling: 500,
  /** Above this, James must document the reason for the decision. */
  supervisorDocumentationThreshold: 300,

  /** First guest acknowledgment, in minutes, by priority. */
  acknowledgeMinutes: { p1: 3, p2: 10, p3: 30 } as Record<Priority, number>,
  /** Ongoing update cadence while the stay is active and unresolved. */
  updateIntervalMinutes: { p1: 30, p2: 60, p3: 120 } as Record<Priority, number>,

  /** A P1 that nobody has accepted after this long goes to James. */
  p1UnacceptedMinutes: 3,
  /** A P2 without a credible action plan after this long goes to James. */
  p2NoPlanMinutes: 30,
  /** An active-stay issue materially unresolved for this long goes to James. */
  unresolvedActiveStayMinutes: 120,
  /** Vendor commitments missed before James is involved. */
  vendorMissedCommitments: 2,
} as const;

/* ------------------------------------------------------------------ */
/* Escalation triggers                                                 */
/* ------------------------------------------------------------------ */

/** Conditions that require Director (Micah) review regardless of dollar amount. */
export type EscalationFlag =
  | "outside_policy"
  | "multi_night_refund"
  | "relocation"
  | "legal_threat"
  | "chargeback_threat"
  | "safety_allegation"
  | "discrimination_allegation"
  | "emergency_services"
  | "insurance_exposure"
  | "property_damage"
  | "owner_dispute"
  | "policy_exception"
  | "reputational_risk"
  | "supervisor_uncertain";

export const ESCALATION_FLAG_LABELS: Record<EscalationFlag, string> = {
  outside_policy: "Outside standard Airbnb refund/discount policy",
  multi_night_refund: "Multi-night or full-stay refund",
  relocation: "Meaningful relocation expense",
  legal_threat: "Legal threat",
  chargeback_threat: "Material chargeback threat",
  safety_allegation: "Safety allegation",
  discrimination_allegation: "Discrimination or harassment allegation",
  emergency_services: "Police, fire or EMS involvement",
  insurance_exposure: "Possible insurance claim",
  property_damage: "Significant property damage",
  owner_dispute: "Major owner dispute",
  policy_exception: "Policy exception",
  reputational_risk: "Material reputational exposure",
  supervisor_uncertain: "Supervisor is not confident of the correct decision",
};

/** The sentence Resolve shows when the flag forces Director review. */
export const ESCALATION_FLAG_REASONS: Record<EscalationFlag, string> = {
  outside_policy: "proposed resolution is outside standard Airbnb policy",
  multi_night_refund: "multi-night refund requested",
  relocation: "relocation expense is involved",
  legal_threat: "the guest has raised a legal threat",
  chargeback_threat: "there is a material chargeback threat",
  safety_allegation: "a safety allegation has been made",
  discrimination_allegation: "a discrimination or harassment allegation has been made",
  emergency_services: "police, fire or EMS were involved",
  insurance_exposure: "there is possible insurance exposure",
  property_damage: "there is significant property damage",
  owner_dispute: "there is a major owner dispute",
  policy_exception: "this is a policy exception",
  reputational_risk: "there is material reputational exposure",
  supervisor_uncertain: "the supervisor is not confident of the correct decision",
};

export const ESCALATION_FLAGS = Object.keys(ESCALATION_FLAG_LABELS) as EscalationFlag[];

export function isEscalationFlag(value: string): value is EscalationFlag {
  return (ESCALATION_FLAGS as string[]).includes(value);
}

/* ------------------------------------------------------------------ */
/* PC -> James escalation triggers                                     */
/* ------------------------------------------------------------------ */

export type SupervisorTrigger =
  | "p1_unaccepted"
  | "p2_no_plan"
  | "guest_asked_supervisor"
  | "resolution_attempt_failed"
  | "monetary_beyond_pc"
  | "vendor_missed_commitments"
  | "unresolved_two_hours"
  | "no_sop"
  | "conflicting_information"
  | "hostile_conversation"
  | "missing_closure_evidence"
  | "reopened_issue";

export const SUPERVISOR_TRIGGER_REASONS: Record<SupervisorTrigger, string> = {
  p1_unaccepted: `Supervisor escalation required — a P1 has not been accepted within ${RECOVERY_POLICY.p1UnacceptedMinutes} minutes.`,
  p2_no_plan: `Supervisor escalation required — a P2 has no credible action plan after ${RECOVERY_POLICY.p2NoPlanMinutes} minutes.`,
  guest_asked_supervisor: "Supervisor escalation required — the guest has asked for a supervisor.",
  resolution_attempt_failed:
    "Supervisor escalation required because the guest remains dissatisfied after one reasonable resolution attempt.",
  monetary_beyond_pc: `Supervisor escalation required — the guest is asking for compensation above the $${RECOVERY_POLICY.pcCourtesyCeiling} coordinator limit.`,
  vendor_missed_commitments: `Supervisor escalation required — the vendor has missed ${RECOVERY_POLICY.vendorMissedCommitments} commitments.`,
  unresolved_two_hours:
    "Supervisor escalation required — an active-stay issue has been materially unresolved for over 2 hours.",
  no_sop: "Supervisor escalation required — no clear SOP applies to this situation.",
  conflicting_information:
    "Supervisor escalation required — guest, vendor and team information conflict.",
  hostile_conversation:
    "Supervisor escalation required — the guest conversation has become significantly hostile.",
  missing_closure_evidence:
    "Supervisor escalation required — required closure evidence is missing.",
  reopened_issue: "Supervisor escalation required — a previously resolved issue has reopened.",
};

/* ------------------------------------------------------------------ */
/* Guest communication SLA                                             */
/* ------------------------------------------------------------------ */

export type CommunicationInput = {
  priority?: Priority | string | null;
  /** Recovery opened / issue reported. */
  created_at?: string | null;
  last_guest_update_at?: string | null;
  /** A specific time staff promised the guest — always wins when sooner. */
  promised_update_at?: string | null;
  stay_departure?: string | null;
  stay_arrival?: string | null;
};

export function normalisePriority(value: string | null | undefined): Priority {
  return value === "p1" || value === "p2" ? value : "p3";
}

/**
 * When the guest is next owed an update. A promised time always becomes the
 * checkpoint; otherwise the priority cadence applies from the last update, or
 * the acknowledgment window from when the issue was reported.
 */
export function nextGuestUpdateDue(input: CommunicationInput): Date | null {
  const priority = normalisePriority(input.priority ?? null);
  const promised = parseTime(input.promised_update_at);
  const last = parseTime(input.last_guest_update_at);
  const created = parseTime(input.created_at);

  let due: Date | null = null;
  if (last) {
    due = addMinutes(last, RECOVERY_POLICY.updateIntervalMinutes[priority]);
  } else if (created) {
    due = addMinutes(created, RECOVERY_POLICY.acknowledgeMinutes[priority]);
  }

  if (promised && (!due || promised < due)) due = promised;
  return due;
}

export function communicationOverdue(input: CommunicationInput, now = new Date()): boolean {
  const due = nextGuestUpdateDue(input);
  return !!due && due.getTime() <= now.getTime();
}

export function parseTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function minutesSince(value: string | null | undefined, now = new Date()): number | null {
  const d = parseTime(value);
  if (!d) return null;
  return Math.floor((now.getTime() - d.getTime()) / 60_000);
}
