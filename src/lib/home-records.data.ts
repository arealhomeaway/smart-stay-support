/**
 * Browser reads for Monthly home records. Read only, as the signed-in person under the existing
 * access rules (every table here is readable by internal staff). Real records only: demo rows and
 * demo or archived homes are left out. Nothing here writes.
 */
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLabel } from "@/lib/property-label";
import { roleLabels } from "@/lib/homeowner-has.data";
import {
  approvalLine, breezewayLine, budgetItemLine, budgetLine, claimLine, expenseLine, expenseRecoveryLine, financialRequestLine,
  homeKind, linesInMonth, monthRange, refundLine, workOrderLine,
  type ApprovalRow, type BreezewayRow, type BudgetLineRow, type BudgetRow, type ClaimRow, type ExpenseLinkRow, type ExpenseRecoveryRow,
  type ExpenseRow, type FinancialRequestRow, type HomeInfo, type LineContext, type RecordLine, type RefundRow, type WorkOrderRow,
} from "@/lib/home-records";

// Some finance tables are not all in the generated types.
const db = supabase as unknown as {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

type Res<T> = { data: T[] | null; error: { message?: string } | null };
const PAGE = 1000;
async function all<T>(what: string, page: (from: number, to: number) => PromiseLike<Res<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const r = await page(from, from + PAGE - 1);
    if (r.error) throw new Error(`${what} could not load.`);
    const rows = r.data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
async function chunked<T>(what: string, ids: string[], q: (ids: string[]) => PromiseLike<Res<T>>): Promise<T[]> {
  const out: T[] = [];
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 150) {
    const r = await q(unique.slice(i, i + 150));
    if (r.error) throw new Error(`${what} could not load.`);
    out.push(...(r.data ?? []));
  }
  return out;
}

const EXPENSE_COLS =
  "id, property_id, expense_type, payee, amount, expense_date, invoice_date, received_on, reason, dispatch_reason, visit_outcome, purchased_what, purchase_purpose, invoice_document_ids, photo_document_ids, photos_required, approval_id, authorization_note, cost_responsibility, split_allocations, finance_review, reviewed_by, reviewed_at, is_estimate, created_at";

export type MonthRecords = { month: string; homes: HomeInfo[]; lines: RecordLine[] };

/** Every real home and every money record Resolve holds for the month. */
export async function loadMonthRecords(month: string): Promise<MonthRecords> {
  const { from, to } = monthRange(month);
  const inMonth = <Q extends { gte: (c: string, v: string) => Q; lt: (c: string, v: string) => Q }>(q: Q, col = "created_at") => q.gte(col, from).lt(col, to);

  const [props, claims, refunds, breezeway, workOrders, expenses, recoveries, approvals, budgets, budgetItems, requests, vendors] = await Promise.all([
    all<{ id: string; name: string | null; address_line1: string | null; unit: string | null; city: string | null; state: string | null; postal_code: string | null; lifecycle_status: string | null }>(
      "Homes", (a, b) => db.from("properties").select("id, name, address_line1, unit, city, state, postal_code, lifecycle_status").eq("is_demo", false).is("archived_at", null).order("id").range(a, b)),
    // A claim belongs to the month it was first opened (imported claims keep their Notion date).
    all<ClaimRow>("Claims", (a, b) => db.from("claims").select(
      "id, ticket_id, property_id, title, claim_type, stage, estimated_amount, actual_cost, submitted_amount, approved_amount, recovered_amount, disposition, nonrecovery_reason, incident_description, approval_decided_by, approval_decided_at, created_at, ticket:tickets!claims_ticket_id_fkey(reported_at, resolved_at, external_synced_at, ref)",
    ).eq("is_demo", false).order("id").range(a, b)),
    all<RefundRow>("Refunds and credits", (a, b) => inMonth(db.from("guest_recovery").select(
      "id, ticket_id, property_id, title, stage, recovery_action, proposed_amount, approved_amount, delivered_amount, approval_status, approved_by, approved_at, decision_reason, created_at",
    ).eq("is_demo", false)).order("id").range(a, b)),
    all<BreezewayRow>("Breezeway work orders", (a, b) => inMonth(db.from("breezeway_work_orders").select(
      "id, property_id, name, status, department, linked_ticket_id, breezeway_created_at, created_at, assignees",
    ).eq("department", "maintenance"), "breezeway_created_at").order("id").range(a, b)),
    all<WorkOrderRow>("Work orders", (a, b) => inMonth(db.from("work_orders").select(
      "id, ticket_id, property_id, title, vendor_name, quote_amount, approved_amount, authorized_amount, final_cost, invoice_reference, approval_status, approval_decided_at, supervisor_approval_status, supervisor_approval_decided_at, supervisor_approval_decided_by, vendor_completed_at, closed_at, created_at",
    ).eq("is_demo", false)).order("id").range(a, b)),
    // All live expenses: a Work Order's invoice may be dated in another month.
    all<ExpenseRow>("Expenses", (a, b) => db.from("expenses").select(EXPENSE_COLS).eq("is_demo", false).is("archived_at", null).order("id").range(a, b)),
    all<Omit<ExpenseRecoveryRow, "property_id">>("Paid back on expenses", (a, b) => inMonth(db.from("expense_recoveries").select(
      "id, expense_id, party, expected_amount, received_amount, created_at, corrects_id",
    ).eq("is_demo", false)).order("id").range(a, b)),
    all<ApprovalRow>("Owner approvals", (a, b) => inMonth(db.from("approvals").select(
      "id, entity_type, entity_id, property_id, title, amount, status, decided_at, requested_by, created_at",
    ).eq("is_demo", false).eq("approver_role", "owner")).order("id").range(a, b)),
    all<BudgetRow>("Onboarding budgets", (a, b) => inMonth(db.from("onboarding_budgets").select(
      "id, property_id, approved_amount, approved_by, approved_at, created_at",
    ).eq("is_demo", false)).order("id").range(a, b)),
    all<BudgetLineRow>("Budget items", (a, b) => inMonth(db.from("onboarding_budget_lines").select(
      "id, property_id, category, label, vendor, estimated_amount, committed_amount, actual_amount, status, created_at",
    ).eq("is_demo", false)).order("id").range(a, b)),
    all<FinancialRequestRow>("Onboarding costs", (a, b) => inMonth(db.from("financial_requests").select(
      "id, property_id, task_id, title, vendor, estimate_amount, approved_amount, approved_at, invoice_amount, actual_amount, status, created_at",
    ).eq("is_demo", false)).order("id").range(a, b)),
    // Vendor company names, only to show which Breezeway assignees are vendors.
    all<{ display_name: string | null; legal_name: string | null }>("Vendors", (a, b) => db.from("vendor_orgs").select("display_name, legal_name").order("id").range(a, b)).catch(() => []),
  ]);

  const homes: HomeInfo[] = props.map((p) => ({ id: p.id, label: formatPropertyLabel(p).primary, kind: homeKind(p.lifecycle_status) }));
  const homeIds = new Set(homes.map((h) => h.id));

  const links = await chunked<ExpenseLinkRow>("Expense links", expenses.map((e) => e.id), (ids) =>
    db.from("expense_links").select("expense_id, link_type, target_id").in("expense_id", ids));
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const expensesByTarget: Record<string, ExpenseRow[]> = {};
  for (const l of links) {
    const e = expenseById.get(l.expense_id);
    if (e && (l.link_type === "ticket" || l.link_type === "work_order")) (expensesByTarget[l.target_id] ??= []).push(e);
  }
  const vendorNames: Record<string, string> = {};
  for (const v of vendors) for (const n of [v.display_name, v.legal_name]) if (n?.trim()) vendorNames[n.trim().toLowerCase()] = v.display_name?.trim() || n.trim();

  const ticketIds = [
    ...refunds.map((r) => r.ticket_id), ...breezeway.map((w) => w.linked_ticket_id), ...workOrders.map((w) => w.ticket_id),
    ...approvals.filter((a) => a.entity_type === "ticket").map((a) => a.entity_id),
  ].filter((x): x is string => Boolean(x));
  const people = [
    ...refunds.map((r) => r.approved_by), ...workOrders.map((w) => w.supervisor_approval_decided_by), ...claims.map((c) => c.approval_decided_by),
    ...expenses.map((e) => e.reviewed_by), ...budgets.map((b) => b.approved_by),
  ].filter((x): x is string => Boolean(x));
  const [refs, roles] = await Promise.all([
    chunked<{ id: string; ref: number | null }>("Tickets", ticketIds, (ids) => db.from("tickets").select("id, ref").in("id", ids)),
    roleLabels(people),
  ]);
  const ctx: LineContext = { ticketRefs: Object.fromEntries(refs.map((t) => [t.id, t.ref])), roles, vendorNames, expensesByTarget };

  // A correction replaces the row it corrects.
  const corrected = new Set(recoveries.map((r) => r.corrects_id).filter(Boolean));
  const lines: RecordLine[] = [
    ...breezeway.map((w) => breezewayLine(w, ctx)),
    ...workOrders.map((w) => workOrderLine(w, ctx)),
    ...refunds.map((r) => refundLine(r, ctx)),
    ...claims.map((c) => claimLine(c, ctx)),
    ...expenses.map((e) => expenseLine(e, ctx)),
    ...recoveries.filter((r) => !corrected.has(r.id)).map((r) => expenseRecoveryLine({ ...r, property_id: expenseById.get(r.expense_id)?.property_id ?? null })),
    ...approvals.map((a) => approvalLine(a, ctx)),
    ...budgets.map((b) => budgetLine(b, ctx)),
    ...budgetItems.map((l) => budgetItemLine(l)),
    ...requests.map((f) => financialRequestLine(f)),
  ];
  return { month, homes, lines: linesInMonth(lines, month).filter((l) => homeIds.has(l.propertyId)) };
}
