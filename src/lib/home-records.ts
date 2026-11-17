/**
 * Monthly home records (Insight, read only; Admin approval Nov 17).
 *
 * One financial record per home per month, built only from records Resolve already holds.
 * Every line says what it is, its amount, who it is billed to, who approved it and whether it
 * is Known, Pending (and what it waits on), Missing (and what is missing) or Not applicable.
 * Pure rules only: no reads, no writes. Reads live in home-records.data.ts.
 *
 * Amounts follow the existing one-amount rules: an expense holds the invoiced amount
 * (src/lib/expenses.ts), estimates never count as invoiced, claim dates come from
 * claimOpenedAt (src/lib/claims.ts). No pay date is ever shown (register BN12).
 */
import { amountAtRisk, claimOpenedAt, claimStageLabel, isOpenClaim, type ClaimStage, type ClaimType } from "@/lib/claims";
import { missingDocumentation, RESPONSIBILITY_LABEL, type ExpenseType, type Responsibility, type SplitLine } from "@/lib/expenses";
import { RECOVERY_ACTION_LABELS, RECOVERY_STAGE_LABELS, type RecoveryAction, type RecoveryStage } from "@/lib/guest-recovery";
import { centralDate, centralInstant, centralToday } from "@/lib/team-schedule";

export type RecordStatus = "known" | "pending" | "missing" | "na";
export const STATUS_LABEL: Record<RecordStatus, string> = {
  known: "Known",
  pending: "Pending",
  missing: "Missing",
  na: "Not applicable",
};

export type SectionKey = "repairs" | "refunds" | "claims" | "expenses" | "approvals" | "onboarding";
export const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "repairs", label: "Repairs and work orders" },
  { key: "refunds", label: "Guest refunds and credits" },
  { key: "claims", label: "Damage claims" },
  { key: "expenses", label: "Expenses" },
  { key: "approvals", label: "Owner approvals and decisions" },
  { key: "onboarding", label: "Onboarding costs" },
];
export const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label])) as Record<SectionKey, string>;

export const HR_COPY = {
  title: "Monthly home records",
  hint: "Every home's money for the month, in one place.",
  noRecords: "No records this month",
  missingTitle: "What's missing this month",
  nothingMissing: "Nothing missing this month.",
  netLine: "Net for the owner statement",
  netHow: "Billed to owner less recovered",
  notRecorded: "Not recorded",
};

/** Where a line opens: its Ticket, its Task, the home, the onboarding budget or Finance. */
export type LineLink =
  | { kind: "ticket"; ticketId: string; label: string }
  | { kind: "task"; propertyId: string; taskId: string; label: string }
  | { kind: "home"; propertyId: string; tab: "operations"; label: string }
  | { kind: "onboarding"; propertyId: string; tab: "budget"; label: string }
  | { kind: "finance"; label: string };

export type Contribution = { owner: number; arha: number; refunds: number; recovered: number };
const NONE: Contribution = { owner: 0, arha: 0, refunds: 0, recovered: 0 };

