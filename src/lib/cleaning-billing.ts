/** Pure billing authorization workflow; never charges, sends or releases funds. */
export type BillingStatus =
  | "draft"
  | "evidence_needed"
  | "submitted_for_supervisor_review"
  | "returned_for_correction"
  | "supervisor_approved"
  | "supervisor_rejected"
  | "escalated_to_director"
  | "director_approved"
  | "director_rejected"
  | "ready_for_finance"
  | "finance_processing"
  | "executed"
  | "partially_recovered"
  | "unable_to_recover"
  | "cancelled"
  | "closed";
export type BillingRole = "pc" | "operations_supervisor" | "director_operations" | "finance";
export type DepositAction = "none" | "withhold" | "release" | "refund";
export type BillingAction =
  | "submit"
  | "request_evidence"
  | "return_for_correction"
  | "supervisor_approve"
  | "supervisor_reject"
  | "escalate"
  | "director_approve"
  | "director_reject"
  | "send_to_finance"
  | "start_processing"
  | "request_variance_reapproval"
  | "execute"
  | "partial_recovery"
  | "unable_to_recover"
  | "close"
  | "cancel";
export type BillingRequest = {
  id: string;
  status: BillingStatus;
  requestingPcId: string;
  proposedAmount: number;
  approvedAmount: number | null;
  varianceProposedAmount: number | null;
  varianceReason: string | null;
  actualAmount: number | null;
  depositAmount: number | null;
  depositSource: string | null;
  proposedDepositAction: DepositAction;
  approvedDepositAction: DepositAction | null;
  executedDepositAction: DepositAction | null;
  bookingChannel: string;
  findingCodes: readonly string[];
  evidenceRefs: readonly string[];
  cleaningReviewId: string;
  cleaningTaskId: string;
  inspectionTaskId: string;
  reservationRef: string;
  guestCommunicationDraft: string | null;
  accountingNotificationDraft: string | null;
  ownerrezNotesConfirmed: boolean;
  resolutionCenterRef: string | null;
  executionEvidenceRefs: readonly string[];
  requiresDirector: boolean;
  audit: readonly BillingAuditEvent[];
};
export type BillingAuditEvent = {
  at: string;
  actorId: string;
  role: BillingRole;
  action: BillingAction;
  from: BillingStatus;
  to: BillingStatus;
  reason: string;
  amount: number | null;
};

const allowed: Record<
  BillingAction,
  { roles: readonly BillingRole[]; from: readonly BillingStatus[]; to: BillingStatus }
> = {
  submit: {
    roles: ["pc"],
    from: ["draft", "returned_for_correction", "evidence_needed"],
    to: "submitted_for_supervisor_review",
  },
  request_evidence: {
    roles: ["operations_supervisor", "director_operations"],
    from: ["submitted_for_supervisor_review", "escalated_to_director"],
    to: "evidence_needed",
  },
  return_for_correction: {
    roles: ["operations_supervisor", "director_operations"],
    from: ["submitted_for_supervisor_review", "escalated_to_director"],
    to: "returned_for_correction",
  },
  supervisor_approve: {
    roles: ["operations_supervisor"],
    from: ["submitted_for_supervisor_review"],
    to: "supervisor_approved",
  },
  supervisor_reject: {
    roles: ["operations_supervisor"],
    from: ["submitted_for_supervisor_review"],
    to: "supervisor_rejected",
  },
  escalate: {
    roles: ["operations_supervisor"],
    from: ["submitted_for_supervisor_review", "supervisor_approved"],
    to: "escalated_to_director",
  },
  director_approve: {
    roles: ["director_operations"],
    from: ["escalated_to_director"],
    to: "director_approved",
  },
  director_reject: {
    roles: ["director_operations"],
    from: ["escalated_to_director"],
    to: "director_rejected",
  },
  send_to_finance: {
    roles: ["operations_supervisor", "director_operations"],
    from: ["supervisor_approved", "director_approved"],
    to: "ready_for_finance",
  },
  start_processing: { roles: ["finance"], from: ["ready_for_finance"], to: "finance_processing" },
  request_variance_reapproval: {
    roles: ["finance"],
    from: ["finance_processing"],
    to: "submitted_for_supervisor_review",
  },
  execute: { roles: ["finance"], from: ["finance_processing"], to: "executed" },
  partial_recovery: { roles: ["finance"], from: ["finance_processing"], to: "partially_recovered" },
  unable_to_recover: { roles: ["finance"], from: ["finance_processing"], to: "unable_to_recover" },
  close: {
    roles: ["finance"],
    from: ["executed", "partially_recovered", "unable_to_recover"],
    to: "closed",
  },
  cancel: {
    roles: ["operations_supervisor", "director_operations"],
    from: [
      "draft",
      "evidence_needed",
      "submitted_for_supervisor_review",
      "returned_for_correction",
      "supervisor_approved",
      "escalated_to_director",
      "director_approved",
    ],
    to: "cancelled",
  },
};

