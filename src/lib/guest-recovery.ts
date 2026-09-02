/**
 * Guest Recovery — what ARHA does FOR the guest after a service failure.
 *
 * Deliberately not a Claim. A Claim asks whether ARHA can recover money from a
 * responsible party; a Recovery asks what the guest is owed. One incident can
 * carry both, linked, each with its own state.
 *
 * Everything here is pure: vocabulary, authority evaluation and the derived
 * Next Action. Resolve derives timing, evidence state, routing and visibility.
 * Resolve never decides whether a guest deserves compensation or how much —
 * that stays a human decision inside a stated authority.
 */
import { evidenceProgress, formatMoney, type RequirementLike } from "@/lib/claims";

export type RecoveryStage =
  | "reported"
  | "impact_confirmed"
  | "evidence"
  | "decision_drafted"
  | "awaiting_approval"
  | "approved"
  | "guest_offered"
  | "guest_accepted"
  | "completed"
  | "closed";

export type RecoveryOutcome = "resolved" | "declined_no_compensation" | "guest_disputed" | "withdrawn";

export type RecoveryAction =
  | "none"
  | "apology"
  | "mitigation"
  | "credit"
  | "partial_refund"
  | "full_refund"
  | "fee_waiver"
  | "shorten_stay"
  | "relocation";

export type AuthorityLevel = "self" | "supervisor" | "director" | "owner" | "emergency";

export const RECOVERY_STAGE_LABELS: Record<RecoveryStage, string> = {
  reported: "Reported",
  impact_confirmed: "Impact confirmed",
  evidence: "Gathering evidence",
  decision_drafted: "Decision drafted",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  guest_offered: "Offered to guest",
  guest_accepted: "Guest accepted",
  completed: "Delivered",
  closed: "Closed",
};

export const RECOVERY_PIPELINE: RecoveryStage[] = [
  "reported",
  "impact_confirmed",
  "evidence",
  "decision_drafted",
  "awaiting_approval",
  "approved",
  "guest_offered",
  "guest_accepted",
  "completed",
  "closed",
];

export const OUTCOME_LABELS: Record<RecoveryOutcome, string> = {
  resolved: "Resolved with the guest",
  declined_no_compensation: "No compensation given",
  guest_disputed: "Guest still unhappy",
  withdrawn: "Withdrawn",
};

/** The remedies ARHA actually uses. Nothing here is aspirational. */
export const RECOVERY_ACTION_LABELS: Record<RecoveryAction, string> = {
  none: "No compensation",
  apology: "Apology / service recovery only",
  mitigation: "Amenity replacement or temporary mitigation",
  credit: "Credit toward a future stay",
  partial_refund: "Partial refund",
  full_refund: "Full refund",
  fee_waiver: "Fee waiver",
  shorten_stay: "Shorten stay / early departure",
  relocation: "Relocation to alternate accommodation",
};

/** Remedies that move money and therefore need an amount and an authority check. */
export const MONETARY_ACTIONS: RecoveryAction[] = [
  "credit",
  "partial_refund",
  "full_refund",
  "fee_waiver",
  "relocation",
];

export function isMonetary(action: RecoveryAction | null | undefined) {
  return !!action && MONETARY_ACTIONS.includes(action);
}

export const OPEN_STAGES: RecoveryStage[] = RECOVERY_PIPELINE.filter((s) => s !== "closed");

export function isOpenRecovery(stage: RecoveryStage) {
  return OPEN_STAGES.includes(stage);
}

