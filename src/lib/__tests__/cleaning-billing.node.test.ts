import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBillingAction, type BillingRequest } from "../cleaning-billing.ts";

const draft: BillingRequest = {
  id: "synthetic-billing",
  status: "draft",
  requestingPcId: "synthetic-pc",
  proposedAmount: 125,
  approvedAmount: null,
  varianceProposedAmount: null,
  varianceReason: null,
  actualAmount: null,
  depositAmount: 100,
  depositSource: "synthetic-booking",
  proposedDepositAction: "none",
  approvedDepositAction: null,
  executedDepositAction: null,
  bookingChannel: "synthetic-channel",
  findingCodes: ["CARPET_STAIN"],
  evidenceRefs: ["synthetic-photo"],
  cleaningReviewId: "synthetic-review",
  cleaningTaskId: "synthetic-clean",
  inspectionTaskId: "synthetic-inspection",
  reservationRef: "synthetic-booking",
  guestCommunicationDraft: "Draft only",
  accountingNotificationDraft: "Draft only",
  ownerrezNotesConfirmed: false,
  resolutionCenterRef: null,
  executionEvidenceRefs: [],
  requiresDirector: false,
  audit: [],
};
const at = "2026-10-05T16:00:00Z";

test("PC submits but cannot approve or execute", () => {
  const submitted = applyBillingAction(
    draft,
    "submit",
    "pc",
    "synthetic-pc",
    at,
    "Evidence attached",
  );
  assert.equal(submitted.status, "submitted_for_supervisor_review");
  assert.equal(submitted.audit.length, 1);
  assert.throws(() =>
    applyBillingAction(submitted, "supervisor_approve", "pc", "synthetic-pc", at, "No authority"),
  );
  assert.throws(() =>
    applyBillingAction(submitted, "execute", "pc", "synthetic-pc", at, "No authority", 125),
  );
});

test("supervisor approval and Finance execution remain separate", () => {
  const submitted = applyBillingAction(
    draft,
    "submit",
    "pc",
    "synthetic-pc",
    at,
    "Ready for review",
  );
  const approved = applyBillingAction(
    submitted,
    "supervisor_approve",
    "operations_supervisor",
    "synthetic-james",
    at,
    "Within policy",
    125,
  );
  assert.equal(approved.status, "supervisor_approved");
  assert.equal(approved.actualAmount, null);
  const ready = applyBillingAction(
    approved,
    "send_to_finance",
    "operations_supervisor",
    "synthetic-james",
    at,
    "Approved for accounting",
  );
  const processing = applyBillingAction(
    ready,
    "start_processing",
    "finance",
    "synthetic-finance",
    at,
    "Reconciling",
  );
  assert.throws(() =>
    applyBillingAction(
      processing,
      "execute",
      "finance",
      "synthetic-finance",
      at,
      "Changed amount",
      100,
      ["synthetic-receipt"],
    ),
  );
  const variance = applyBillingAction(
    processing,
    "request_variance_reapproval",
    "finance",
    "synthetic-finance",
    at,
    "Only $100 recovered",
    100,
  );
  assert.equal(variance.status, "submitted_for_supervisor_review");
  const reapproved = applyBillingAction(
    variance,
    "supervisor_approve",
    "operations_supervisor",
    "synthetic-james",
    at,
    "Variance reviewed",
    100,
  );
  const readyAgain = applyBillingAction(
    reapproved,
    "send_to_finance",
    "operations_supervisor",
    "synthetic-james",
    at,
    "Reapproved for Finance",
  );
  const processingAgain = applyBillingAction(
    readyAgain,
    "start_processing",
    "finance",
    "synthetic-finance",
    at,
    "Reprocessing",
  );
  assert.equal(
    applyBillingAction(
      processingAgain,
      "partial_recovery",
      "finance",
      "synthetic-finance",
      at,
      "Partial amount documented",
      100,
      ["synthetic-partial-receipt"],
      "none",
    ).status,
    "partially_recovered",
  );
  const executed = applyBillingAction(
    processing,
    "execute",
    "finance",
    "synthetic-finance",
    at,
    "Confirmed execution",
    125,
    ["synthetic-receipt"],
    "none",
  );
  assert.equal(executed.status, "executed");
  assert.equal(
    applyBillingAction(executed, "close", "finance", "synthetic-finance", at, "Reconciled").status,
    "closed",
  );
});

test("disputed or exceptional request requires Director approval", () => {
  const submitted = applyBillingAction(
    { ...draft, requiresDirector: true },
    "submit",
    "pc",
    "synthetic-pc",
    at,
    "Disputed charge",
  );
  assert.throws(() =>
    applyBillingAction(
      submitted,
      "supervisor_approve",
      "operations_supervisor",
      "synthetic-james",
      at,
      "Cannot approve",
    ),
  );
  const escalated = applyBillingAction(
    submitted,
    "escalate",
    "operations_supervisor",
    "synthetic-james",
    at,
    "Disputed evidence",
  );
  const approved = applyBillingAction(
    escalated,
    "director_approve",
    "director_operations",
    "synthetic-micah",
    at,
    "Reviewed dispute",
    125,
  );
  assert.equal(approved.status, "director_approved");
  assert.equal(approved.audit.length, 3);
});

test("a PC deposit proposal cannot become an unapproved Finance action", () => {
  const proposed = { ...draft, proposedDepositAction: "withhold" as const };
  const submitted = applyBillingAction(
    proposed,
    "submit",
    "pc",
    "synthetic-pc",
    at,
    "Deposit review requested",
  );
  assert.equal(submitted.approvedDepositAction, null);
  const approved = applyBillingAction(
    submitted,
    "supervisor_approve",
    "operations_supervisor",
    "synthetic-james",
    at,
    "Deposit evidence reviewed",
    125,
  );
  const ready = applyBillingAction(
    approved,
    "send_to_finance",
    "operations_supervisor",
    "synthetic-james",
    at,
    "For Finance",
  );
  const processing = applyBillingAction(
    ready,
    "start_processing",
    "finance",
    "synthetic-finance",
    at,
    "Processing",
  );
  assert.throws(() =>
    applyBillingAction(
      processing,
      "execute",
      "finance",
      "synthetic-finance",
      at,
      "Wrong deposit action",
      125,
      ["synthetic-receipt"],
      "release",
    ),
  );
  const executed = applyBillingAction(
    processing,
    "execute",
    "finance",
    "synthetic-finance",
    at,
    "Matching authorized action",
    125,
    ["synthetic-receipt"],
    "withhold",
  );
  assert.equal(executed.executedDepositAction, "withhold");
});
