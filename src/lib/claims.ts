/**
 * Claims — read-time derivation.
 *
 * A Claim is the recovery process around a financially recoverable incident.
 * The Ticket stays the operational history; the Claim is how ARHA gets the
 * money back. Everything an employee would otherwise have to remember — what
 * evidence is still missing, whether a deadline is closing in, what to do next
 * — is derived here from stored facts. Nothing in this file reads data,
 * decides permissions or writes anything.
 */

export type ClaimType =
  | "channel_aircover"
  | "channel_vrbo"
  | "guest_damage"
  | "deposit_recovery"
  | "insurance"
  | "owner_recovery";

export type ClaimStage =
  | "potential"
  | "gathering"
  | "costing"
  | "ready_to_submit"
  | "submitted"
  | "waiting_external"
  | "info_requested"
  | "decided"
  | "recovered"
  | "closed";

export type ClaimDisposition = "approved" | "partial" | "denied" | "withdrawn" | "written_off";

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  channel_aircover: "Airbnb / AirCover",
  channel_vrbo: "Vrbo / channel claim",
  guest_damage: "Guest damage",
  deposit_recovery: "Security deposit",
  insurance: "Insurance",
  owner_recovery: "Owner recovery",
};

/** Who we are recovering from. Shown so nobody has to infer it from the type. */
export const RECOVERY_SOURCE: Record<ClaimType, string> = {
  channel_aircover: "Airbnb",
  channel_vrbo: "Vrbo / channel",
  guest_damage: "Guest",
  deposit_recovery: "Security deposit",
  insurance: "Insurer",
  owner_recovery: "Homeowner",
};

export const CLAIM_STAGE_LABELS: Record<ClaimStage, string> = {
  potential: "Potential claim",
  gathering: "Gathering evidence",
  costing: "Determining cost",
  ready_to_submit: "Ready to submit",
  submitted: "Submitted",
  waiting_external: "Waiting on response",
  info_requested: "More information requested",
  decided: "Decision received",
  recovered: "Recovered",
  closed: "Closed",
};

export const CLAIM_PIPELINE: ClaimStage[] = [
  "potential",
  "gathering",
  "costing",
  "ready_to_submit",
  "submitted",
  "waiting_external",
  "info_requested",
  "decided",
  "recovered",
  "closed",
];

export const DISPOSITION_LABELS: Record<ClaimDisposition, string> = {
  approved: "Approved in full",
  partial: "Partially approved",
  denied: "Denied",
  withdrawn: "Withdrawn",
  written_off: "Written off",
};

export const OPEN_STAGES: ClaimStage[] = [
  "potential",
  "gathering",
  "costing",
  "ready_to_submit",
  "submitted",
  "waiting_external",
  "info_requested",
  "decided",
];

export function isOpenClaim(stage: ClaimStage) {
  return OPEN_STAGES.includes(stage);
}

/** Stages where the ball is with the platform, insurer or guest. */
export function isExternalWait(stage: ClaimStage) {
  return stage === "submitted" || stage === "waiting_external" || stage === "info_requested";
}

export function stageState(stage: ClaimStage) {
  if (stage === "recovered" || stage === "closed") return "done" as const;
  if (stage === "info_requested") return "blocked" as const;
  if (stage === "submitted" || stage === "waiting_external") return "waiting" as const;
  if (stage === "potential") return "new" as const;
  return "active" as const;
}

/* -------------------------------------------------------------------------
 * Evidence checklists
 *
 * Slots reuse the existing Evidence Quality Gate (`evidence_requirements`
 * with subject_type = 'claim'). Only what a recovery genuinely needs — an
 * over-long checklist trains people to ignore it.
 * ---------------------------------------------------------------------- */

export type EvidenceSlot = {
  key: string;
  label: string;
  /** Requirement kind understood by the existing evidence gate. */
  kind: "damage" | "general" | "before" | "after";
  required: boolean;
  instruction: string;
};