export function stageState(stage: RecoveryStage): "info" | "warning" | "success" | "neutral" {
  if (stage === "awaiting_approval") return "warning";
  if (stage === "completed" || stage === "guest_accepted" || stage === "approved") return "success";
  if (stage === "closed") return "neutral";
  return "info";
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

export type RecoverySlot = {
  key: string;
  label: string;
  kind: string;
  instruction: string;
  required: boolean;
};

const IMPACT_PROOF: RecoverySlot = {
  key: "impact_proof",
  label: "Proof of the impact",
  kind: "damage",
  instruction: "Photo, video or thermostat reading showing what the guest actually lost.",
  required: true,
};

const STAFF_VERIFICATION: RecoverySlot = {
  key: "staff_verification",
  label: "Staff or vendor verification",
  kind: "general",
  instruction: "Who confirmed the issue on site, and what they found. Confirm before any number is discussed.",
  required: true,
};

const GUEST_MESSAGE: RecoverySlot = {
  key: "guest_message",
  label: "Guest message or screenshot",
  kind: "general",
  instruction: "The guest's own description of the problem and what they are asking for.",
  required: false,
};

const RECEIPT: RecoverySlot = {
  key: "guest_receipt",
  label: "Guest receipt",
  kind: "general",
  instruction: "Required before reimbursing an out-of-pocket cost such as spoiled food.",
  required: true,
};

/**
 * Checklist by remedy. Money-moving remedies require verified impact; an
 * apology does not need a receipt.
 */
export function evidenceSlots(action: RecoveryAction | null | undefined): RecoverySlot[] {
  switch (action) {
    case "none":
    case "apology":
      return [GUEST_MESSAGE, STAFF_VERIFICATION];
    case "mitigation":
      return [IMPACT_PROOF, STAFF_VERIFICATION];
    case "full_refund":
    case "shorten_stay":
    case "relocation":
      return [IMPACT_PROOF, STAFF_VERIFICATION, GUEST_MESSAGE];
    default:
      return [IMPACT_PROOF, STAFF_VERIFICATION, GUEST_MESSAGE];
  }
}

/** Reimbursing an out-of-pocket loss always needs the receipt. */
export function slotsForReimbursement(action: RecoveryAction | null | undefined): RecoverySlot[] {
  return [...evidenceSlots(action), RECEIPT];
}

/* ------------------------------------------------------------------ */
/* Authority                                                           */
/* ------------------------------------------------------------------ */

/**
 * The only documented ARHA precedent, from the compensation playbook:
 *   ~30% of the nightly rate per impacted day for loss of use
 *   up to 50% of the first night for a safety event on arrival
 *   anything larger goes to leadership before it is offered
 * Everything beyond this is an open leadership decision, and Resolve says so
 * instead of inventing a threshold.
 */
export const PRECEDENT_LOSS_OF_USE_RATE = 0.3;
export const PRECEDENT_SAFETY_NIGHT_RATE = 0.5;

export type AuthorityInput = {
  recovery_action?: RecoveryAction | null | undefined;
  proposed_amount?: number | string | null | undefined;
  nightly_rate?: number | string | null | undefined;
  impacted_nights?: number | string | null | undefined;
  safety_event?: boolean | undefined;
  emergency?: boolean | undefined;
};

export type AuthorityVerdict = {
  level: AuthorityLevel;
  label: string;
  /** Plain-language reason. Always shown — supervisors learn from the reason. */
  reason: string;
  /** True when ARHA policy does not cover this and leadership must decide. */
  policyGap: boolean;
  precedentAmount: number | null;
};

export const AUTHORITY_LABELS: Record<AuthorityLevel, string> = {
  self: "Within your authority — proceed",
  supervisor: "Supervisor approval required",
  director: "Director approval required",
  owner: "Owner approval required",
  emergency: "Emergency — proceed and notify",
};

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The documented precedent ceiling for this situation, when it can be computed. */
export function precedentCeiling(input: AuthorityInput): number | null {
  const rate = num(input.nightly_rate);
  if (rate === null) return null;
  if (input.safety_event) return Math.round(rate * PRECEDENT_SAFETY_NIGHT_RATE * 100) / 100;
  const nights = num(input.impacted_nights) ?? 1;
  return Math.round(rate * PRECEDENT_LOSS_OF_USE_RATE * nights * 100) / 100;
}

export function evaluateAuthority(input: AuthorityInput): AuthorityVerdict {
  const action = input.recovery_action ?? null;
  const ceiling = precedentCeiling(input);
  const amount = num(input.proposed_amount);

  if (input.emergency) {
    return {
      level: "emergency",
      label: AUTHORITY_LABELS.emergency,
      reason: "Guest safety or displacement is immediate. Act now and notify leadership straight after.",
      policyGap: false,
      precedentAmount: ceiling,
    };
  }

  if (action === "none" || action === "apology") {
    return {
      level: "self",
      label: AUTHORITY_LABELS.self,
      reason: "An apology or service recovery with no money attached is yours to give.",
      policyGap: false,
      precedentAmount: ceiling,
    };
  }

  if (action === "full_refund" || action === "shorten_stay" || action === "relocation") {
    return {
      level: "director",
      label: AUTHORITY_LABELS.director,
      reason:
        `${RECOVERY_ACTION_LABELS[action]} overrides the booking or cancellation policy. ` +
        "ARHA has no documented authority level for this — leadership decides.",
      policyGap: true,
      precedentAmount: ceiling,
    };
  }

  if (action === "mitigation") {
    return {
      level: "self",
      label: AUTHORITY_LABELS.self,
      reason: "Offering a temporary fix first — mini-fridge, portable AC, gift basket — is standard practice.",
      policyGap: false,
      precedentAmount: ceiling,
    };
  }

  if (amount === null) {
    return {
      level: "self",
      label: AUTHORITY_LABELS.self,
      reason: "No amount proposed yet. Confirm the impact and the nightly rate before an amount is discussed.",
      policyGap: false,
      precedentAmount: ceiling,
    };
  }

  if (ceiling === null) {
    return {
      level: "supervisor",
      label: AUTHORITY_LABELS.supervisor,
      reason:
        "The nightly rate is not recorded, so the precedent cannot be checked. " +
        "Record the rate and impacted nights, or get supervisor sign-off.",
      policyGap: true,
      precedentAmount: null,
    };
  }

  if (amount <= ceiling) {
    return {
      level: "self",
      label: AUTHORITY_LABELS.self,
      reason:
        `${formatMoney(amount)} is within the documented precedent of ${formatMoney(ceiling)} ` +
        (input.safety_event
          ? "(up to 50% of the first night for a safety event on arrival)."
          : "(about 30% of the nightly rate per impacted night)."),
      policyGap: false,
      precedentAmount: ceiling,
    };
  }

  return {
    level: "director",
    label: AUTHORITY_LABELS.director,
    reason:
      `Director approval required because ${formatMoney(amount)} exceeds the documented precedent of ` +
      `${formatMoney(ceiling)}. The playbook sends anything larger to leadership before it is offered.`,
    policyGap: true,
    precedentAmount: ceiling,
  };
}

/* ------------------------------------------------------------------ */
/* Next Action                                                         */
/* ------------------------------------------------------------------ */

export type RecoveryLike = {
  stage: RecoveryStage;
  outcome?: RecoveryOutcome | null;
  recovery_action?: RecoveryAction | null;
  impact_detail?: string | null;
  proposed_amount?: number | string | null;
  approved_amount?: number | string | null;
  delivered_amount?: number | string | null;
  nightly_rate?: number | string | null;
  impacted_nights?: number | string | null;
  guest_notified_on?: string | null;
  follow_up_on?: string | null;
  stay_departure?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export type NextActionContext = {
  requirements?: RequirementLike[];
  safetyEvent?: boolean;
  now?: Date;
};

/**
 * One sentence telling the employee what to do next. Derived from stage,
 * evidence, amount vs authority and the approval state — never a status the
 * employee has to interpret.
 */
export function nextAction(recovery: RecoveryLike, ctx: NextActionContext = {}): string {
  const now = ctx.now ?? new Date();
  const reqs = ctx.requirements ?? [];
  const progress = evidenceProgress(reqs);

  if (recovery.stage === "closed") return "Closed — nothing outstanding.";

  if (recovery.outcome === "guest_disputed") {
    return "Guest is still unhappy. Call them, then reassess the remedy with a supervisor.";
  }

  if (recovery.stage === "completed") {
    return "Confirm the guest accepted the resolution, then close the recovery.";
  }

  if (recovery.stage === "guest_accepted") {
    return `Send the approved ${RECOVERY_ACTION_LABELS[recovery.recovery_action ?? "partial_refund"].toLowerCase()} in OwnerRez, then record it here.`;
  }

  if (recovery.stage === "guest_offered") {
    return "Waiting on the guest to respond to the offer. Follow up if there is no reply today.";
  }

  if (recovery.stage === "approved") {
    return "Approved — deliver the decision to the guest by phone, then confirm it in writing.";
  }

  if (recovery.stage === "awaiting_approval") {
    const verdict = evaluateAuthority({
      recovery_action: recovery.recovery_action,
      proposed_amount: recovery.proposed_amount,
      nightly_rate: recovery.nightly_rate,
      impacted_nights: recovery.impacted_nights,
      safety_event: ctx.safetyEvent,
    });
    return `Waiting on approval. ${verdict.reason}`;
  }

  if (!recovery.impact_detail) {
    return "Confirm the impact: what the guest lost, for how many nights, and the nightly rate.";
  }

  if (progress.blocking.length > 0) {
    const first = progress.blocking[0];
    return `Waiting on evidence: ${first?.label ?? "impact confirmation"}.`;
  }

  if (!recovery.recovery_action) {
    return "Impact is confirmed. Decide the remedy — a temporary fix first where one exists.";
  }

  if (isMonetary(recovery.recovery_action) && num(recovery.proposed_amount) === null) {
    return "Record the proposed amount so Resolve can show whose approval this needs.";
  }

  const verdict = evaluateAuthority({
    recovery_action: recovery.recovery_action,
    proposed_amount: recovery.proposed_amount,
    nightly_rate: recovery.nightly_rate,
    impacted_nights: recovery.impacted_nights,
    safety_event: ctx.safetyEvent,
  });

  if (verdict.level === "director") return `Request Director approval. ${verdict.reason}`;
  if (verdict.level === "supervisor") return `Request supervisor approval. ${verdict.reason}`;
  if (verdict.level === "owner") return `Request owner approval. ${verdict.reason}`;

  const checkout = daysUntil(recovery.stay_departure, now);
  if (checkout !== null && checkout <= 1) {
    return "Guest checks out within a day — deliver the decision before they leave.";
  }
  return "Within your authority — deliver the decision to the guest, then record what was sent.";
}

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86_400_000);
}

