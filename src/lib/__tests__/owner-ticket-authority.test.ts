import { expect, it } from "bun:test";
import { ownerTicketRequest } from "../owner-ticket-authority";
import { evaluateAuthority } from "../work-orders";
import { MAINTENANCE_POLICY } from "../maintenance-policy";

it("explains review-only repairs using the canonical authority evaluator", () => {
  const work = { quote_amount: 150, approval_status: "not_required" };
  const request = ownerTicketRequest([work]);
  expect(request.label).toBe("Review — No approval required");
  expect(request.ownerActionRequired).toBe(false);
  expect(request.why).toContain(evaluateAuthority(work).reason);
  expect(request.why).toContain("actually spend");
});
it("retains required owner approval across a Ticket's multiple Work Orders", () => {
  const request = ownerTicketRequest([
    { quote_amount: 1 },
    { quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1 },
  ]);
  expect(request.category).toBe("approve_only");
  expect(request.ownerActionRequired).toBe(true);
});
it("does not confuse missing quotes or internal approval with permission to proceed", () => {
  expect(ownerTicketRequest([]).ownerActionRequired).toBe(null);
  expect(ownerTicketRequest([{}]).ownerActionRequired).toBe(null);
  const request = ownerTicketRequest([
    { quote_amount: MAINTENANCE_POLICY.supervisorApprovalThreshold },
  ]);
  expect(request.ownerActionRequired).toBe(false);
  expect(request.why).toContain("supervisor approves before work starts");
});
it("preserves mitigation limits and completed owner decisions in the explanation", () => {
  const mitigation = ownerTicketRequest([
    { phase: "mitigation", emergency_reason: "unknown-private-text" },
  ]);
  expect(mitigation.why).toContain("permanent repair is evaluated separately");
  expect(mitigation.why.includes("unknown-private-text")).toBe(false);
  const answered = ownerTicketRequest([
    {
      quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1,
      approved_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1,
      approval_status: "approved",
    },
  ]);
  expect(answered.ownerActionRequired).toBe(false);
  expect(answered.why).toContain("prior response");
});

it("does not treat a stale or unpriced approval as covering a higher quote", () => {
  for (const approved_amount of [null, 1]) {
    expect(
      ownerTicketRequest([
        {
          quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1,
          approved_amount,
          approval_status: "approved",
        },
      ]).ownerActionRequired,
    ).toBe(null);
  }
  expect(
    ownerTicketRequest([
      { quote_amount: MAINTENANCE_POLICY.ownerApprovalThreshold + 1, approval_status: "declined" },
    ]).why,
  ).toContain("does not authorize");
});
