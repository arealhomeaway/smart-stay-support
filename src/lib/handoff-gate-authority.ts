/**
 * Who may pass each of the four handoff gates.
 *
 * The sequence is fixed and nobody shortcuts it:
 *   the assigned PM submits the readiness record
 *     -> Onboarding Director approves onboarding readiness
 *     -> Operations Director approves operational readiness
 *     -> Operations formally accepts the property
 *     -> Operations Supervisor confirms Live.
 *
 * People are never named here: each role maps to whoever holds that seat
 * in the team roles list, which leadership can change at any time.
 *
 * Two separations are enforced here and again in the database:
 *  1. The project manager who submitted the handoff never approves it —
 *     "the checklist is done" is not "the property is live".
 *  2. One person does not stand in for two different review roles on the same
 *     handoff. Acceptance and Live confirmation are the single exception:
 *     both belong to the Operations Supervisor by design.
 */

export const HANDOFF_GATES = [
  {
    step: "kati_review",
    order: 1,
    label: "Director of Onboarding review",
    role: "Director of Onboarding",
    holder: "Current Onboarding Director",
  },
  {
    step: "micah_review",
    order: 2,
    label: "Operational Readiness Review",
    role: "Director of Operations",
    holder: "Current Operations Director",
  },
  {
    step: "operations_acceptance",
    order: 3,
    label: "Operations acceptance",
    role: "Operations Supervisor",
    holder: "Current Operations Supervisor and the receiving Operations team",
  },
  {
    step: "live_confirmation",
    order: 4,
    label: "Live confirmation",
    role: "Operations Supervisor",
    holder: "Current Operations Supervisor",
  },
] as const;

export type HandoffGateStep = (typeof HANDOFF_GATES)[number]["step"];

export const HANDOFF_GATE_STEPS = HANDOFF_GATES.map((g) => g.step) as HandoffGateStep[];

export function handoffGate(step: string | null | undefined) {
  return HANDOFF_GATES.find((g) => g.step === step) ?? null;
}

/** The gate that follows this one, or "complete" after Live confirmation. */
export function nextHandoffGate(step: string): HandoffGateStep | "complete" | null {
  const gate = handoffGate(step);
  if (!gate) return null;
  return (HANDOFF_GATES.find((g) => g.order === gate.order + 1)?.step ?? "complete") as
    | HandoffGateStep
    | "complete";
}

/** The two gates the Operations Supervisor legitimately holds together. */
function sameRoleGates(a: string, b: string) {
  const pair = ["operations_acceptance", "live_confirmation"];
  return a === b || (pair.includes(a) && pair.includes(b));
}

export type PriorReview = {
  step: string;
  decision: string;
  reviewerId: string | null;
};

export type GateAuthorityInput = {
  /** The gate the handoff is actually sitting at. */
  gateStep: string | null;
  /** The gate the viewer is trying to decide. */
  step?: string | null;
  viewerId: string | null;
  /** Does the viewer hold the seat this gate belongs to? */
  holdsSeat: boolean;
  /** Who submitted the readiness record. */
  requestedBy: string | null;
  /** The project manager on the onboarding project. */
  projectManagerId: string | null;
  /** Decisions already recorded against this handoff. */
  priorReviews: PriorReview[];
};

export type GateAuthority = { ok: true } | { ok: false; reason: string };

export function gateReviewAuthority(input: GateAuthorityInput): GateAuthority {
  const step = input.step ?? input.gateStep;
  const gate = handoffGate(step);
  if (!gate) return { ok: false, reason: "This handoff is not at a review gate." };
  if (step !== input.gateStep)
    return {
      ok: false,
      reason: `This handoff is at ${handoffGate(input.gateStep)?.label ?? "an earlier gate"}. Gates are passed in order.`,
    };
  if (!input.viewerId) return { ok: false, reason: "Sign in to record a handoff review." };
  if (input.viewerId === input.requestedBy)
    return {
      ok: false,
      reason:
        "You submitted this handoff. The project manager cannot approve their own handoff — it goes to the Director of Onboarding first.",
    };
  if (input.viewerId === input.projectManagerId)
    return {
      ok: false,
      reason:
        "You are the project manager on this home. Someone else has to approve the handoff.",
    };
  if (!input.holdsSeat)
    return { ok: false, reason: `${gate.label} belongs to the ${gate.role} (${gate.holder}).` };
  const clash = input.priorReviews.find(
    (r) =>
      r.decision === "accepted" &&
      r.reviewerId &&
      r.reviewerId === input.viewerId &&
      !sameRoleGates(r.step, gate.step),
  );
  if (clash)
    return {
      ok: false,
      reason: `You already passed ${handoffGate(clash.step)?.label ?? "an earlier gate"} on this handoff. Each review role signs for itself.`,
    };
  return { ok: true };
}

/** Progress of the four gates, for display. */
export function handoffGateChain(gateStep: string | null, accepted: boolean) {
  const current = accepted ? "complete" : gateStep;
  const index = HANDOFF_GATES.findIndex((g) => g.step === current);
  return HANDOFF_GATES.map((g, i) => ({
    ...g,
    state: current === "complete" || (index >= 0 && i < index) ? "done" : i === index ? "current" : "upcoming",
  }));
}
