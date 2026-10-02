/**
 * Vendor sourcing, dispatch and visit rules (pure, one place).
 * Acceptance, spending authorization, dispatch and completion are separate facts.
 * Authorization reuses `evaluateAuthority` — the Maintenance Authority Policy is unchanged.
 */
import { evaluateAuthority, type WorkOrderLike } from "./work-orders";

export const CONTACT_CHANNELS = ["phone", "text", "email", "breezeway", "telegram", "other"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];
export const CONTACT_CHANNEL_LABELS: Record<ContactChannel, string> = {
  phone: "Phone call", text: "Text", email: "Email", breezeway: "Breezeway", telegram: "Telegram", other: "Other",
};

/** Contact responses. "Accepted" is deliberately absent — acceptance is recorded separately. */
export const CONTACT_RESPONSES = ["no_answer", "left_message", "call_back", "interested", "declined"] as const;
export type ContactResponse = (typeof CONTACT_RESPONSES)[number];
export const CONTACT_RESPONSE_LABELS: Record<ContactResponse, string> = {
  no_answer: "No answer", left_message: "Left a message", call_back: "Will call back",
  interested: "Interested — not yet accepted", declined: "Declined",
};

export const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  candidate: "Not contacted yet", contacted: "Contacted", declined: "Declined", accepted: "Accepted the work", withdrawn: "Withdrawn",
};

export const VISIT_OUTCOMES = [
  "resolved", "diagnosed_only", "no_issue_found", "parts_needed",
  "follow_up_visit", "owner_decision", "unable_to_access", "unable_to_complete",
] as const;
export type VisitOutcome = (typeof VISIT_OUTCOMES)[number];
export const VISIT_OUTCOME_LABELS: Record<VisitOutcome, string> = {
  resolved: "Resolved",
  diagnosed_only: "Diagnosed only, repair pending",
  no_issue_found: "No issue found",
  parts_needed: "Parts needed",
  follow_up_visit: "Follow-up visit required",
  owner_decision: "Owner decision required",
  unable_to_access: "Unable to access",
  unable_to_complete: "Unable to complete",
};

/** Outcomes that leave work open and need a follow-up Task with an assignee and due date. */
export function visitNeedsFollowUp(outcome: VisitOutcome): boolean {
  return outcome !== "resolved" && outcome !== "no_issue_found";
}

export type VendorChannelInfo = { breezeway: boolean; telegram: boolean };
export function vendorChannels(v: { dispatch_method?: string | null; breezeway_person_id?: unknown; uses_telegram?: boolean | null } | null | undefined): VendorChannelInfo {
  return {
    breezeway: !!v && (v.dispatch_method === "breezeway" || v.breezeway_person_id != null),
    telegram: !!v?.uses_telegram,
  };
}

export type DispatchWorkOrder = WorkOrderLike & {
  scope?: string | null;
  authorized_scope?: string | null;
  authorized_amount?: number | string | null;
  authorization_stale?: boolean | null;
  dispatched_at?: string | null;
};

export type AuthorizationState = {
  required: boolean;
  who: "owner" | "supervisor" | null;
  satisfied: boolean;
  stale: boolean;
  label: string;
  reason: string;
};

/** Spending authorization for this work order, via the unchanged authority ladder. */
export function authorizationState(wo: DispatchWorkOrder): AuthorizationState {
  const v = evaluateAuthority(wo);
  const who = v.ownerApprovalRequired ? "owner" : v.supervisorApprovalRequired ? "supervisor" : null;
  const stale = !!wo.authorization_stale;
  const approved = who === "owner" ? wo.approval_status === "approved" : who === "supervisor" ? wo.supervisor_approval_status === "approved" : true;
  const satisfied = who === null ? true : approved && !stale;
  const label = stale
    ? "Approval no longer covers this scope or amount — request again"
    : who === null ? "No approval required"
    : satisfied ? (who === "owner" ? "Owner approved" : "Supervisor approved")
    : who === "owner" ? "Waiting on owner approval" : "Waiting on supervisor approval";
  return { required: who !== null, who, satisfied, stale, label, reason: v.reason };
}

export type FourFacts = { accepted: boolean; authorized: boolean; dispatched: boolean; completed: boolean };
export function fourFacts(wo: DispatchWorkOrder, hasAcceptedVendor: boolean): FourFacts {
  return {
    accepted: hasAcceptedVendor,
    authorized: authorizationState(wo).satisfied,
    dispatched: !!wo.dispatched_at,
    completed: !!wo.vendor_completed_at,
  };
}

export type PushEligibility = { allowed: boolean; reasons: string[] };
/** "Push to Breezeway" only after vendor acceptance and a current authorization. */
export function breezewayPushEligibility(input: {
  wo: DispatchWorkOrder; hasAcceptedVendor: boolean; vendorUsesBreezeway: boolean; handoffStatus: string;
}): PushEligibility {
  const reasons: string[] = [];
  if (!input.vendorUsesBreezeway) reasons.push("The accepted vendor does not use Breezeway — track the work here instead.");
  if (!input.hasAcceptedVendor) reasons.push("A vendor has not accepted the work yet.");
  const a = authorizationState(input.wo);
  if (!a.satisfied) reasons.push(a.label);
  if (input.handoffStatus === "sent" || input.handoffStatus === "simulated") reasons.push("Already handed off to Breezeway.");
  return { allowed: reasons.length === 0, reasons };
}

export const HANDOFF_LABELS: Record<string, string> = {
  not_sent: "Not sent", sent: "Sent to Breezeway", simulated: "Demo handoff (simulated — nothing sent)",
  failed: "Handoff failed", uncertain: "Handoff uncertain — check Breezeway before retrying",
};

/** Suspected duplicate invoice: same invoice number + payee, or same payee with near amount within 7 days. */
export function suspectedDuplicate(
  a: { payee: string | null; amount: number | null; expense_date: string | null; vendor_invoice_ref: string | null },
  b: { payee: string | null; amount: number | null; expense_date: string | null; vendor_invoice_ref: string | null },
): boolean {
  const same = (x: string | null, y: string | null) => (x ?? "").trim().toLowerCase() === (y ?? "").trim().toLowerCase();
  if (a.vendor_invoice_ref && b.vendor_invoice_ref && same(a.vendor_invoice_ref, b.vendor_invoice_ref) && same(a.payee, b.payee)) return true;
  if (!a.payee || !b.payee || !same(a.payee, b.payee) || a.amount == null || b.amount == null || !a.expense_date || !b.expense_date) return false;
  const days = Math.abs(Date.parse(a.expense_date) - Date.parse(b.expense_date)) / 86_400_000;
  return Math.abs(a.amount - b.amount) <= Math.max(1, a.amount * 0.01) && days <= 7;
}
