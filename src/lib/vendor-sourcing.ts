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

export type TelegramStatus = "unknown" | "yes" | "no";
export type VendorChannelInfo = { breezeway: boolean; telegram: boolean; telegramStatus: TelegramStatus };
/** Telegram is unknown until staff confirm it — a default "off" never means the vendor doesn't use it. */
export function vendorChannels(v: { dispatch_method?: string | null; breezeway_person_id?: unknown; telegram_status?: string | null } | null | undefined): VendorChannelInfo {
  const telegramStatus: TelegramStatus = v?.telegram_status === "yes" || v?.telegram_status === "no" ? v.telegram_status : "unknown";
  return {
    breezeway: !!v && (v.dispatch_method === "breezeway" || v.breezeway_person_id != null),
    telegram: telegramStatus === "yes",
    telegramStatus,
  };
}
export const TELEGRAM_STATUS_LABELS: Record<TelegramStatus, string> = {
  unknown: "Telegram: not confirmed", yes: "Telegram", no: "No Telegram",
};

export type DispatchWorkOrder = WorkOrderLike & {
  scope?: string | null;
  authorized_scope?: string | null;
  authorized_amount?: number | string | null;
  authorization_stale?: boolean | null;
  authorized_vendor_org_id?: string | null;
  vendor_org_id?: string | null;
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
  const vendorChanged = !!wo.authorized_vendor_org_id && wo.vendor_org_id !== wo.authorized_vendor_org_id;
  const label = stale
    ? vendorChanged
      ? "Approval was for a different vendor — request approval for the replacement vendor"
      : "Approval no longer covers this scope or amount — request again"
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
  if (input.handoffStatus === "uncertain") reasons.push("The last attempt is uncertain — reconcile it with Breezeway before another create.");
  return { allowed: reasons.length === 0, reasons };
}

export const HANDOFF_LABELS: Record<string, string> = {
  not_sent: "Not sent", sent: "Sent to Breezeway", simulated: "Demo handoff (simulated — nothing sent)",
  failed: "Handoff not created — safe to retry", uncertain: "Handoff uncertain — reconcile with Breezeway before retrying",
};

export type HandoffStatus = "not_sent" | "sent" | "failed" | "uncertain" | "simulated";
/**
 * Classify one Breezeway create attempt. Breezeway offers no verified
 * duplicate-safe retry, so anything short of a definite answer is "uncertain"
 * and blocks another create until someone reconciles it.
 *  - ok → sent
 *  - no outbound record was written → nothing reached Breezeway → failed
 *  - a definite refusal (retryable) → failed
 *  - anything else (timeout, 5xx, created-but-id-not-saved, still creating) → uncertain
 */
export function handoffStatusFromResult(res: { ok: boolean; link?: unknown; retryable?: boolean } | null): Exclude<HandoffStatus, "not_sent" | "simulated"> {
  if (!res) return "uncertain";
  if (res.ok) return "sent";
  if (!res.link) return "failed";
  return res.retryable ? "failed" : "uncertain";
}
/** Can another create attempt start? Never while uncertain or already sent. */
export function canAttemptHandoff(status: string): boolean {
  return status === "not_sent" || status === "failed";
}
/** One request key per attempt; a new key only after a definite "not created". */
export function handoffRequestKey(workOrderId: string, priorKey: string | null | undefined, status: string): string {
  const base = `work_order:${workOrderId}`;
  if (!priorKey || status !== "failed") return priorKey ?? base;
  const m = /:attempt-(\d+)$/.exec(priorKey);
  return `${base}:attempt-${m ? Number(m[1]) + 1 : 2}`;
}

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

export type CreateResult = { ok: boolean; link?: { breezewayTaskId?: number | null } | null; retryable?: boolean; message?: string };
/**
 * One Breezeway handoff attempt. The "uncertain" intent is saved BEFORE the
 * external call, so a timeout, crash or lost save after Breezeway created the
 * task leaves the Work Order uncertain — never "not sent" — and blocks a second create.
 */
export async function runHandoffAttempt(deps: {
  workOrderId: string;
  status: string;
  priorKey: string | null;
  save: (patch: { breezeway_handoff_status: HandoffStatus; breezeway_request_key?: string; breezeway_task_ref?: string | null; breezeway_handoff_error?: string | null }) => Promise<void>;
  create: (requestKey: string) => Promise<CreateResult>;
}): Promise<{ status: HandoffStatus; ref: string | null; message: string; created: boolean }> {
  if (!canAttemptHandoff(deps.status)) {
    return { status: deps.status as HandoffStatus, ref: null, created: false,
      message: deps.status === "uncertain" ? "The last attempt is uncertain. Reconcile it with Breezeway before another create." : "Already handed off — no second task created." };
  }
  const requestKey = handoffRequestKey(deps.workOrderId, deps.priorKey, deps.status);
  await deps.save({ breezeway_handoff_status: "uncertain", breezeway_request_key: requestKey, breezeway_handoff_error: "Handoff in progress — if this stays, check Breezeway before retrying." });
  let res: CreateResult | null = null;
  try { res = await deps.create(requestKey); } catch { res = null; }
  const status = handoffStatusFromResult(res);
  const id = res?.link?.breezewayTaskId;
  const ref = id != null ? String(id) : null;
  await deps.save({
    breezeway_handoff_status: status,
    ...(ref ? { breezeway_task_ref: ref } : {}),
    breezeway_handoff_error: status === "sent" ? null : (res?.message ?? "Breezeway did not respond. The task may exist — reconcile before retrying."),
  });
  return { status, ref, created: true, message: status === "sent" ? "Sent to Breezeway." : status === "failed" ? (res?.message ?? "Not created.") : "Uncertain — reconcile with Breezeway before another create." };
}