const DAMAGE_PHOTOS: EvidenceSlot = {
  key: "damage_photos",
  label: "Damage photos",
  kind: "damage",
  required: true,
  instruction: "Wide shot plus close-up of each damaged item, taken before any repair.",
};

const VENDOR_ESTIMATE: EvidenceSlot = {
  key: "vendor_estimate",
  label: "Vendor estimate or quote",
  kind: "general",
  required: true,
  instruction: "Written quote from the vendor, on their letterhead or in their own email.",
};

const INVOICE: EvidenceSlot = {
  key: "invoice",
  label: "Final invoice or receipt",
  kind: "general",
  required: true,
  instruction: "The amount actually paid, matching the repair or replacement claimed.",
};

const GUEST_COMMS: EvidenceSlot = {
  key: "guest_comms",
  label: "Guest communication",
  kind: "general",
  required: true,
  instruction: "Platform message thread showing the guest was told about the damage.",
};

const PLATFORM_CORRESPONDENCE: EvidenceSlot = {
  key: "platform_correspondence",
  label: "Platform correspondence",
  kind: "general",
  required: false,
  instruction: "Case reference and any request the platform has made.",
};

const CLEANING_REPORT: EvidenceSlot = {
  key: "cleaning_report",
  label: "Cleaning or inspection report",
  kind: "general",
  required: false,
  instruction: "The cleaner or inspector's written finding at turnover.",
};

const RESERVATION_PROOF: EvidenceSlot = {
  key: "reservation_proof",
  label: "Reservation record",
  kind: "general",
  required: true,
  instruction: "Confirmation showing who stayed and when.",
};

const OWNER_APPROVAL: EvidenceSlot = {
  key: "owner_approval",
  label: "Owner approval",
  kind: "general",
  required: true,
  instruction: "Written agreement from the homeowner to be charged or reimbursed.",
};

export const EVIDENCE_BY_TYPE: Record<ClaimType, EvidenceSlot[]> = {
  channel_aircover: [
    DAMAGE_PHOTOS,
    VENDOR_ESTIMATE,
    INVOICE,
    GUEST_COMMS,
    RESERVATION_PROOF,
    PLATFORM_CORRESPONDENCE,
    CLEANING_REPORT,
  ],
  channel_vrbo: [
    DAMAGE_PHOTOS,
    VENDOR_ESTIMATE,
    INVOICE,
    GUEST_COMMS,
    RESERVATION_PROOF,
    PLATFORM_CORRESPONDENCE,
  ],
  guest_damage: [DAMAGE_PHOTOS, VENDOR_ESTIMATE, INVOICE, GUEST_COMMS, RESERVATION_PROOF],
  deposit_recovery: [DAMAGE_PHOTOS, INVOICE, RESERVATION_PROOF, GUEST_COMMS],
  insurance: [DAMAGE_PHOTOS, VENDOR_ESTIMATE, INVOICE, CLEANING_REPORT],
  owner_recovery: [DAMAGE_PHOTOS, INVOICE, OWNER_APPROVAL],
};

export function evidenceSlots(type: ClaimType): EvidenceSlot[] {
  return EVIDENCE_BY_TYPE[type] ?? [];
}

export type EvidenceStatus =
  "awaiting" | "checking" | "verified" | "rejected" | "accepted_exception";

export type RequirementLike = {
  slot_key: string;
  label?: string | null;
  required?: boolean | null;
  status?: string | null;
};

/** A requirement counts as met once the gate has verified it or accepted it. */
export function isMet(req: RequirementLike) {
  return req.status === "verified" || req.status === "accepted_exception";
}

export type EvidenceProgress = {
  required: RequirementLike[];
  met: RequirementLike[];
  missing: RequirementLike[];
  /** Missing and still required — what actually blocks submission. */
  blocking: RequirementLike[];
  complete: boolean;
};

