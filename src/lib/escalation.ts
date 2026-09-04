/**
 * Escalation — asking for judgement without giving up the work.
 *
 * Escalation is deliberately *not* reassignment. Raising one records that a
 * decision is needed and tells the right person; the underlying ticket keeps
 * its owner unless the recipient explicitly takes it over.
 *
 * The ladder is fixed: a coordinator escalates to a Supervisor, a Supervisor
 * escalates to the Director. Nobody skips a rung.
 */

export type EscalationTarget = "supervisor" | "director";

export const ESCALATION_TARGET_LABELS: Record<EscalationTarget, string> = {
  supervisor: "Operations Supervisor",
  director: "Director of Operations",
};

export type EscalationUrgency = "normal" | "high" | "critical";

export const ESCALATION_URGENCIES: { value: EscalationUrgency; label: string; hint: string }[] = [
  { value: "normal", label: "Normal", hint: "Needs a decision today." },
  { value: "high", label: "High", hint: "Blocking work right now." },
  { value: "critical", label: "Critical", hint: "Guest safety, or the home is unusable." },
];

export type EscalationOutcome = "guidance" | "takeover" | "reassigned";

export const ESCALATION_OUTCOMES: {
  value: EscalationOutcome;
  label: string;
  hint: string;
}[] = [
  {
    value: "guidance",
    label: "Give guidance and return",
    hint: "You answer the question and the work goes back to whoever raised it.",
  },
  {
    value: "takeover",
    label: "Take ownership",
    hint: "You become the assignee. The ticket moves to your queue.",
  },
  {
    value: "reassigned",
    label: "Direct it to someone else",
    hint: "You choose who should carry this next and say what they should do.",
  },
];

export function escalationOutcomeLabel(outcome: string | null | undefined) {
  return ESCALATION_OUTCOMES.find((o) => o.value === outcome)?.label ?? "Resolved";
}

/**
 * Which rungs a person may escalate to, and why a rung is closed to them.
 *
 * A coordinator sees Director listed but disabled — the ladder should be
 * visible so nobody wonders whether it exists.
 */
export function escalationTargetsFor(opts: {
  isSupervisor: boolean;
}): { value: EscalationTarget; label: string; enabled: boolean; hint?: string }[] {
  return [
    {
      value: "supervisor",
      label: ESCALATION_TARGET_LABELS.supervisor,
      enabled: true,
      hint: opts.isSupervisor
        ? "Hand this to another supervisor for a decision."
        : "Your first stop for anything you cannot decide.",
    },
    {
      value: "director",
      label: ESCALATION_TARGET_LABELS.director,
      enabled: opts.isSupervisor,
      ...(opts.isSupervisor
        ? { hint: "Unusual situations, vendor or system decisions, exceptions." }
        : { hint: "Supervisor escalation required first" }),
    },
  ];
}

export type EscalationDraft = {
  escalated_to_role: EscalationTarget;
  reason: string;
  already_tried: string;
  help_needed: string;
  urgency: EscalationUrgency;
};

/** Everything an escalation must carry before it is worth sending. */
export function validateEscalation(draft: Partial<EscalationDraft>): string | null {
  if (!draft.escalated_to_role) return "Choose who this is going to.";
  if (!String(draft.reason ?? "").trim()) return "Say what the problem is.";
  if (String(draft.reason ?? "").trim().length < 10)
    return "Give a bit more detail about the problem.";
  if (!String(draft.already_tried ?? "").trim()) return "Say what you have already tried.";
  if (!String(draft.help_needed ?? "").trim())
    return "Say what decision or help you need.";
  return null;
}

export type EscalationRow = {
  id: string;
  ticket_id: string | null;
  work_order_id: string | null;
  property_id: string | null;
  escalated_by: string;
  escalated_to_role: string;
  escalated_to: string | null;
  reason: string;
  already_tried: string | null;
  help_needed: string | null;
  urgency: string;
  status: string;
  outcome: string | null;
  outcome_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  is_demo?: boolean | null;
};

/** Escalations a given person should be looking at right now. */
export function escalationsForRole(
  rows: EscalationRow[],
  opts: { isSupervisor: boolean; isDirector: boolean },
) {
  return rows.filter((r) => {
    if (r.status !== "open") return false;
    if (r.escalated_to_role === "director") return opts.isDirector;
    return opts.isSupervisor;
  });
}
