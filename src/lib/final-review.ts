/**
 * Final Review — one authoritative rule for when a resolved ticket needs a
 * supervisor's eyes before it can close.
 *
 * This replaces the internal phrase "closure QA" in everything a person reads.
 * The stored column is still `closure_qa_result` (renaming a column mid-beta
 * would break every historical row), but nobody sees that word.
 *
 * The rule is deliberately deterministic and explainable: every ticket that
 * needs Final Review can say *why*, in one sentence, and every ticket that
 * does not is genuinely low-risk routine work that should close when its
 * evidence and communication requirements are already satisfied.
 */

export const FINAL_REVIEW_LABEL = "Review before closing";

/** Stored outcomes that mean Final Review is satisfied. */
export const FINAL_REVIEW_SATISFIED = new Set([
  "pass",
  "corrected",
  "not_required",
  "waived",
]);

export type FinalReviewDecision = "approve" | "return";

export const FINAL_REVIEW_RESULT: Record<FinalReviewDecision, string> = {
  approve: "pass",
  return: "returned",
};

/** How a stored result reads to a person. */
export function finalReviewResultLabel(result: string | null | undefined): string {
  switch (result) {
    case "pass":
      return "Reviewed and approved";
    case "corrected":
      return "Corrected and approved";
    case "waived":
      return "Review skipped";
    case "not_required":
      return "No review needed";
    case "returned":
      return "Changes needed";
    case "not_reviewed":
    case null:
    case undefined:
      return "Needs review before closing";
    default:
      return "Needs review before closing";
  }
}

/** Everything the rule looks at. Callers pass what they have. */
export type FinalReviewFacts = {
  priority?: string | null;
  category?: string | null;
  /** Guest was in the home while the issue was live. */
  guest_in_residence?: boolean | null;
  guest_impact?: string | null;
  /** Any escalation, derived clock or formal escalation record. */
  escalated?: boolean | null;
  escalation_level?: string | null;
  reopen_count?: number | null;
  /** A claim or guest-recovery branch was opened from this ticket. */
  hasClaim?: boolean | null;
  hasRecovery?: boolean | null;
  /** Largest repair amount on the ticket, approved or quoted. */
  repairAmount?: number | null;
  /** Emergency mitigation was carried out. */
  emergency?: boolean | null;
  /** A named lifecycle exception was used somewhere on this ticket. */
  policyExceptionUsed?: boolean | null;
  /** The homeowner is directly involved (approval, complaint, owner-reported). */
  ownerSensitive?: boolean | null;
};

/** The ARHA owner-approval threshold. Above this a repair is "major". */
export const MAJOR_REPAIR_THRESHOLD = 350;

export type FinalReviewRequirement = {
  required: boolean;
  /** Plain-language reasons, in the order they should be shown. */
  reasons: string[];
};

/**
 * Does this ticket need Final Review before it can close?
 *
 * Elevated risk only. Straightforward low-risk work closes on its own once
 * evidence, communication and completion conditions are satisfied.
 */
export function finalReviewRequirement(facts: FinalReviewFacts): FinalReviewRequirement {
  const reasons: string[] = [];

  if (facts.priority === "p1") reasons.push("P1 — highest priority work is always reviewed.");
  if (facts.emergency) reasons.push("Emergency mitigation was carried out.");
  if (facts.policyExceptionUsed) reasons.push("A policy exception was used on this ticket.");
  if (facts.escalated || facts.escalation_level)
    reasons.push("This ticket was escalated for a decision.");
  if ((facts.reopen_count ?? 0) > 0) reasons.push("This ticket has been reopened before.");
  if (facts.hasClaim) reasons.push("A claim was opened from this ticket.");
  if (facts.hasRecovery) reasons.push("Guest recovery was opened from this ticket.");
  if ((facts.repairAmount ?? 0) > MAJOR_REPAIR_THRESHOLD)
    reasons.push(`Major repair — above the $${MAJOR_REPAIR_THRESHOLD} owner threshold.`);
  if (facts.ownerSensitive) reasons.push("The homeowner is directly involved.");
  if (facts.priority === "p2" && (facts.guest_in_residence || facts.guest_impact === "high"))
    reasons.push("P2 with a guest in the home.");

  return { required: reasons.length > 0, reasons };
}

/** One short sentence explaining the outcome of the rule. */
export function finalReviewExplanation(req: FinalReviewRequirement): string {
  if (!req.required)
    return "Straightforward work — this closes on its own once its evidence and communication requirements are met.";
  return req.reasons[0] ?? "This work needs a supervisor's review before closing.";
}