/** The stage the record has actually reached, offered as a suggestion only. */
export function proposeStage(recovery: RecoveryLike, requirements: RequirementLike[]): RecoveryStage {
  if (recovery.stage === "closed" || recovery.stage === "completed") return recovery.stage;
  if (num(recovery.delivered_amount) !== null) return "completed";
  if (num(recovery.approved_amount) !== null) return "approved";
  if (recovery.stage === "awaiting_approval" || recovery.stage === "guest_offered") return recovery.stage;
  if (!recovery.impact_detail) return "reported";
  const progress = evidenceProgress(requirements);
  if (progress.blocking.length > 0) return "evidence";
  if (!recovery.recovery_action) return "impact_confirmed";
  return "decision_drafted";
}

/* ------------------------------------------------------------------ */
/* Duplicate protection                                                */
/* ------------------------------------------------------------------ */

export type DuplicateCandidate = {
  id?: string;
  stage: RecoveryStage;
  ticket_id?: string | null;
  ownerrez_booking_id?: string | null;
  title?: string | null;
};

/** Warn, never block: two remedies on one stay can be legitimate. */
export function findDuplicates(
  draft: { ticket_id?: string | null; ownerrez_booking_id?: string | null },
  existing: DuplicateCandidate[],
): { candidate: DuplicateCandidate; reason: string }[] {
  const out: { candidate: DuplicateCandidate; reason: string }[] = [];
  for (const row of existing) {
    if (!isOpenRecovery(row.stage)) continue;
    if (draft.ticket_id && row.ticket_id === draft.ticket_id) {
      out.push({ candidate: row, reason: "An open recovery already exists for this ticket." });
      continue;
    }
    if (draft.ownerrez_booking_id && row.ownerrez_booking_id === draft.ownerrez_booking_id) {
      out.push({ candidate: row, reason: "An open recovery already exists for this reservation." });
    }
  }
  return out;
}

export { formatMoney };