export function evidenceProgress(requirements: RequirementLike[]): EvidenceProgress {
  const required = requirements.filter((r) => r.required !== false);
  const met = requirements.filter(isMet);
  const missing = requirements.filter((r) => !isMet(r));
  const blocking = required.filter((r) => !isMet(r));
  return {
    required,
    met,
    missing,
    blocking,
    complete: blocking.length === 0 && required.length > 0,
  };
}

/* -------------------------------------------------------------------------
 * Deadlines
 *
 * Resolve does not invent platform policy. `deadline_on` is whatever the
 * platform notice said; Resolve owns only the arithmetic around it.
 * ---------------------------------------------------------------------- */

const DAY = 24 * 60 * 60 * 1000;

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(`${iso}`.length <= 10 ? `${iso}T12:00:00` : iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - now.getTime()) / DAY);
}

export type DeadlineState = "none" | "overdue" | "today" | "approaching" | "scheduled";

/** Approaching means "start worrying" — seven days out. */
export const APPROACHING_DAYS = 7;

export function deadlineState(
  deadline: string | null | undefined,
  now = new Date(),
): DeadlineState {
  const d = daysUntil(deadline, now);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= APPROACHING_DAYS) return "approaching";
  return "scheduled";
}

export type ClaimLike = {
  id?: string;
  claim_type: ClaimType;
  stage: ClaimStage;
  disposition?: ClaimDisposition | null;
  deadline_on?: string | null;
  follow_up_on?: string | null;
  submitted_on?: string | null;
  estimated_amount?: number | string | null;
  actual_cost?: number | string | null;
  submitted_amount?: number | string | null;
  approved_amount?: number | string | null;
  recovered_amount?: number | string | null;
  recovered_on?: string | null;
  assigned_to?: string | null;
  property_id?: string | null;
  ticket_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The money on the line: what we asked for, else the cost, else the estimate. */
export function amountAtRisk(claim: ClaimLike): number | null {
  return num(claim.submitted_amount) ?? num(claim.actual_cost) ?? num(claim.estimated_amount);
}

/** Submitted minus recovered. Never negative, never guessed. */
export function unrecovered(claim: ClaimLike): number | null {
  const submitted = num(claim.submitted_amount);
  if (submitted === null) return null;
  const recovered = num(claim.recovered_amount) ?? 0;
  return Math.max(0, submitted - recovered);
}

export function hasCost(claim: ClaimLike) {
  return num(claim.actual_cost) !== null || num(claim.estimated_amount) !== null;
}

/* -------------------------------------------------------------------------
 * Next Action
 * ---------------------------------------------------------------------- */

export type NextActionContext = {
  requirements?: RequirementLike[];
  now?: Date;
};

/**
 * The one sentence that answers "what happens next?". Derived — never a field
 * somebody has to maintain by hand.
 */
export function nextAction(claim: ClaimLike, ctx: NextActionContext = {}): string {
  const now = ctx.now ?? new Date();
  const progress = evidenceProgress(ctx.requirements ?? []);
  const firstMissing = progress.blocking[0];

  switch (claim.stage) {
    case "closed":
      return "Closed — no action";
    case "recovered":
      return "Confirm the recovery is booked, then close";
    case "decided": {
      if (claim.disposition === "denied") return "Decide: escalate the denial or write it off";
      const rec = num(claim.recovered_amount) ?? 0;
      const approved = num(claim.approved_amount);
      if (approved !== null && rec < approved) return "Confirm reimbursement received";
      return "Record the recovery and close";
    }
    case "info_requested":
      return firstMissing
        ? `Respond to the request — ${firstMissing.label ?? firstMissing.slot_key} still needed`
        : "Respond to the platform request";
    case "submitted":
    case "waiting_external": {
      const follow = daysUntil(claim.follow_up_on, now);
      if (follow !== null && follow <= 0)
        return `Follow up with ${RECOVERY_SOURCE[claim.claim_type]}`;
      return `Waiting on ${RECOVERY_SOURCE[claim.claim_type]}`;
    }
    case "ready_to_submit":
      return `Submit ${CLAIM_TYPE_LABELS[claim.claim_type]} claim`;
    case "costing":
      return num(claim.actual_cost) !== null
        ? "Confirm the final amount and submit"
        : "Get vendor estimate or invoice";
    case "gathering":
      return firstMissing
        ? `Upload ${firstMissing.label ?? firstMissing.slot_key}`
        : "Confirm the repair or cleaning cost";
    case "potential":
    default:
      if (firstMissing) return `Upload ${firstMissing.label ?? firstMissing.slot_key}`;
      return "Set the claim type and deadline, then gather evidence";
  }
}

/**
 * The stage Resolve would suggest given the evidence and money on file. The
 * employee always confirms — Resolve never advances a claim on its own.
 */
export function proposeStage(claim: ClaimLike, requirements: RequirementLike[]): ClaimStage {
  if (!isOpenClaim(claim.stage) || claim.stage === "decided") return claim.stage;
  if (claim.stage === "info_requested" || isExternalWait(claim.stage)) return claim.stage;
  const progress = evidenceProgress(requirements);
  if (!progress.complete) return claim.stage === "potential" ? "gathering" : claim.stage;
  if (!hasCost(claim)) return "costing";
  return "ready_to_submit";
}

/* -------------------------------------------------------------------------
 * Claims Home buckets
 * ---------------------------------------------------------------------- */

export type ClaimBucket =
  | "needs_attention"
  | "evidence_missing"
  | "ready_to_submit"
  | "waiting_external"
  | "deadline_approaching"
  | "recently_recovered";

export const BUCKET_LABELS: Record<ClaimBucket, string> = {
  needs_attention: "Needs attention",
  evidence_missing: "Evidence missing",
  ready_to_submit: "Ready to submit",
  waiting_external: "Waiting on external party",
  deadline_approaching: "Deadline approaching",
  recently_recovered: "Recently recovered",
};

export const BUCKET_ORDER: ClaimBucket[] = [
  "needs_attention",
  "deadline_approaching",
  "evidence_missing",
  "ready_to_submit",
  "waiting_external",
  "recently_recovered",
];

const RECENT_DAYS = 30;

/**
 * Where a claim belongs on Claims Home. A claim appears in exactly one
 * section, so the page stays a work queue rather than a database dump.
 */
export function claimBucket(
  claim: ClaimLike,
  ctx: { requirements?: RequirementLike[]; now?: Date } = {},
): ClaimBucket | null {
  const now = ctx.now ?? new Date();
  const deadline = deadlineState(claim.deadline_on, now);

  if (!isOpenClaim(claim.stage)) {
    // Recoveries stay visible for a month so the team can see the wins land.
    if (
      claim.stage === "recovered" &&
      isRecent(claim.recovered_on ?? claim.updated_at ?? null, now)
    ) {
      return "recently_recovered";
    }
    return null;
  }

  if (deadline === "overdue" || deadline === "today") return "needs_attention";
  if (claim.stage === "info_requested") return "needs_attention";
  if (claim.stage === "decided") return "needs_attention";

  const follow = daysUntil(claim.follow_up_on, now);
  if (isExternalWait(claim.stage) && follow !== null && follow <= 0) return "needs_attention";

  if (deadline === "approaching") return "deadline_approaching";
  if (isExternalWait(claim.stage)) return "waiting_external";
  if (claim.stage === "ready_to_submit") return "ready_to_submit";

  const progress = evidenceProgress(ctx.requirements ?? []);
  if (progress.blocking.length > 0 || (ctx.requirements ?? []).length === 0)
    return "evidence_missing";
  return "ready_to_submit";
}

export function isRecent(iso: string | null | undefined, now = new Date()) {
  const d = daysUntil(iso, now);
  return d !== null && d <= 0 && d >= -RECENT_DAYS;
}

/** Soonest deadline first; claims with no clock fall to the end. */
export function claimSort(a: ClaimLike, b: ClaimLike) {
  const da = a.deadline_on ? new Date(a.deadline_on).getTime() : Number.MAX_SAFE_INTEGER;
  const db = b.deadline_on ? new Date(b.deadline_on).getTime() : Number.MAX_SAFE_INTEGER;
  if (da !== db) return da - db;
  return (amountAtRisk(b) ?? 0) - (amountAtRisk(a) ?? 0);
}

/* -------------------------------------------------------------------------
 * Manager oversight
 * ---------------------------------------------------------------------- */

export type ManagerFilter =
  | "unsubmitted"
  | "deadline_risk"
  | "overdue"
  | "high_value"
  | "evidence_missing"
  | "long_wait"
  | "denied_partial";

export const MANAGER_FILTER_LABELS: Record<ManagerFilter, string> = {
  unsubmitted: "Not yet submitted",
  deadline_risk: "Deadline approaching",
  overdue: "Deadline passed",
  high_value: "High value",
  evidence_missing: "Missing evidence",
  long_wait: "Waiting a long time",
  denied_partial: "Denied or partial",
};

export const HIGH_VALUE_FROM = 1000;
export const LONG_WAIT_DAYS = 14;

export function matchesFilter(
  claim: ClaimLike,
  filter: ManagerFilter,
  ctx: { requirements?: RequirementLike[]; now?: Date; highValueFrom?: number } = {},
): boolean {
  const now = ctx.now ?? new Date();
  switch (filter) {
    case "unsubmitted":
      return isOpenClaim(claim.stage) && !claim.submitted_on;
    case "deadline_risk": {
      const s = deadlineState(claim.deadline_on, now);
      return isOpenClaim(claim.stage) && (s === "approaching" || s === "today");
    }
    case "overdue":
      return isOpenClaim(claim.stage) && deadlineState(claim.deadline_on, now) === "overdue";
    case "high_value":
      return (
        isOpenClaim(claim.stage) &&
        (amountAtRisk(claim) ?? 0) >= (ctx.highValueFrom ?? HIGH_VALUE_FROM)
      );
    case "evidence_missing":
      return (
        isOpenClaim(claim.stage) && evidenceProgress(ctx.requirements ?? []).blocking.length > 0
      );
    case "long_wait": {
      if (!isExternalWait(claim.stage) || !claim.submitted_on) return false;
      const d = daysUntil(claim.submitted_on, now);
      return d !== null && d <= -LONG_WAIT_DAYS;
    }
    case "denied_partial":
      return claim.disposition === "denied" || claim.disposition === "partial";
    default:
      return false;
  }
}

/* -------------------------------------------------------------------------
 * Duplicate protection
 *
 * Warn, never block. One incident can legitimately need two recovery paths
 * (an insurance claim and a guest charge, for example).
 * ---------------------------------------------------------------------- */

export type DuplicateCandidate = ClaimLike & {
  title?: string | null;
  ownerrez_booking_id?: string | null;
};

export type DuplicateMatch = {
  claim: DuplicateCandidate;
  reason: string;
};

export function findDuplicates(
  draft: {
    claim_type?: ClaimType | null;
    property_id?: string | null;
    ticket_id?: string | null;
    ownerrez_booking_id?: string | null;
  },
  existing: DuplicateCandidate[],
): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  for (const claim of existing) {
    if (!isOpenClaim(claim.stage)) continue;
    if (draft.ticket_id && claim.ticket_id === draft.ticket_id) {
      matches.push({ claim, reason: "An open claim already exists for this ticket." });
      continue;
    }
    if (
      draft.claim_type &&
      claim.claim_type === draft.claim_type &&
      draft.property_id &&
      claim.property_id === draft.property_id &&
      draft.ownerrez_booking_id &&
      claim.ownerrez_booking_id === draft.ownerrez_booking_id
    ) {
      matches.push({ claim, reason: "An open claim of this type already exists for this stay." });
    }
  }
  return matches;
}

