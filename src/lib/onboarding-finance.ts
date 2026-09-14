/**
 * Money, utilities and permanent-fact review for an onboarding home.
 *
 * Browser-safe: pure shapes and derivations only. Every dollar rule is read
 * from the maintenance authority policy — nothing is restated here.
 */

import { authorityTier, money, type AuthorityTier } from "./maintenance-policy";

/* ------------------------------------------------------------------ */
/* Financial requests                                                  */
/* ------------------------------------------------------------------ */

export type FinancialStatus =
  | "estimate"
  | "awaiting_approval"
  | "approved"
  | "declined"
  | "invoiced"
  | "sent_to_accounting"
  | "settled"
  | "cancelled";

export const FINANCIAL_STATUS_LABELS: Record<FinancialStatus, string> = {
  estimate: "Estimate",
  awaiting_approval: "Waiting on approval",
  approved: "Approved",
  declined: "Declined",
  invoiced: "Invoiced",
  sent_to_accounting: "With accounting",
  settled: "Settled",
  cancelled: "Cancelled",
};

export const FINANCIAL_KINDS = [
  { value: "repair", label: "Repair" },
  { value: "make_ready", label: "Make-ready" },
  { value: "furnishing", label: "Furnishing" },
  { value: "utility", label: "Utility" },
  { value: "inspection", label: "Inspection" },
  { value: "other", label: "Other" },
] as const;

export type FinancialRequest = {
  id: string;
  property_id: string;
  project_id: string | null;
  task_id: string | null;
  kind: string;
  title: string;
  vendor: string | null;
  description: string | null;
  estimate_amount: number | null;
  authority_tier: string;
  emergency: boolean;
  emergency_reason: string | null;
  approval_id: string | null;
  approved_amount: number | null;
  approved_at: string | null;
  actual_amount?: number | null;
  invoice_amount: number | null;
  invoice_ref: string | null;
  invoice_at: string | null;
  variance_note: string | null;
  accounting_recipient: string | null;
  accounting_sent_at: string | null;
  settled_at: string | null;
  settlement_note: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
};

export function financialStatus(row: Pick<FinancialRequest, "status">): FinancialStatus {
  const value = row.status as FinancialStatus;
  return value in FINANCIAL_STATUS_LABELS ? value : "estimate";
}

/** Tier a request falls into, from its estimate and emergency flag. */
export function tierFor(
  row: Pick<FinancialRequest, "estimate_amount" | "emergency">,
): AuthorityTier {
  return authorityTier(row.estimate_amount, { emergency: row.emergency });
}

/** Invoice minus what was approved. Positive means it came in over. */
export function variance(
  row: Pick<FinancialRequest, "approved_amount" | "estimate_amount" | "invoice_amount">,
) {
  if (row.invoice_amount == null) return null;
  const baseline = row.approved_amount ?? row.estimate_amount ?? 0;
  return Number(row.invoice_amount) - Number(baseline);
}

/** A variance worth a human explanation: over baseline by more than 10%. */
export function varianceNeedsNote(row: Parameters<typeof variance>[0]) {
  const v = variance(row);
  if (v == null || v <= 0) return false;
  const baseline = Number(row.approved_amount ?? row.estimate_amount ?? 0);
  if (baseline <= 0) return v > 0;
  return v / baseline > 0.1;
}

export function varianceLabel(row: Parameters<typeof variance>[0]) {
  const v = variance(row);
  if (v == null) return null;
  if (Math.abs(v) < 0.005) return "On estimate";
  return v > 0 ? `${money(v)} over` : `${money(Math.abs(v))} under`;
}

/** The one thing this request is waiting for, in plain language. */
export function financialNextAction(row: FinancialRequest): string {
  const status = financialStatus(row);
  const tier = tierFor(row);
  switch (status) {
    case "estimate":
      if (tier === "supervisor") return "Send to a supervisor for approval.";
      if (tier === "owner") return "Send to the homeowner for approval.";
      if (tier === "emergency") return "Record the emergency exception, then add the invoice.";
      return "No approval needed — add the invoice when it arrives.";
    case "awaiting_approval":
      return tier === "owner"
        ? "Waiting on the homeowner's decision."
        : "Waiting on supervisor approval.";
    case "approved":
      return "Add the invoice when it arrives.";
    case "declined":
      return "Declined — close it out or revise the estimate.";
    case "invoiced":
      return varianceNeedsNote(row) && !row.variance_note
        ? "Explain the difference from the approved amount, then send to accounting."
        : "Send to accounting.";
    case "sent_to_accounting":
      return "Waiting on accounting to settle.";
    case "settled":
      return "Settled.";
    case "cancelled":
      return "Cancelled.";
  }
}

