export type WithdrawalOpportunity = {
  id: string;
  updated_at: string;
  title: string;
  recommendation: string | null;
  status: string;
  auto_ticket: boolean;
  ticket_id: string | null;
  responded_at: string | null;
};

export function mayWithdrawOpportunity(opportunity: WithdrawalOpportunity) {
  return (
    !opportunity.auto_ticket &&
    !opportunity.ticket_id &&
    !opportunity.responded_at &&
    !["answered", "closed"].includes(opportunity.status)
  );
}

/** Capture the displayed revision once; cache refreshes must not replace it. */
export function captureOpportunityWithdrawal(opportunity: WithdrawalOpportunity, reason = "") {
  return {
    opportunityId: opportunity.id,
    expectedUpdatedAt: opportunity.updated_at,
    title: opportunity.title,
    recommendation: opportunity.recommendation,
    reason,
  };
}

export type OpportunityWithdrawalDraft = ReturnType<typeof captureOpportunityWithdrawal>;
