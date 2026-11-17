import { describe, expect, it } from "bun:test";
import { capabilitiesFor } from "@/lib/permissions";
import {
  CSV_HEADERS, approvalLine, breezewayLine, claimLine, expenseLine, homeSummaries, homeTotals, lastFullMonth, monthRange, refundLine, workOrderLine,
  type BreezewayRow, type ClaimRow, type ExpenseRow, type LineContext, type RecordLine, type RefundRow, type WorkOrderRow,
} from "@/lib/home-records";

const ctx: LineContext = { ticketRefs: {}, roles: {}, vendorNames: {}, expensesByTarget: {} };
const H = "home-1";

const expense = (over: Partial<ExpenseRow> = {}): ExpenseRow => ({
  id: "e1", property_id: H, expense_type: "vendor_invoice", payee: "Acme Plumbing", amount: 300, expense_date: "2026-10-10", invoice_date: null,
  received_on: null, reason: "Leak", dispatch_reason: "Leak under sink", visit_outcome: "Fixed", purchased_what: null, purchase_purpose: null,
  invoice_document_ids: ["d1"], photo_document_ids: [], photos_required: false, approval_id: null, authorization_note: "Under $250 rule",
  cost_responsibility: "owner", split_allocations: [], finance_review: "reviewed", reviewed_by: null, reviewed_at: null, is_estimate: false,
  created_at: "2026-10-10T15:00:00Z", ...over,
});
const claim = (over: Partial<ClaimRow> = {}): ClaimRow => ({
  id: "c1", ticket_id: "t1", property_id: H, title: "Broken TV", claim_type: "guest_damage", stage: "closed", estimated_amount: 400,
  actual_cost: null, submitted_amount: null, approved_amount: null, recovered_amount: null, disposition: null, nonrecovery_reason: null,
  incident_description: null, approval_decided_by: null, approval_decided_at: null, created_at: "2026-10-05T15:00:00Z", ticket: null, ...over,
});
const refund = (over: Partial<RefundRow> = {}): RefundRow => ({
  id: "r1", ticket_id: "t1", property_id: H, title: "No hot water", stage: "completed", recovery_action: "partial_refund", proposed_amount: 100,
  approved_amount: 100, delivered_amount: 100, approval_status: "approved", approved_by: null, approved_at: null, decision_reason: "One night lost",
  created_at: "2026-10-03T15:00:00Z", ...over,
});
const line = (over: Partial<RecordLine>): RecordLine => ({
  id: "x", section: "expenses", propertyId: H, date: "2026-10-10", what: "x", link: null, vendor: null, amount: null, estimate: null,
  approved: null, paidBack: null, billedTo: null, approval: null, status: "known", note: null, fix: null,
  counts: { owner: 0, arha: 0, refunds: 0, recovered: 0 }, ...over,
});