export type RecordLine = {
  id: string;
  section: SectionKey;
  propertyId: string;
  /** Central calendar day the record belongs to (YYYY-MM-DD). */
  date: string;
  what: string;
  link: LineLink | null;
  vendor: string | null;
  amount: number | null;
  estimate: number | null;
  approved: number | null;
  paidBack: number | null;
  billedTo: string | null;
  approval: string | null;
  status: RecordStatus;
  /** What a Pending line waits on, or what a Missing line lacks. */
  note: string | null;
  /** Where the missing item is fixed. */
  fix: LineLink | null;
  counts: Contribution;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;
const cents = (n: number) => Math.round(n * 100) / 100;

/* ---------------- Months (Central time) ---------------- */

/** The month (YYYY-MM) a date or timestamp belongs to, in Central time. */
export function monthOf(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  const t = Date.parse(value);
  return Number.isFinite(t) ? centralDate(value).slice(0, 7) : null;
}
export function dayOf(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return Number.isFinite(Date.parse(value)) ? centralDate(value) : "";
}
function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** The default month: the last full month in Central time. */
export function lastFullMonth(now: Date = new Date()): string {
  return shiftMonth(centralToday(now).slice(0, 7), -1);
}
/** This month and the 12 before it, newest first. */
export function monthChoices(now: Date = new Date()): { value: string; label: string }[] {
  const current = centralToday(now).slice(0, 7);
  return Array.from({ length: 13 }, (_, i) => {
    const value = shiftMonth(current, -i);
    return { value, label: i === 0 ? `${monthLabel(value)} (so far)` : monthLabel(value) };
  });
}
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 15)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
/** The month's exact start and end instants (Central midnight to Central midnight). */
export function monthRange(month: string): { from: string; to: string; firstDay: string; nextFirstDay: string } {
  const firstDay = `${month}-01`;
  const nextFirstDay = `${shiftMonth(month, 1)}-01`;
  return { from: centralInstant(firstDay, 0), to: centralInstant(nextFirstDay, 0), firstDay, nextFirstDay };
}
export function isValidMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

/* ---------------- Raw rows (as read) ---------------- */

export type BreezewayRow = {
  id: string; property_id: string | null; name: string | null; status: string | null; department: string | null;
  linked_ticket_id: string | null; breezeway_created_at: string | null; created_at: string; assignees: unknown;
};
export type WorkOrderRow = {
  id: string; ticket_id: string | null; property_id: string | null; title: string | null; vendor_name: string | null;
  quote_amount: number | null; approved_amount: number | null; authorized_amount: number | null; final_cost: number | null;
  invoice_reference: string | null; approval_status: string | null; approval_decided_at: string | null;
  supervisor_approval_status: string | null; supervisor_approval_decided_at: string | null; supervisor_approval_decided_by: string | null;
  vendor_completed_at: string | null; closed_at: string | null; created_at: string;
};
export type RefundRow = {
  id: string; ticket_id: string | null; property_id: string | null; title: string | null; stage: string; recovery_action: string | null;
  proposed_amount: number | null; approved_amount: number | null; delivered_amount: number | null; approval_status: string | null;
  approved_by: string | null; approved_at: string | null; decision_reason: string | null; created_at: string;
};
export type ClaimRow = {
  id: string; ticket_id: string | null; property_id: string | null; title: string | null; claim_type: string; stage: string;
  estimated_amount: number | null; actual_cost: number | null; submitted_amount: number | null; approved_amount: number | null;
  recovered_amount: number | null; disposition: string | null; nonrecovery_reason: string | null; incident_description: string | null;
  approval_decided_by: string | null; approval_decided_at: string | null; created_at: string;
  ticket: { reported_at: string | null; resolved_at: string | null; external_synced_at: string | null; ref: number | null } | null;
};
export type ExpenseRow = {
  id: string; property_id: string | null; expense_type: string; payee: string | null; amount: number | null; expense_date: string | null;
  invoice_date: string | null; received_on: string | null; reason: string | null; dispatch_reason: string | null; visit_outcome: string | null;
  purchased_what: string | null; purchase_purpose: string | null; invoice_document_ids: string[] | null; photo_document_ids: string[] | null;
  photos_required: boolean | null; approval_id: string | null; authorization_note: string | null; cost_responsibility: string | null;
  split_allocations: unknown; finance_review: string | null; reviewed_by: string | null; reviewed_at: string | null;
  is_estimate: boolean | null; created_at: string;
};
export type ExpenseLinkRow = { expense_id: string; link_type: string; target_id: string };
export type ExpenseRecoveryRow = {
  id: string; expense_id: string; party: string | null; expected_amount: number | null; received_amount: number | null;
  created_at: string; corrects_id: string | null; property_id: string | null;
};
export type ApprovalRow = {
  id: string; entity_type: string | null; entity_id: string | null; property_id: string | null; title: string | null; amount: number | null;
  status: string | null; decided_at: string | null; requested_by: string | null; created_at: string;
};
export type BudgetRow = { id: string; property_id: string | null; approved_amount: number | null; approved_by: string | null; approved_at: string | null; created_at: string };
export type BudgetLineRow = {
  id: string; property_id: string | null; category: string | null; label: string | null; vendor: string | null; estimated_amount: number | null;
  committed_amount: number | null; actual_amount: number | null; status: string | null; created_at: string;
};
export type FinancialRequestRow = {
  id: string; property_id: string | null; task_id: string | null; title: string | null; vendor: string | null; estimate_amount: number | null;
  approved_amount: number | null; approved_at: string | null; invoice_amount: number | null; actual_amount: number | null; status: string | null; created_at: string;
};