/* -------------------------------------------------------------------------
 * Formatting
 * ---------------------------------------------------------------------- */

export function formatMoney(value: number | string | null | undefined) {
  const n = num(value);
  if (n === null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(`${iso}`.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "3 days left", "2 days overdue", "due today". */
export function deadlineLabel(deadline: string | null | undefined, now = new Date()) {
  const d = daysUntil(deadline, now);
  if (d === null) return "No deadline recorded";
  if (d === 0) return "Due today";
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue`;
  return `${d} day${d === 1 ? "" : "s"} left`;
}

/* ---------------- Guided workflow (pass: claims workflow) ---------------- */

export type GuidedStep =
  | "evidence"
  | "ready"
  | "submitted"
  | "awaiting"
  | "decision"
  | "recovery_pending"
  | "closed";

export const GUIDED_STEP_LABELS: Record<GuidedStep, string> = {
  evidence: "Evidence gathering",
  ready: "Ready to submit",
  submitted: "Submitted",
  awaiting: "Awaiting decision",
  decision: "Decision received",
  recovery_pending: "Recovery pending",
  closed: "Closed",
};

export const GUIDED_STEPS: GuidedStep[] = [
  "evidence",
  "ready",
  "submitted",
  "awaiting",
  "decision",
  "recovery_pending",
  "closed",
];

type MoneyLike = {
  stage: ClaimStage;
  disposition?: ClaimDisposition | null;
  submitted_amount?: number | null;
  approved_amount?: number | null;
  recovered_amount?: number | null;
  nonrecovery_reason?: string | null;
  finance_treated_at?: string | null;
  leadership_decision_required?: boolean | null;
  leadership_decided_at?: string | null;
};

/** Pending Finance step for an unrecovered amount, or null when nothing is pending. */
export function financeTreatmentPending(c: MoneyLike): "treatment" | "leadership" | null {
  const requested = c.submitted_amount ?? c.approved_amount ?? 0;
  if (requested - (c.recovered_amount ?? 0) <= 0) return null;
  if (!c.finance_treated_at) return "treatment";
  if (c.leadership_decision_required && !c.leadership_decided_at) return "leadership";
  return null;
}

/** Amount still expected from the payer: approved minus received. Approval is not receipt. */
export function awaitingReceipt(c: MoneyLike): number {
  if (c.disposition !== "approved" && c.disposition !== "partial") return 0;
  return Math.max(0, (c.approved_amount ?? 0) - (c.recovered_amount ?? 0));
}

/**
 * Settled only when money in covers the request, or the shortfall is explained AND
 * Finance has recorded its treatment (plus any leadership decision). A written
 * reason or an approved waiver alone never settles a claim.
 */
export function financiallySettled(c: MoneyLike): boolean {
  const requested = c.submitted_amount ?? c.approved_amount ?? 0;
  const received = c.recovered_amount ?? 0;
  if (requested <= 0) return c.stage === "closed" && !!c.disposition;
  if (received >= requested) return true;
  return (
    awaitingReceipt(c) === 0 &&
    !!c.nonrecovery_reason?.trim() &&
    !!c.disposition &&
    financeTreatmentPending(c) === null
  );
}

/** Maps the stored stage onto the seven guided steps without rewriting data. */
export function guidedStep(c: MoneyLike): GuidedStep {
  switch (c.stage) {
    case "potential":
    case "gathering":
    case "costing":
      return "evidence";
    case "ready_to_submit":
      return "ready";
    case "submitted":
      return "submitted";
    case "waiting_external":
    case "info_requested":
      return "awaiting";
    case "decided":
    case "recovered":
      return awaitingReceipt(c) > 0 ? "recovery_pending" : "decision";
    case "closed":
      return "closed";
  }
}

export type DeadlineVerification = "unknown" | "needs_verification" | "verified";

export function deadlineVerification(date: string | null | undefined, verified: boolean): DeadlineVerification {
  if (!date) return "unknown";
  return verified ? "verified" : "needs_verification";
}

/** Net received for a claim from append-only ledger rows (corrections are negative rows). */
export function ledgerTotal(rows: Array<{ received_amount: number }>): number {
  return rows.reduce((s, r) => s + Number(r.received_amount || 0), 0);
}
