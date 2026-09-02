/**
 * Derived Next Action for a Ticket.
 *
 * Pure and deterministic. It reads state the ticket already carries and says
 * the one thing to do next, in the coordinator's words. It grants no
 * authority, changes no clocks and decides nothing about closure — the SLA,
 * evidence and closure engines remain the source of truth.
 */

export type TicketNextActionInput = {
  status: string | null | undefined;
  acknowledged_at: string | null | undefined;
  action_started_at: string | null | undefined;
  waiting_on?: string | null;
  guest_in_residence?: boolean | null;
  vendor_name?: string | null;
  vendor_status?: string | null;
  /** Required playbook steps that are still open. */
  requiredOpenSteps?: number;
  /** True when the work type asks for closure evidence that is not on file. */
  missingClosureEvidence?: boolean;
};

export type TicketNextAction = {
  /** Short imperative — what to do now. */
  label: string;
  /** Why this is next, in one plain sentence. */
  because: string;
  /** What comes after, when it is knowable. */
  then?: string;
};

export function ticketNextAction(t: TicketNextActionInput): TicketNextAction | null {
  const status = t.status ?? "open";
  if (status === "closed") return null;

  if (!t.acknowledged_at) {
    return {
      label: "Acknowledge this ticket",
      because: "Nobody has confirmed we have it yet.",
      then: "Then start the work and tell the guest what to expect.",
    };
  }

  if (status === "waiting") {
    return {
      label: "Chase whoever we are waiting on",
      because: t.waiting_on
        ? `This is parked on ${t.waiting_on.replace(/_/g, " ")} — the clock is paused, not finished.`
        : "This is parked on someone else — the clock is paused, not finished.",
      then: "Then pick the work back up as soon as they answer.",
    };
  }

  if (!t.action_started_at) {
    return {
      label: "Start the work",
      because: "It is acknowledged but nothing has actually moved yet.",
      ...(t.guest_in_residence ? { then: "Then update the guest." } : {}),
    };
  }

  if (t.vendor_name && t.vendor_status && t.vendor_status !== "completed") {
    return {
      label: `Check in with ${t.vendor_name}`,
      because: "A vendor is engaged and has not reported the work complete.",
      then: "Then confirm the fix and update the guest.",
    };
  }

  if ((t.requiredOpenSteps ?? 0) > 0) {
    return {
      label: "Work the remaining playbook steps",
      because: `${t.requiredOpenSteps} required step${(t.requiredOpenSteps ?? 0) === 1 ? "" : "s"} still open.`,
      then: "Then close it out.",
    };
  }

  if (t.missingClosureEvidence) {
    return {
      label: "Add the evidence this work needs",
      because: "The work looks done, but the required evidence is not on file yet.",
      then: "Then close it out.",
    };
  }

  if (status === "resolved" || status === "awaiting_guest") {
    return {
      label: "Close it out",
      because: "The work is done and nothing is blocking closure.",
    };
  }

  return {
    label: t.guest_in_residence ? "Update the guest" : "Keep the work moving",
    because: t.guest_in_residence
      ? "Someone is in the home waiting to hear from us."
      : "Work has started and nothing is blocking it.",
    then: "Then close it out when it is genuinely done.",
  };
}