export type LineContext = {
  /** Ticket id -> ref, for link labels. */
  ticketRefs: Record<string, number | null>;
  /** User id -> role label (never a name). */
  roles: Record<string, string>;
  /** Lower-cased vendor company name -> display name (Breezeway assignees that are vendor companies). */
  vendorNames: Record<string, string>;
  /** Expenses (invoices) linked to a Ticket or Work Order id. */
  expensesByTarget: Record<string, ExpenseRow[]>;
};

const roleOf = (ctx: LineContext, id: string | null) => (id ? ctx.roles[id] ?? "Our team" : null);
const ticketLink = (ctx: LineContext, id: string | null): LineLink | null => {
  if (!id) return null;
  const ref = ctx.ticketRefs[id];
  return { kind: "ticket", ticketId: id, label: ref ? `Ticket #${ref}` : "Ticket" };
};
const approvalText = (who: string | null, at: string | null) => {
  const day = dayOf(at);
  if (!who && !day) return null;
  return [who, day ? usDay(day) : ""].filter(Boolean).join(", ");
};
export function usDay(day: string): string {
  const [y, m, d] = day.split("-");
  return y && m && d ? `${m}/${d}/${y}` : day;
}

/** An invoice on file for a Ticket or Work Order: the linked expenses that are not estimates. */
function invoicesFor(ctx: LineContext, ...ids: (string | null)[]): ExpenseRow[] {
  const out: ExpenseRow[] = [];
  for (const id of ids) if (id) for (const e of ctx.expensesByTarget[id] ?? []) if (!e.is_estimate && !out.includes(e)) out.push(e);
  return out;
}
const sumAmounts = (rows: ExpenseRow[]) => (rows.length ? cents(rows.reduce((s, e) => s + (num(e.amount) ?? 0), 0)) : null);
const billLabel = (r: string | null | undefined) => (r && r in RESPONSIBILITY_LABEL ? RESPONSIBILITY_LABEL[r as Responsibility] : null);

/* ---------------- Repairs and work orders ---------------- */

/** Breezeway assignees shown only when they are vendor companies Resolve knows (never a person). */
export function breezewayVendor(assignees: unknown, vendorNames: Record<string, string>): string | null {
  if (!Array.isArray(assignees)) return null;
  const names = assignees
    .map((a) => (a && typeof a === "object" && typeof (a as { name?: unknown }).name === "string" ? (a as { name: string }).name.trim().toLowerCase() : ""))
    .map((n) => vendorNames[n])
    .filter((n): n is string => Boolean(n));
  return names.length ? [...new Set(names)].join(", ") : null;
}