export function applyBillingAction(
  request: BillingRequest,
  action: BillingAction,
  role: BillingRole,
  actorId: string,
  at: string,
  reason: string,
  amount: number | null = null,
  executionEvidenceRefs: readonly string[] = [],
  actualDepositAction: DepositAction | null = null,
): BillingRequest {
  const rule = allowed[action];
  if (!rule.roles.includes(role) || !rule.from.includes(request.status))
    throw new Error("Billing action is not permitted for this role or state.");
  if (!actorId || !reason.trim() || !Number.isFinite(Date.parse(at)))
    throw new Error("Actor, reason and timestamp are required.");
  if (
    action === "submit" &&
    (!request.evidenceRefs.length ||
      !request.findingCodes.length ||
      !request.guestCommunicationDraft)
  ) {
    throw new Error("Evidence, findings and guest communication draft are required for review.");
  }
  if (action === "supervisor_approve" && request.requiresDirector)
    throw new Error("Director escalation is required.");
  if (action === "send_to_finance" && request.approvedAmount === null)
    throw new Error("An approved amount is required.");
  if (
    action === "request_variance_reapproval" &&
    (amount === null || !Number.isFinite(amount) || amount < 0 || amount === request.approvedAmount)
  ) {
    throw new Error("A changed amount is required for variance review.");
  }
  if (action === "execute" || action === "partial_recovery" || action === "unable_to_recover") {
    if (
      request.approvedAmount === null ||
      amount === null ||
      amount < 0 ||
      !Number.isFinite(amount)
    )
      throw new Error("Actual amount and prior approval are required.");
    if (amount !== request.approvedAmount)
      throw new Error("Any amount variance requires renewed approval.");
    if (actualDepositAction !== request.approvedDepositAction)
      throw new Error("Deposit action must match the approved decision.");
    if (!executionEvidenceRefs.length) throw new Error("Finance execution evidence is required.");
  }
  if (action === "close" && !request.executionEvidenceRefs.length)
    throw new Error("Financial execution evidence is required before closure.");
  const approvedAmount =
    action === "supervisor_approve" || action === "director_approve"
      ? (amount ?? request.varianceProposedAmount ?? request.proposedAmount)
      : request.approvedAmount;
  if (approvedAmount !== null && (!Number.isFinite(approvedAmount) || approvedAmount < 0))
    throw new Error("Approved amount is invalid.");
  const to = rule.to;
  return {
    ...request,
    status: to,
    approvedAmount,
    approvedDepositAction:
      action === "supervisor_approve" || action === "director_approve"
        ? request.proposedDepositAction
        : request.approvedDepositAction,
    executedDepositAction: ["execute", "partial_recovery", "unable_to_recover"].includes(action)
      ? actualDepositAction
      : request.executedDepositAction,
    varianceProposedAmount:
      action === "request_variance_reapproval" ? amount : request.varianceProposedAmount,
    varianceReason: action === "request_variance_reapproval" ? reason : request.varianceReason,
    actualAmount: ["execute", "partial_recovery", "unable_to_recover"].includes(action)
      ? amount
      : request.actualAmount,
    executionEvidenceRefs: executionEvidenceRefs.length
      ? [...executionEvidenceRefs]
      : request.executionEvidenceRefs,
    audit: [
      ...request.audit,
      { at, actorId, role, action, from: request.status, to, reason, amount },
    ],
  };
}
