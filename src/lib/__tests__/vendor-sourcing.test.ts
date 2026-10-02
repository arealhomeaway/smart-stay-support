import { describe, expect, it } from "bun:test";
import { authorizationState, breezewayPushEligibility, fourFacts, suspectedDuplicate, visitNeedsFollowUp, CONTACT_RESPONSES, VISIT_OUTCOMES } from "../vendor-sourcing";
import { ownerAllocationBlocked, purchaseNeedsLeadership } from "../expenses";

describe("vendor sourcing", () => {
  it("contact responses never include acceptance", () => {
    expect(CONTACT_RESPONSES as readonly string[]).not.toContain("accepted");
  });
  it("has the 8 required visit outcomes", () => {
    expect(VISIT_OUTCOMES).toHaveLength(8);
    expect(visitNeedsFollowUp("resolved")).toBe(false);
    expect(visitNeedsFollowUp("no_issue_found")).toBe(false);
    expect(visitNeedsFollowUp("diagnosed_only")).toBe(true);
  });
  it("reuses the authority ladder unchanged ($200 / $350)", () => {
    expect(authorizationState({ quote_amount: 150 }).required).toBe(false);
    expect(authorizationState({ quote_amount: 300 }).who).toBe("supervisor");
    expect(authorizationState({ quote_amount: 500 }).who).toBe("owner");
    expect(authorizationState({ quote_amount: 500, approval_status: "approved" }).satisfied).toBe(true);
  });
  it("stale approval does not count", () => {
    const a = authorizationState({ quote_amount: 500, approval_status: "approved", authorization_stale: true });
    expect(a.satisfied).toBe(false);
    expect(a.stale).toBe(true);
  });
  it("keeps four facts separate", () => {
    expect(fourFacts({ quote_amount: 500 }, true)).toEqual({ accepted: true, authorized: false, dispatched: false, completed: false });
  });
  it("Breezeway push needs acceptance + authorization", () => {
    const base = { vendorUsesBreezeway: true, handoffStatus: "not_sent" };
    expect(breezewayPushEligibility({ ...base, wo: { quote_amount: 500 }, hasAcceptedVendor: true }).allowed).toBe(false);
    expect(breezewayPushEligibility({ ...base, wo: { quote_amount: 100 }, hasAcceptedVendor: false }).allowed).toBe(false);
    expect(breezewayPushEligibility({ ...base, wo: { quote_amount: 100 }, hasAcceptedVendor: true }).allowed).toBe(true);
    expect(breezewayPushEligibility({ ...base, handoffStatus: "simulated", wo: { quote_amount: 100 }, hasAcceptedVendor: true }).allowed).toBe(false);
  });
  it("flags suspected duplicates", () => {
    const a = { payee: "Acme", amount: 100, expense_date: "2026-10-01", vendor_invoice_ref: "INV-1" };
    expect(suspectedDuplicate(a, { ...a, amount: 999, expense_date: "2026-01-01" })).toBe(true);
    expect(suspectedDuplicate(a, { ...a, vendor_invoice_ref: null, amount: 100.5, expense_date: "2026-10-05" })).toBe(true);
    expect(suspectedDuplicate(a, { ...a, vendor_invoice_ref: "INV-2", amount: 300 })).toBe(false);
  });
  it("purchase with missing authorization needs leadership before owner allocation", () => {
    const e = { expense_type: "purchase", purchase_auth_status: "missing", leadership_decision: null };
    expect(purchaseNeedsLeadership(e)).toBe(true);
    expect(ownerAllocationBlocked(e)).not.toBeNull();
    expect(ownerAllocationBlocked({ ...e, leadership_decision: "approved" })).toBeNull();
    expect(purchaseNeedsLeadership({ ...e, expense_type: "vendor_service" })).toBe(false);
  });
});