export function breezewayLine(w: BreezewayRow, ctx: LineContext): RecordLine {
  const status = (w.status ?? "").toLowerCase();
  const invoices = invoicesFor(ctx, w.linked_ticket_id, w.id);
  const amount = sumAmounts(invoices);
  const home: LineLink | null = w.property_id ? { kind: "home", propertyId: w.property_id, tab: "operations", label: "Home work orders" } : null;
  const link = ticketLink(ctx, w.linked_ticket_id);
  let s: RecordStatus;
  let note: string | null = null;
  if (status === "deleted") {
    s = "na";
    note = "Removed in Breezeway";
  } else if (invoices.length) {
    s = "known";
  } else if (status === "finished" || status === "approved" || status === "closed") {
    s = "missing";
    note = "No invoice or amount";
  } else {
    s = "pending";
    note = "Waiting on the work to finish";
  }
  return {
    id: `bz:${w.id}`, section: "repairs", propertyId: w.property_id ?? "", date: dayOf(w.breezeway_created_at ?? w.created_at),
    what: `Breezeway work order: ${w.name?.trim() || "Untitled"}`, link, vendor: breezewayVendor(w.assignees, ctx.vendorNames),
    amount, estimate: null, approved: null, paidBack: null,
    billedTo: invoices.length ? billLabel(invoices[0]!.cost_responsibility) : null,
    approval: null, status: s, note, fix: s === "missing" ? link ?? home : null,
    // The invoice amount counts once, on its expense line.
    counts: NONE,
  };
}

export function workOrderLine(w: WorkOrderRow, ctx: LineContext): RecordLine {
  const invoices = invoicesFor(ctx, w.id, w.ticket_id);
  const done = Boolean(w.vendor_completed_at || w.closed_at);
  const approvedAt = w.supervisor_approval_decided_at ?? w.approval_decided_at;
  const approvedStatus = w.supervisor_approval_status ?? w.approval_status;
  let s: RecordStatus = "known";
  let note: string | null = null;
  if (!done) {
    s = "pending";
    note = "Waiting on the work to finish";
  } else if (!invoices.length) {
    s = "missing";
    note = num(w.final_cost) == null ? "No invoice or final cost" : "No invoice on file";
  }
  const link = ticketLink(ctx, w.ticket_id);
  return {
    id: `wo:${w.id}`, section: "repairs", propertyId: w.property_id ?? "", date: dayOf(w.created_at),
    what: `Work order: ${w.title?.trim() || "Untitled"}`, link, vendor: w.vendor_name?.trim() || null,
    amount: sumAmounts(invoices) ?? num(w.final_cost), estimate: num(w.quote_amount),
    approved: num(w.approved_amount) ?? num(w.authorized_amount), paidBack: null,
    billedTo: invoices.length ? billLabel(invoices[0]!.cost_responsibility) : null,
    approval: approvedStatus === "approved" ? approvalText(roleOf(ctx, w.supervisor_approval_decided_by) ?? "Approved", approvedAt) : null,
    status: s, note, fix: s === "missing" ? link : null, counts: NONE,
  };
}

/* ---------------- Guest refunds and credits ---------------- */

export function refundLine(r: RefundRow, ctx: LineContext): RecordLine {
  const given = num(r.delivered_amount);
  const approved = num(r.approved_amount);
  const amount = given ?? approved;
  const kind = r.recovery_action ? RECOVERY_ACTION_LABELS[r.recovery_action as RecoveryAction] ?? "Refund or credit" : "Refund or credit";
  const stage = RECOVERY_STAGE_LABELS[r.stage as RecoveryStage] ?? r.stage;
  let s: RecordStatus;
  let note: string | null = null;
  if (amount != null && !filled(r.decision_reason)) {
    s = "missing";
    note = "No reason recorded";
  } else if (r.approval_status === "pending" || (amount == null && r.stage !== "closed")) {
    s = "pending";
    note = r.approval_status === "pending" ? "Waiting on approval" : `Waiting on: ${stage}`;
  } else if (amount == null) {
    s = "na";
    note = "No money given";
  } else {
    s = "known";
  }
  const link = ticketLink(ctx, r.ticket_id);
  return {
    id: `rf:${r.id}`, section: "refunds", propertyId: r.property_id ?? "", date: dayOf(r.created_at),
    what: `${kind}: ${r.title?.trim() || "Guest refund"}`, link, vendor: null,
    amount, estimate: num(r.proposed_amount), approved, paidBack: null, billedTo: null,
    approval: approved != null ? approvalText(roleOf(ctx, r.approved_by), r.approved_at) : null,
    status: s, note, fix: s === "missing" ? link : null,
    // A refund or credit counts once it is given, or approved when the given amount is not recorded yet.
    counts: { ...NONE, refunds: amount ?? 0 },
  };
}