describe("Monthly home records", () => {
  it("opens on the last full month in Central time", () => {
    expect(lastFullMonth(new Date("2026-11-17T12:00:00Z"))).toBe("2026-10");
    // 10 PM Central on Nov 30 is still November.
    expect(lastFullMonth(new Date("2026-12-01T04:00:00Z"))).toBe("2026-10");
  });

  it("a month runs Central midnight to Central midnight", () => {
    expect(monthRange("2026-10")).toMatchObject({ from: "2026-10-01T05:00:00.000Z", to: "2026-11-01T05:00:00.000Z" });
  });

  it("an imported claim belongs to the month its Ticket was first reported, not the import day", () => {
    const l = claimLine(claim({ incident_description: "Imported from Notion", created_at: "2026-11-02T15:00:00Z", ticket: { reported_at: "2026-09-12T15:00:00Z", resolved_at: null, external_synced_at: null, ref: 12 } }), ctx);
    expect(l.date).toBe("2026-09-12");
  });

  it("a closed claim with no outcome is Missing; an open claim is Pending", () => {
    expect(claimLine(claim(), ctx)).toMatchObject({ status: "missing", note: "No outcome recorded" });
    expect(claimLine(claim({ stage: "submitted" }), ctx).status).toBe("pending");
    expect(claimLine(claim({ recovered_amount: 250 }), ctx)).toMatchObject({ status: "known", paidBack: 250 });
  });

  it("a refund with money and no reason is Missing", () => {
    expect(refundLine(refund({ decision_reason: null }), ctx)).toMatchObject({ status: "missing", note: "No reason recorded" });
    expect(refundLine(refund(), ctx).counts.refunds).toBe(100);
  });

  it("finished work with no invoice is Missing", () => {
    const bz: BreezewayRow = { id: "b1", property_id: H, name: "Fix gate", status: "Finished", department: "maintenance", linked_ticket_id: null, breezeway_created_at: "2026-10-04T15:00:00Z", created_at: "2026-10-04T15:00:00Z", assignees: [] };
    expect(breezewayLine(bz, ctx)).toMatchObject({ status: "missing", note: "No invoice or amount" });
    const wo: WorkOrderRow = { id: "w1", ticket_id: "t1", property_id: H, title: "Fix gate", vendor_name: "Acme", quote_amount: 200, approved_amount: null, authorized_amount: null, final_cost: null, invoice_reference: null, approval_status: null, approval_decided_at: null, supervisor_approval_status: null, supervisor_approval_decided_at: null, supervisor_approval_decided_by: null, vendor_completed_at: "2026-10-06T15:00:00Z", closed_at: null, created_at: "2026-10-04T15:00:00Z" };
    expect(workOrderLine(wo, ctx)).toMatchObject({ status: "missing", note: "No invoice or final cost" });
    expect(workOrderLine(wo, { ...ctx, expensesByTarget: { w1: [expense()] } }).status).toBe("known");
  });

  it("an expense with no Bill To is Missing", () => {
    expect(expenseLine(expense({ cost_responsibility: "pending" }), ctx)).toMatchObject({ status: "missing", note: "Billed to" });
  });

  it("estimates never count; split invoices count by party", () => {
    expect(expenseLine(expense({ is_estimate: true }), ctx).counts.owner).toBe(0);
    const split = expenseLine(expense({ cost_responsibility: "split", split_allocations: [{ party: "owner", amount: 200 }, { party: "arha", amount: 100 }] }), ctx);
    expect(split.counts).toMatchObject({ owner: 200, arha: 100 });
  });

  it("net for the owner statement is billed to owner less recovered", () => {
    const t = homeTotals([
      line({ counts: { owner: 300, arha: 50, refunds: 0, recovered: 0 } }),
      line({ counts: { owner: 0, arha: 0, refunds: 100, recovered: 120 } }),
    ]);
    expect(t).toEqual({ billedToOwner: 300, paidByArha: 50, refunds: 100, recovered: 120, net: 180 });
  });

  it("homes with missing items sort first; the filter picks active, onboarding or all", () => {
    const homes = [
      { id: "a", label: "100 A St", kind: "active" as const },
      { id: "b", label: "200 B St", kind: "active" as const },
      { id: "c", label: "300 C St", kind: "onboarding" as const },
    ];
    const lines = [line({ propertyId: "b", status: "missing" }), line({ propertyId: "a" })];
    expect(homeSummaries(homes, lines, "active").map((h) => h.propertyId)).toEqual(["b", "a"]);
    expect(homeSummaries(homes, lines, "onboarding").map((h) => h.propertyId)).toEqual(["c"]);
    expect(homeSummaries(homes, lines, "all")).toHaveLength(3);
    expect(homeSummaries(homes, lines, "all").find((h) => h.propertyId === "c")).toMatchObject({ lines: 0, missing: 0 });
  });

  it("an owner approval on an archived Task is Not applicable, not waiting on the homeowner", () => {
    const a = { id: "a1", entity_type: "onboarding_task", entity_id: "task1", property_id: H, title: "Approve paint", amount: null, status: "pending", decided_at: null, requested_by: null, created_at: "2026-09-22T15:00:00Z" };
    expect(approvalLine(a, ctx)).toMatchObject({ status: "pending", note: "Waiting on the homeowner" });
    expect(approvalLine({ ...a, task_archived: true }, ctx)).toMatchObject({ status: "na", note: "Its Task was archived", link: null });
  });

  it("downloads carry no pay date (BN12)", () => {
    expect(CSV_HEADERS.some((h) => /paid on|pay date|payment date|received on/i.test(h))).toBe(false);
  });

  it("opens for Admin, the Directors, the Operations Supervisor and the Finance lead only", () => {
    expect(capabilitiesFor(["admin"]).has("home_records")).toBe(true);
    expect(capabilitiesFor(["manager"], { opsSupervisor: true }).has("home_records")).toBe(true);
    expect(capabilitiesFor(["manager"], { opsDirector: true }).has("home_records")).toBe(true);
    expect(capabilitiesFor(["onboarding"], { onboardingDirector: true }).has("home_records")).toBe(true);
    expect(capabilitiesFor(["manager"], { finance: true }).has("home_records")).toBe(true);
    expect(capabilitiesFor(["tech"]).has("home_records")).toBe(false);
    expect(capabilitiesFor(["onboarding"], { projectManager: true }).has("home_records")).toBe(false);
  });
});
