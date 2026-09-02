/**
 * Deterministic contextual Playbook resolver.
 *
 * Given normalised operational facts, decide which approved Playbook explains
 * the work in front of the person right now. Pure function: no AI, no network,
 * no database. The caller supplies both the candidate Playbooks and the live
 * facts it derived from the policy engines, so this file never reads a
 * threshold or an SLA itself.
 *
 * Precedence, asserted by tests: workflow state and the policy engines always
 * win. A Playbook only ever adds judgment on top; it can never contradict a
 * computed authority, deadline or closure gate.
 */

import {
  driftWarnings,
  hasAuthoredGuidance,
  isApproved,
  type AuthoredPlaybook,
  type PlaybookCondition,
  type PlaybookSubject,
} from "@/lib/playbooks";


export type MatchContext = {
  objectType: PlaybookSubject;
  /** Work type name as stored on the object, if known. */
  workTypeName?: string | null;
  /** Ticket category. */
  category?: string | null;
  /** Situation id chosen at intake, from `src/lib/situations.ts`. */
  situationId?: string | null;
  priority?: "p1" | "p2" | "p3" | null;
  /** A guest is currently in the home. */
  guestInHome?: boolean;
  /** The stay is materially affected (arrival at risk, night lost, relocation). */
  stayImpacted?: boolean;
  /** Computed by the maintenance policy engine, never by a Playbook. */
  ownerApprovalRequired?: boolean;
  /** Emergency mitigation is authorised ahead of the permanent repair. */
  emergencyMitigation?: boolean;
  warrantyApplies?: boolean;
  vendorMisses?: number;
  evidenceComplete?: boolean;
  /** From the claims/recovery deadline helpers. */
  deadlineState?: "none" | "approaching" | "overdue" | null;
  /** Derived escalation flags already computed upstream. */
  escalationFlags?: string[];
  /** Property special handling text, surfaced live and never copied. */
  propertySpecialHandling?: string[];
};

export type MatchedPlaybook = {
  playbook: AuthoredPlaybook;
  /** Plain-language explanation of why this Playbook matched. */
  reason: string;
  score: number;
  hasApprovedGuidance: boolean;
  /** Authored text that conflicts with the policy engine's job. */
  driftWarnings: string[];
};

export type MatchResult = {
  primary: MatchedPlaybook | null;
  /** At most two quieter references. */
  secondary: MatchedPlaybook[];
  /** True when a primary match carries approved authored judgment. */
  hasApprovedGuidance: boolean;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function conditionHolds(condition: PlaybookCondition, ctx: MatchContext): boolean {
  switch (condition) {
    case "guest_in_home":
      return Boolean(ctx.guestInHome);
    case "stay_impacted":
      return Boolean(ctx.stayImpacted);
    case "owner_approval_required":
      return Boolean(ctx.ownerApprovalRequired);
    case "emergency_mitigation":
      return Boolean(ctx.emergencyMitigation);
    case "warranty_applies":
      return Boolean(ctx.warrantyApplies);
    case "vendor_missed":
      return (ctx.vendorMisses ?? 0) > 0;
    case "evidence_incomplete":
      return ctx.evidenceComplete === false;
    case "deadline_approaching":
      return ctx.deadlineState === "approaching" || ctx.deadlineState === "overdue";
    case "escalated":
      return (ctx.escalationFlags ?? []).length > 0;
    default:
      return false;
  }
}

const CONDITION_LABEL: Record<PlaybookCondition, string> = {
  guest_in_home: "a guest is in the home",
  stay_impacted: "the stay is affected",
  owner_approval_required: "owner approval is required",
  emergency_mitigation: "emergency mitigation applies",
  warranty_applies: "warranty may cover this",
  vendor_missed: "a vendor missed a commitment",
  evidence_incomplete: "evidence is still missing",
  deadline_approaching: "a platform deadline is close",
  escalated: "an escalation trigger is active",
};

/**
 * Score one Playbook against the context. Returns null when any declared
 * matcher facet fails — a Playbook never applies "partly".
 */
function scoreOne(pb: AuthoredPlaybook, ctx: MatchContext): MatchedPlaybook | null {
  // Only approved guidance ever reaches the frontline, and never before the
  // day leadership said it takes effect.
  if (!isApproved(pb)) return null;

  const subjects = pb.matcher.objects ?? pb.applies_to;
  if (!subjects.includes(ctx.objectType)) return null;

  const m = pb.matcher;
  const reasons: string[] = [];
  let score = 0;


  if (m.situations?.length) {
    if (!ctx.situationId || !m.situations.map(norm).includes(norm(ctx.situationId))) return null;
    score += 5;
    reasons.push("the situation selected at intake");
  }

  if (m.work_types?.length) {
    if (!ctx.workTypeName || !m.work_types.map(norm).includes(norm(ctx.workTypeName))) return null;
    score += 4;
    reasons.push(`the work type "${ctx.workTypeName}"`);
  }

  if (m.categories?.length) {
    if (!ctx.category || !m.categories.map(norm).includes(norm(ctx.category))) return null;
    score += 2;
    reasons.push("the ticket category");
  }

  if (m.priorities?.length) {
    if (!ctx.priority || !m.priorities.includes(ctx.priority)) return null;
    score += 2;
    reasons.push(`priority ${ctx.priority.toUpperCase()}`);
  }

  for (const condition of m.requires ?? []) {
    // A condition Resolve does not understand must not silently disqualify the
    // whole Playbook — that hid good guidance for a single typo.
    if (!(condition in CONDITION_LABEL)) continue;
    if (!conditionHolds(condition, ctx)) return null;
    score += 3;
    reasons.push(CONDITION_LABEL[condition] ?? condition);
  }

  // An explicit object scope is itself a deliberate statement of relevance.
  if (score === 0 && m.objects?.length) {
    score += 1;
    reasons.push("the kind of work this is");
  }


  // A Playbook with no matcher at all is a library entry, not contextual.
  if (score === 0) return null;

  const approved = hasAuthoredGuidance(pb);
  // Approved judgment content is what makes guidance worth showing first.
  if (approved) score += 1;

  return {
    playbook: pb,
    reason: `Matched on ${reasons.join(", ")}.`,
    score,
    hasApprovedGuidance: approved,
    driftWarnings: driftWarnings(pb),
  };
}

/**
 * Resolve one primary Playbook plus up to two quieter references.
 *
 * The primary is the highest-scoring match; ties break towards the Playbook
 * carrying approved authored guidance, then by title so the result is stable.
 */
export function matchPlaybook(playbooks: AuthoredPlaybook[], ctx: MatchContext): MatchResult {
  const matches = playbooks
    .map((pb) => scoreOne(pb, ctx))
    .filter((m): m is MatchedPlaybook => m !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.hasApprovedGuidance !== b.hasApprovedGuidance) return a.hasApprovedGuidance ? -1 : 1;
      return a.playbook.title.localeCompare(b.playbook.title);
    });

  const [primary, ...rest] = matches;
  return {
    primary: primary ?? null,
    secondary: rest.slice(0, 2),
    hasApprovedGuidance: Boolean(primary?.hasApprovedGuidance),
  };
}

/** Copy shown when the scenario is understood but no Playbook is approved. */
export const NO_APPROVED_GUIDANCE = "No approved Playbook exists for this scenario.";