/* ---------------- Damage claims ---------------- */

/** The month a claim belongs to: its original opened date (claimOpenedAt). */
export function claimDate(c: ClaimRow): string {
  return dayOf(claimOpenedAt(c, c.ticket));
}

export function claimLine(c: ClaimRow, ctx: LineContext): RecordLine {
  const stage = c.stage as ClaimStage;
  const paidBack = num(c.recovered_amount);
  let s: RecordStatus;
  let note: string | null = null;
  if (isOpenClaim(stage)) {
    s = "pending";
    note = `Waiting on: ${claimStageLabel({ stage, incident_description: c.incident_description })}`;
  } else if (paidBack != null || filled(c.disposition) || filled(c.nonrecovery_reason)) {
    s = "known";
  } else {
    s = "missing";
    note = "No outcome recorded";
  }
  const link = c.ticket_id ? { kind: "ticket" as const, ticketId: c.ticket_id, label: c.ticket?.ref ? `Ticket #${c.ticket.ref}` : "Ticket" } : null;
  return {
    id: `cl:${c.id}`, section: "claims", propertyId: c.property_id ?? "", date: claimDate(c),
    what: `Claim: ${c.title?.trim() || "Damage claim"}`, link, vendor: null,
    amount: amountAtRisk({ ...c, claim_type: c.claim_type as ClaimType, stage }), estimate: num(c.estimated_amount),
    approved: num(c.approved_amount), paidBack, billedTo: null,
    approval: approvalText(roleOf(ctx, c.approval_decided_by), c.approval_decided_at),
    status: s, note, fix: s === "missing" ? link : null,
    counts: { ...NONE, recovered: paidBack ?? 0 },
  };
}

/* ---------------- Expenses ---------------- */

function splitParts(v: unknown): SplitLine[] {
  return Array.isArray(v)
    ? v.filter((x): x is SplitLine => Boolean(x) && typeof x === "object" && typeof (x as SplitLine).party === "string" && Number.isFinite(Number((x as SplitLine).amount)))
    : [];
}
/** Who an invoiced expense is billed to, by party, from its recorded responsibility (split lines when split). */
export function expenseCounts(e: Pick<ExpenseRow, "amount" | "cost_responsibility" | "split_allocations" | "is_estimate">): Contribution {
  const amount = num(e.amount);
  if (e.is_estimate || amount == null) return NONE;
  if (e.cost_responsibility === "owner") return { ...NONE, owner: amount };
  if (e.cost_responsibility === "arha") return { ...NONE, arha: amount };
  if (e.cost_responsibility === "split") {
    const parts = splitParts(e.split_allocations);
    const of = (p: string) => cents(parts.filter((x) => x.party === p).reduce((s, x) => s + Number(x.amount), 0));
    return { ...NONE, owner: of("owner"), arha: of("arha") };
  }
  return NONE;
}

