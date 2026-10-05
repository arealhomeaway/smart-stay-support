import { describe, expect, it } from "bun:test";
import { itemBlockers, needsRecoveryTreatment, periodReadiness, type StatementItem } from "@/lib/statement-readiness";

const base: StatementItem = {
  id: "e1", expense_type: "other", property_id: "p", payee: "QA", amount: 195, expense_date: "2026-10-01",
  reason: "Diagnostic", dispatch_reason: null, visit_outcome: null, purchased_what: null, purchase_purpose: null,
  invoice_document_ids: ["d"], photo_document_ids: [], photos_required: false, approval_id: null, authorization_note: null,
  is_estimate: false, duplicate_flag: null, finance_review: "reviewed", cost_responsibility: "owner", owner_notified_at: null,
  links: 1, openClarifications: 0, openClaims: [], expected: 0, received: 0,
};

describe("statement readiness", () => {
  it("an empty period is not reconciled until Finance confirms", () => {
    expect(periodReadiness([])).toBe("not_reconciled");
    expect(periodReadiness([{ status: "confirmed", reviewed_at: "x" }])).toBe("expense_review_ready");
  });
  it("a change after sign-off needs re-review", () => {
    expect(periodReadiness([{ status: "invalidated", reviewed_at: "x" }])).toBe("needs_rereview");
  });
  it("a documented expense with an open repair follow-up has no blockers", () => {
    expect(itemBlockers(base)).toEqual([]);
  });
  it("names each blocker specifically", () => {
    const b = itemBlockers({ ...base, links: 0, cost_responsibility: "pending", openClarifications: 1, duplicate_flag: "suspected" });
    expect(b.length).toBe(4);
  });
  it("open claims and outstanding recoveries need explicit treatment, not a block", () => {
    expect(needsRecoveryTreatment({ openClaims: [{ id: "c", title: null }], expected: 0, received: 0 })).toBe(true);
    expect(needsRecoveryTreatment({ openClaims: [], expected: 300, received: 250 })).toBe(true);
    expect(needsRecoveryTreatment({ openClaims: [], expected: 300, received: 300 })).toBe(false);
  });
});