/** Requests that still need someone. Used for handoff and Director views. */
export function openFinancials(rows: FinancialRequest[]) {
  return rows.filter((r) => {
    const s = financialStatus(r);
    return s !== "settled" && s !== "cancelled" && s !== "declined";
  });
}

export function financialTotals(rows: FinancialRequest[]) {
  const open = openFinancials(rows);
  return {
    count: rows.length,
    openCount: open.length,
    estimated: rows.reduce((sum, r) => sum + Number(r.estimate_amount ?? 0), 0),
    invoiced: rows.reduce((sum, r) => sum + Number(r.invoice_amount ?? 0), 0),
    awaitingApproval: rows.filter((r) => financialStatus(r) === "awaiting_approval").length,
    withAccounting: rows.filter((r) => financialStatus(r) === "sent_to_accounting").length,
  };
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

export const UTILITY_TYPES = [
  { value: "electric", label: "Electric" },
  { value: "gas", label: "Gas" },
  { value: "water_sewer", label: "Water / sewer" },
  { value: "trash", label: "Trash" },
  { value: "internet", label: "Internet" },
  { value: "tv_streaming", label: "TV / streaming" },
  { value: "lawn", label: "Lawn" },
  { value: "pest", label: "Pest control" },
  { value: "pool", label: "Pool service" },
  { value: "hoa", label: "HOA" },
  { value: "other", label: "Other" },
] as const;

export type UtilityStatus = "needed" | "requested" | "pending_transfer" | "active" | "closed";

export const UTILITY_STATUS_LABELS: Record<UtilityStatus, string> = {
  needed: "Not set up",
  requested: "Requested",
  pending_transfer: "Transfer in progress",
  active: "Active",
  closed: "Closed",
};

export type UtilityAccount = {
  id: string;
  property_id: string;
  utility_type: string;
  provider: string;
  account_label: string;
  credential_id: string | null;
  status: string;
  responsible: string;
  service_start_on: string | null;
  notes: string | null;
  is_demo: boolean;
};

export type UtilityCost = {
  id: string;
  account_id: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  invoice_ref: string | null;
  paid_on: string | null;
};

export function utilityLabel(type: string) {
  return UTILITY_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function utilityStatusLabel(status: string) {
  return UTILITY_STATUS_LABELS[status as UtilityStatus] ?? status;
}

/** Utilities that would block a clean handoff: not yet on at the home. */
export function utilitiesNotReady(rows: UtilityAccount[]) {
  return rows.filter(
    (r) => r.responsible === "arha" && r.status !== "active" && r.status !== "closed",
  );
}

export function utilitySpend(costs: UtilityCost[]) {
  return costs.reduce((sum, c) => sum + Number(c.amount ?? 0), 0);
}

/* ------------------------------------------------------------------ */
/* Permanent fact review                                               */
/* ------------------------------------------------------------------ */

export const FACT_FIELDS: Record<string, string> = {
  wifi_notes: "Wi-Fi notes",
  access_notes: "Access notes",
  address_line1: "Street address",
  city: "City",
  state: "State",
  postal_code: "Postal code",
  nickname: "Nickname",
};

export type FactProposal = {
  id: string;
  property_id: string;
  field_key: string;
  field_label: string;
  current_value: string | null;
  proposed_value: string;
  source: string;
  source_detail: string | null;
  status: string;
  decision_note: string | null;
  reviewed_at: string | null;
  reviewed_by?: string | null;
  created_at: string;
};

/** Compare the captured prior value with the live value, without hiding whitespace changes. */
export function isStaleFact(row: FactProposal, currentValue: string | null) {
  return row.current_value !== currentValue;
}

export function pendingFacts(rows: FactProposal[]) {
  return rows.filter((r) => r.status === "pending");
}

/** True when the proposal would change a value that already exists. */
export function isConflict(row: FactProposal) {
  const current = (row.current_value ?? "").trim();
  return current.length > 0 && current !== row.proposed_value.trim();
}

export function factSummary(row: FactProposal) {
  return isConflict(row)
    ? `Resolve has "${row.current_value}" — the field says "${row.proposed_value}".`
    : `Nothing recorded yet — the field says "${row.proposed_value}".`;
}