export function expenseLine(e: ExpenseRow, ctx: LineContext): RecordLine {
  const missing = missingDocumentation({
    expense_type: e.expense_type as ExpenseType, property_id: e.property_id, payee: e.payee, amount: num(e.amount), expense_date: e.expense_date,
    reason: e.reason, dispatch_reason: e.dispatch_reason, visit_outcome: e.visit_outcome, purchased_what: e.purchased_what,
    purchase_purpose: e.purchase_purpose, invoice_document_ids: e.invoice_document_ids ?? [], photo_document_ids: e.photo_document_ids ?? [],
    photos_required: Boolean(e.photos_required), approval_id: e.approval_id, authorization_note: e.authorization_note,
  });
  const billedTo = billLabel(e.cost_responsibility);
  if (!e.cost_responsibility || e.cost_responsibility === "pending") missing.push("Billed to");
  let s: RecordStatus;
  let note: string | null = null;
  if (e.is_estimate) {
    s = "pending";
    note = "Estimate only, waiting on the invoice";
  } else if (missing.length) {
    s = "missing";
    note = missing.join(", ");
  } else if (e.finance_review !== "reviewed") {
    s = "pending";
    note = "Waiting on Finance review";
  } else {
    s = "known";
  }
  return {
    id: `ex:${e.id}`, section: "expenses", propertyId: e.property_id ?? "", date: dayOf(e.expense_date ?? e.invoice_date ?? e.created_at),
    what: `Expense: ${e.purchased_what?.trim() || e.reason?.trim() || "Invoice"}`, link: { kind: "finance", label: "Finance" },
    vendor: e.payee?.trim() || null, amount: num(e.amount), estimate: null, approved: null, paidBack: null,
    billedTo: billedTo && e.cost_responsibility !== "pending" ? billedTo : null,
    approval: e.finance_review === "reviewed" ? approvalText(roleOf(ctx, e.reviewed_by) ?? "Finance", e.reviewed_at) : null,
    status: s, note, fix: s === "missing" ? { kind: "finance", label: "Finance" } : null,
    counts: expenseCounts(e),
  };
}

export function expenseRecoveryLine(r: ExpenseRecoveryRow): RecordLine {
  const received = num(r.received_amount);
  const expected = num(r.expected_amount);
  return {
    id: `er:${r.id}`, section: "expenses", propertyId: r.property_id ?? "", date: dayOf(r.created_at),
    what: `Paid back on an expense${r.party ? ` by ${RESPONSIBILITY_LABEL[r.party as Responsibility] ?? r.party}` : ""}`,
    link: { kind: "finance", label: "Finance" }, vendor: null, amount: received ?? expected, estimate: expected, approved: null,
    paidBack: received, billedTo: null, approval: null,
    status: received != null ? "known" : "pending", note: received != null ? null : "Waiting on the money",
    fix: null, counts: { ...NONE, recovered: received ?? 0 },
  };
}

/* ---------------- Owner approvals, onboarding costs ---------------- */

const MAKE_READY = /make[\s-]?ready/i;

export function approvalLine(a: ApprovalRow, ctx: LineContext): RecordLine {
  const status = (a.status ?? "").toLowerCase();
  const pending = status === "pending" || status === "requested" || status === "open" || status === "";
  const stopped = status === "cancelled" || status === "withdrawn";
  const link: LineLink | null =
    a.entity_type === "onboarding_task" && a.entity_id && a.property_id
      ? { kind: "task", propertyId: a.property_id, taskId: a.entity_id, label: "Task" }
      : a.entity_type === "ticket" && a.entity_id
        ? ticketLink(ctx, a.entity_id)
        : null;
  return {
    id: `ap:${a.id}`, section: MAKE_READY.test(a.title ?? "") ? "onboarding" : "approvals", propertyId: a.property_id ?? "",
    date: dayOf(a.created_at), what: `Homeowner decision: ${a.title?.trim() || "Approval"}`, link, vendor: null,
    amount: num(a.amount), estimate: null, approved: null, paidBack: null, billedTo: null,
    approval: pending || stopped ? null : approvalText(`Homeowner ${status || "answered"}`, a.decided_at),
    status: pending ? "pending" : stopped ? "na" : "known",
    note: pending ? "Waiting on the homeowner" : stopped ? (status === "cancelled" ? "Cancelled" : "Withdrawn") : null,
    fix: null, counts: NONE,
  };
}

export function budgetLine(b: BudgetRow, ctx: LineContext): RecordLine {
  const amount = num(b.approved_amount);
  const fix: LineLink | null = b.property_id ? { kind: "onboarding", propertyId: b.property_id, tab: "budget", label: "Budget" } : null;
  return {
    id: `bd:${b.id}`, section: "onboarding", propertyId: b.property_id ?? "", date: dayOf(b.created_at), what: "Onboarding budget",
    link: fix, vendor: null, amount, estimate: null, approved: amount, paidBack: null, billedTo: null,
    approval: amount != null ? approvalText(roleOf(ctx, b.approved_by), b.approved_at) : null,
    status: amount != null ? "known" : "missing", note: amount != null ? null : "No approved budget amount",
    fix: amount != null ? null : fix, counts: NONE,
  };
}

