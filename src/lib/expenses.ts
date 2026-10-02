/**
 * Finance foundation — pure Expense rules (browser-safe, no data access).
 *
 * One Expense record per invoice/receipt. Amounts live only on the expense;
 * links to Tickets, Work Orders, Claims and Property Activities are context.
 * Operational completion, documentation readiness and Finance review are three
 * separate states. Documentation ready never means approved, payable or
 * statement ready. No cutoffs, SLAs or statement treatment are assumed here.
 */
import { MAINTENANCE_POLICY } from "@/lib/maintenance-policy";

export type ExpenseType = "vendor_service" | "purchase" | "other";
export type Responsibility = "owner" | "arha" | "guest" | "vendor" | "insurance" | "split" | "pending";
export type FinanceReview = "not_started" | "in_review" | "needs_clarification" | "reviewed" | "reopened";
export type ReservationLink = "not_relevant" | "linked" | "unresolved";
export type LinkType = "ticket" | "work_order" | "claim" | "property_activity";
export type SplitLine = { party: Exclude<Responsibility, "split" | "pending">; amount: number };

export const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  vendor_service: "Vendor service",
  purchase: "Purchase",
  other: "Other invoiced expense",
};

export const RESPONSIBILITY_LABEL: Record<Responsibility, string> = {
  owner: "Owner",
  arha: "ARHA",
  guest: "Guest",
  vendor: "Vendor",
  insurance: "Insurance",
  split: "Split",
  pending: "Pending",
};
export const RESPONSIBILITIES = Object.keys(RESPONSIBILITY_LABEL) as Responsibility[];
export const SPLIT_PARTIES: SplitLine["party"][] = ["owner", "arha", "guest", "vendor", "insurance"];

export const FINANCE_REVIEW_LABEL: Record<FinanceReview, string> = {
  not_started: "Not started",
  in_review: "In Finance review",
  needs_clarification: "Needs clarification",
  reviewed: "Finance reviewed",
  reopened: "Reopened — needs re-review",
};

export const RESERVATION_LINK_LABEL: Record<ReservationLink, string> = {
  not_relevant: "Not relevant",
  linked: "Linked",
  unresolved: "Needed — not yet linked",
};

export const LINK_LABEL: Record<LinkType, string> = {
  ticket: "Ticket",
  work_order: "Work Order",
  claim: "Claim",
  property_activity: "Property Activity",
};

export const QB_REFERENCE_NOTE = "Entered by hand — not synchronized with or verified in QuickBooks.";

export type ExpenseFacts = {
  expense_type: ExpenseType;
  property_id: string | null;
  payee: string | null;
  amount: number | null;
  expense_date: string | null;
  reason: string | null;
  dispatch_reason: string | null;
  visit_outcome: string | null;
  purchased_what: string | null;
  purchase_purpose: string | null;
  invoice_document_ids: string[];
  photo_document_ids: string[];
  photos_required: boolean;
  approval_id: string | null;
  authorization_note: string | null;
};

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;

/**
 * Authorization evidence is required only when the existing Maintenance
 * Authority Policy already requires owner approval. No new threshold.
 */
export function authorizationRequired(f: Pick<ExpenseFacts, "expense_type" | "amount">): boolean {
  return f.expense_type === "vendor_service" && (f.amount ?? 0) > MAINTENANCE_POLICY.ownerApprovalThreshold;
}

/** Exactly what is missing for documentation readiness (empty = ready). */
export function missingDocumentation(f: ExpenseFacts): string[] {
  const missing: string[] = [];
  if (f.invoice_document_ids.length === 0) missing.push("Invoice or itemized receipt");
  if (!f.property_id) missing.push("Property");
  if (!filled(f.payee)) missing.push("Payee");
  if (f.amount == null) missing.push("Amount");
  if (!f.expense_date) missing.push("Expense date");
  if (!filled(f.reason)) missing.push("Reason");
  if (f.expense_type === "vendor_service") {
    if (!filled(f.dispatch_reason)) missing.push("Dispatch reason");
    if (!filled(f.visit_outcome)) missing.push("Outcome of this visit");
  }
  if (f.expense_type === "purchase") {
    if (!filled(f.purchased_what)) missing.push("What was purchased");
    if (!filled(f.purchase_purpose)) missing.push("Purpose of the purchase");
  }
  if (authorizationRequired(f) && !f.approval_id && !filled(f.authorization_note))
    missing.push("Authorization evidence (required by the Maintenance Authority Policy)");
  if (f.photos_required && f.photo_document_ids.length === 0) missing.push("Photos (required by this workflow)");
  return missing;
}

export function docReadiness(f: ExpenseFacts): "ready" | "missing" {
  return missingDocumentation(f).length === 0 ? "ready" : "missing";
}

/** Split lines must use known parties and add up exactly to the total. */
export function splitReconciles(lines: SplitLine[], amount: number | null): boolean {
  if (amount == null || lines.length < 2) return false;
  if (lines.some((l) => !SPLIT_PARTIES.includes(l.party) || !(l.amount >= 0))) return false;
  const cents = lines.reduce((s, l) => s + Math.round(l.amount * 100), 0);
  return cents === Math.round(amount * 100);
}

/** Days since the expense was received (Chicago calendar day input). */
export function expenseAgeDays(receivedOn: string, today: string): number {
  const ms = Date.parse(today + "T00:00:00Z") - Date.parse(receivedOn + "T00:00:00Z");
  return Math.max(0, Math.round(ms / 86_400_000));
}

/** Totals by proposed statement period; unassigned periods are kept apart. */
export function totalsByPeriod(rows: { amount: number | null; proposed_statement_period: string | null }[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const key = r.proposed_statement_period ? r.proposed_statement_period.slice(0, 7) : "Not assigned";
    map.set(key, (map.get(key) ?? 0) + Math.round((r.amount ?? 0) * 100));
  }
  return [...map.entries()].map(([period, cents]) => ({ period, total: cents / 100 })).sort((a, b) => a.period.localeCompare(b.period));
}

export type RecoveryRow = { expected_amount: number; received_amount: number };
/** Expected recovery never reduces the original expense. */
export function recoverySummary(amount: number | null, rows: RecoveryRow[]) {
  const expected = rows.reduce((s, r) => s + Number(r.expected_amount), 0);
  const received = rows.reduce((s, r) => s + Number(r.received_amount), 0);
  return { expense: amount ?? 0, expected, received, outstanding: Math.max(0, expected - received) };
}

/** Which Finance queue an expense sits in. Mirrors the database rules. */
export type FinanceQueue = "unmatched" | "reservation_unresolved" | "needs_clarification" | "review" | "reviewed" | "in_progress";
export function financeQueue(e: {
  links: number;
  reservation_link_state: ReservationLink;
  finance_review: FinanceReview;
  ops_completion: "open" | "done";
  ready: boolean;
}): FinanceQueue {
  if (e.finance_review === "reviewed") return "reviewed";
  if (e.finance_review === "needs_clarification") return "needs_clarification";
  if (e.links === 0) return "unmatched";
  if (e.reservation_link_state === "unresolved") return "reservation_unresolved";
  if (e.ops_completion === "done" && e.ready) return "review";
  return "in_progress";
}

export const money = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });
