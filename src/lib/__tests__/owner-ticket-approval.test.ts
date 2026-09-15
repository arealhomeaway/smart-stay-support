import { expect, it } from "bun:test";
import { reconcileTicketApproval, type TicketAuthorityApproval } from "../owner-ticket-approval";
import { ownerTicketRequest } from "../owner-ticket-authority";
import { MAINTENANCE_POLICY } from "../maintenance-policy";

const amount = MAINTENANCE_POLICY.ownerApprovalThreshold + 1;
const order = {
  id: "work",
  property_id: "home",
  approval_id: "approval",
  quote_amount: amount,
  approved_amount: amount,
  approval_status: "approved",
};
const approval: TicketAuthorityApproval = {
  id: "approval",
  entity_type: "work_order",
  entity_id: "work",
  property_id: "home",
  approver_role: "owner",
  status: "approved",
  amount,
  decided_at: "2026-09-15T12:00:00Z",
};
const request = (receipt: TicketAuthorityApproval[]) =>
  ownerTicketRequest([reconcileTicketApproval(order, receipt)]);

it("uses the canonical pending decision instead of a stale approved mirror", () => {
  expect(request([{ ...approval, status: "pending", decided_at: null }]).ownerActionRequired).toBe(
    true,
  );
  expect(request([{ ...approval, status: "declined" }]).why).toContain("declined");
  expect(request([approval]).ownerActionRequired).toBe(false);
});
it("does not confirm authority from missing or mismatched approval receipts", () => {
  expect(request([]).ownerActionRequired).toBe(null);
  for (const mismatch of [
    { id: "other" },
    { entity_type: "ticket" },
    { entity_id: "other" },
    { property_id: "other" },
    { approver_role: "supervisor" },
    { status: "cancelled" },
    { amount: null },
    { decided_at: null },
  ]) {
    expect(request([{ ...approval, ...mismatch }]).ownerActionRequired).toBe(null);
  }
  expect(
    ownerTicketRequest([reconcileTicketApproval({ ...order, approval_id: null }, [])])
      .ownerActionRequired,
  ).toBe(null);
});
it("requires both the canonical amount and any narrower mirrored approval to cover changed work", () => {
  expect(request([{ ...approval, amount: amount - 1 }]).ownerActionRequired).toBe(null);
  expect(
    ownerTicketRequest([
      reconcileTicketApproval({ ...order, approved_amount: amount - 1 }, [approval]),
    ]).ownerActionRequired,
  ).toBe(null);
  expect(
    ownerTicketRequest([reconcileTicketApproval({ ...order, approved_amount: null }, [approval])])
      .ownerActionRequired,
  ).toBe(false);
});