export function budgetItemLine(l: BudgetLineRow): RecordLine {
  const actual = num(l.actual_amount);
  const committed = num(l.committed_amount);
  const estimated = num(l.estimated_amount);
  const fix: LineLink | null = l.property_id ? { kind: "onboarding", propertyId: l.property_id, tab: "budget", label: "Budget" } : null;
  const s: RecordStatus = actual != null ? "known" : committed != null || estimated != null ? "pending" : "missing";
  return {
    id: `bl:${l.id}`, section: "onboarding", propertyId: l.property_id ?? "", date: dayOf(l.created_at),
    what: `Budget item: ${l.label?.trim() || l.category?.trim() || "Item"}`, link: fix, vendor: l.vendor?.trim() || null,
    amount: actual ?? committed ?? estimated, estimate: estimated, approved: committed, paidBack: null, billedTo: null, approval: null,
    status: s, note: s === "pending" ? "Waiting on the actual cost" : s === "missing" ? "No amount" : null,
    fix: s === "missing" ? fix : null, counts: NONE,
  };
}

export function financialRequestLine(f: FinancialRequestRow): RecordLine {
  const invoice = num(f.invoice_amount) ?? num(f.actual_amount);
  const approved = num(f.approved_amount);
  const estimate = num(f.estimate_amount);
  const link: LineLink | null = f.task_id && f.property_id ? { kind: "task", propertyId: f.property_id, taskId: f.task_id, label: "Task" } : null;
  const s: RecordStatus = invoice != null ? "known" : approved != null || estimate != null ? "pending" : "missing";
  return {
    id: `fr:${f.id}`, section: "onboarding", propertyId: f.property_id ?? "", date: dayOf(f.created_at),
    what: `Onboarding cost: ${f.title?.trim() || "Request"}`, link, vendor: f.vendor?.trim() || null,
    amount: invoice ?? approved ?? estimate, estimate, approved, paidBack: null, billedTo: null,
    approval: approved != null ? approvalText("Approved", f.approved_at) : null, status: s,
    note: s === "pending" ? (approved != null ? "Waiting on the invoice" : "Waiting on approval") : s === "missing" ? "No amount" : null,
    fix: s === "missing" ? link : null, counts: NONE,
  };
}

/* ---------------- Homes, totals and the all-homes list ---------------- */

export type HomeKind = "active" | "onboarding";
export type HomeFilter = "active" | "onboarding" | "all";
export const HOME_FILTERS: { value: HomeFilter; label: string }[] = [
  { value: "active", label: "Active homes" },
  { value: "onboarding", label: "Onboarding homes" },
  { value: "all", label: "All homes" },
];
export function homeKind(lifecycle: string | null | undefined): HomeKind {
  return lifecycle === "onboarding" ? "onboarding" : "active";
}

export type HomeTotals = { billedToOwner: number; paidByArha: number; refunds: number; recovered: number; net: number };
export function homeTotals(lines: RecordLine[]): HomeTotals {
  const t = lines.reduce(
    (a, l) => ({ owner: a.owner + l.counts.owner, arha: a.arha + l.counts.arha, refunds: a.refunds + l.counts.refunds, recovered: a.recovered + l.counts.recovered }),
    { ...NONE },
  );
  return {
    billedToOwner: cents(t.owner),
    paidByArha: cents(t.arha),
    refunds: cents(t.refunds),
    recovered: cents(t.recovered),
    net: cents(t.owner - t.recovered),
  };
}

export type HomeSummary = { propertyId: string; label: string; kind: HomeKind; totals: HomeTotals; missing: number; lines: number };
export type HomeInfo = { id: string; label: string; kind: HomeKind };

