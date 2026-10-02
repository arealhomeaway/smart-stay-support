import { describe, expect, test } from "bun:test";
import {
  authorizationRequired,
  expenseAgeDays,
  financeQueue,
  missingDocumentation,
  recoverySummary,
  splitReconciles,
  totalsByPeriod,
  type ExpenseFacts,
} from "@/lib/expenses";
import { MAINTENANCE_POLICY } from "@/lib/maintenance-policy";

const base: ExpenseFacts = {
  expense_type: "vendor_service",
  property_id: "p",
  payee: "Demo HVAC",
  amount: 95,
  expense_date: "2026-09-28",
  reason: "No cooling",
  dispatch_reason: "No cooling",
  visit_outcome: "Diagnosed; repair pending",
  purchased_what: null,
  purchase_purpose: null,
  invoice_document_ids: ["d1"],
  photo_document_ids: [],
  photos_required: false,
  approval_id: null,
  authorization_note: null,
};

describe("documentation readiness", () => {
  test("diagnostic-only visit with an unresolved repair can be ready", () => {
    expect(missingDocumentation(base)).toEqual([]);
  });
  test("lists exactly what is missing; incomplete is allowed", () => {
    const m = missingDocumentation({ ...base, invoice_document_ids: [], visit_outcome: null, payee: "" });
    expect(m).toEqual(["Invoice or itemized receipt", "Payee", "Outcome of this visit"]);
  });
  test("photos only when the workflow requires them", () => {
    expect(missingDocumentation(base)).not.toContain("Photos (required by this workflow)");
    expect(missingDocumentation({ ...base, photos_required: true })).toContain("Photos (required by this workflow)");
  });
  test("purchases need what and why, not dispatch fields", () => {
    const m = missingDocumentation({ ...base, expense_type: "purchase", dispatch_reason: null, visit_outcome: null });
    expect(m).toEqual(["What was purchased", "Purpose of the purchase"]);
  });
  test("authorization evidence follows the existing policy threshold only", () => {
    const t = MAINTENANCE_POLICY.ownerApprovalThreshold;
    expect(authorizationRequired({ expense_type: "vendor_service", amount: t })).toBe(false);
    expect(authorizationRequired({ expense_type: "vendor_service", amount: t + 1 })).toBe(true);
    expect(missingDocumentation({ ...base, amount: t + 1 })).toContain(
      "Authorization evidence (required by the Maintenance Authority Policy)",
    );
    expect(missingDocumentation({ ...base, amount: t + 1, approval_id: "a" })).toEqual([]);
  });
  test("maintenance thresholds unchanged", () => {
    expect(MAINTENANCE_POLICY.ownerApprovalThreshold).toBe(350);
    expect(MAINTENANCE_POLICY.supervisorApprovalThreshold).toBe(200);
  });
});

describe("split, recovery, periods, queues", () => {
  test("split must reconcile to the cent", () => {
    expect(splitReconciles([{ party: "owner", amount: 320 }, { party: "guest", amount: 100 }], 420)).toBe(true);
    expect(splitReconciles([{ party: "owner", amount: 300 }, { party: "guest", amount: 100 }], 420)).toBe(false);
    expect(splitReconciles([{ party: "owner", amount: 420 }], 420)).toBe(false);
  });
  test("recovery expectation never erases the expense", () => {
    expect(recoverySummary(420, [{ expected_amount: 100, received_amount: 40 }])).toEqual({ expense: 420, expected: 100, received: 40, outstanding: 60 });
  });
  test("multiple invoices across months total per period", () => {
    expect(totalsByPeriod([
      { amount: 95, proposed_statement_period: "2026-09-01" },
      { amount: 420, proposed_statement_period: "2026-10-01" },
      { amount: 10.1, proposed_statement_period: null },
      { amount: 0.2, proposed_statement_period: "2026-10-01" },
    ])).toEqual([
      { period: "2026-09", total: 95 },
      { period: "2026-10", total: 420.2 },
      { period: "Not assigned", total: 10.1 },
    ]);
  });
  test("age in days", () => {
    expect(expenseAgeDays("2026-09-28", "2026-10-02")).toBe(4);
  });
  test("queues", () => {
    const q = { links: 1, reservation_link_state: "not_relevant" as const, finance_review: "not_started" as const, ops_completion: "done" as const, ready: true };
    expect(financeQueue(q)).toBe("review");
    expect(financeQueue({ ...q, links: 0 })).toBe("unmatched");
    expect(financeQueue({ ...q, reservation_link_state: "unresolved" })).toBe("reservation_unresolved");
    expect(financeQueue({ ...q, finance_review: "needs_clarification" })).toBe("needs_clarification");
    expect(financeQueue({ ...q, ready: false })).toBe("in_progress");
  });
});