/** One row per home (homes with no records included), missing items first, then by address. */
export function homeSummaries(homes: HomeInfo[], lines: RecordLine[], filter: HomeFilter): HomeSummary[] {
  const by = new Map<string, RecordLine[]>();
  for (const l of lines) by.set(l.propertyId, [...(by.get(l.propertyId) ?? []), l]);
  return homes
    .filter((h) => filter === "all" || h.kind === filter)
    .map((h) => {
      const own = by.get(h.id) ?? [];
      return { propertyId: h.id, label: h.label, kind: h.kind, totals: homeTotals(own), missing: own.filter((l) => l.status === "missing").length, lines: own.length };
    })
    .sort((a, b) => b.missing - a.missing || (b.lines > 0 ? 1 : 0) - (a.lines > 0 ? 1 : 0) || a.label.localeCompare(b.label));
}

export function linesInMonth(lines: RecordLine[], month: string): RecordLine[] {
  return lines.filter((l) => l.propertyId && l.date.slice(0, 7) === month);
}
export function sortLines(lines: RecordLine[]): RecordLine[] {
  const order = SECTIONS.map((s) => s.key);
  return [...lines].sort((a, b) => order.indexOf(a.section) - order.indexOf(b.section) || a.date.localeCompare(b.date) || a.what.localeCompare(b.what));
}
export const missingLines = (lines: RecordLine[]) => sortLines(lines.filter((l) => l.status === "missing"));

/* ---------------- Downloads ---------------- */

export const moneyText = (n: number | null | undefined) =>
  n == null ? "" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });
function csvCell(v: string | number | null | undefined): string {
  const t = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
const csv = (rows: (string | number | null)[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n");

export const CSV_HEADERS = [
  "Home", "Month", "Section", "Date", "What it was", "Ticket or Task", "Vendor", "Amount", "Estimate", "Approved", "Paid back",
  "Billed to", "Approval", "Status", "Waiting on or missing",
];
const n2 = (n: number | null) => (n == null ? "" : n.toFixed(2));
function lineRow(home: string, month: string, l: RecordLine): (string | number | null)[] {
  return [
    home, monthLabel(month), SECTION_LABEL[l.section], l.date ? usDay(l.date) : "", l.what, l.link?.label ?? "", l.vendor ?? "",
    n2(l.amount), n2(l.estimate), n2(l.approved), n2(l.paidBack), l.billedTo ?? HR_COPY.notRecorded, l.approval ?? "",
    STATUS_LABEL[l.status], l.note ?? "",
  ];
}
function totalRows(home: string, month: string, t: HomeTotals): (string | number | null)[][] {
  const row = (what: string, v: number) => [home, monthLabel(month), "Totals", "", what, "", "", v.toFixed(2), "", "", "", "", "", "", ""];
  return [
    row("Billed to owner", t.billedToOwner), row("Paid by ARHA", t.paidByArha), row("Refunds and credits", t.refunds),
    row("Recovered", t.recovered), row(`${HR_COPY.netLine} (${HR_COPY.netHow})`, t.net),
  ];
}
/** One home's month: every line, then its totals. */
export function homeCsv(home: string, month: string, lines: RecordLine[]): string {
  const sorted = sortLines(lines);
  return csv([CSV_HEADERS, ...sorted.map((l) => lineRow(home, month, l)), ...totalRows(home, month, homeTotals(sorted))]);
}
/** Every home with records this month, one block per home with its totals. */
export function allHomesCsv(month: string, homes: HomeInfo[], lines: RecordLine[]): string {
  const rows: (string | number | null)[][] = [CSV_HEADERS];
  for (const h of [...homes].sort((a, b) => a.label.localeCompare(b.label))) {
    const own = sortLines(lines.filter((l) => l.propertyId === h.id));
    if (!own.length) continue;
    rows.push(...own.map((l) => lineRow(h.label, month, l)), ...totalRows(h.label, month, homeTotals(own)));
  }
  return csv(rows);
}
export function fileStem(label: string, month: string): string {
  return `${label.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "home"}-${month}`;
}
