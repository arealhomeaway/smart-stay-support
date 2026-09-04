/**
 * One authoritative lifecycle for every ticket status change.
 *
 * Before this module each surface enforced its own rules: Current Work checked
 * closure evidence, the Waiting sheet checked a review date, and the supervisor
 * status menu checked nothing at all — so a supervisor could set "Dispatched"
 * with no work order, "Waiting" with no dependency, or "Resolved" with no
 * summary. Every write now runs through `validateTicketTransition`, and the only
 * way past a rule is a *named* exception that a privileged role must justify.
 *
 * This file is pure and browser-safe so the UI can grey out an action for the
 * same reason the server would refuse it.
 */

import { FINAL_REVIEW_SATISFIED } from "@/lib/final-review";

export const TICKET_STATUSES = [
  "open",
  "dispatched",
  "in_progress",
  "waiting",
  "awaiting_guest",
  "resolved",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function isTicketStatus(value: string): value is TicketStatus {
  return (TICKET_STATUSES as readonly string[]).includes(value);
}

/** How each status is named to people — never show the raw value. */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  dispatched: "Dispatched",
  in_progress: "In progress",
  waiting: "Waiting on someone",
  awaiting_guest: "Awaiting guest confirmation",
  resolved: "Resolved",
  closed: "Closed",
};

export function ticketStatusLabel(status: string): string {
  return isTicketStatus(status) ? TICKET_STATUS_LABELS[status] : status;
}


/**
 * Resolved vs Closed — one meaning, everywhere.
 *
 * Resolved: frontline work is finished. If the ticket needs Final Review it is
 * waiting on a supervisor; if it does not, it can be closed straight away. It
 * is out of the working queues either way.
 * Closed: nothing further is expected from anyone.
 */
export const WORKING_STATUSES: TicketStatus[] = [
  "open",
  "dispatched",
  "in_progress",
  "waiting",
  "awaiting_guest",
];
/** Not in anyone's working queue: resolved and closed both count as finished work. */
export const FINISHED_STATUSES: TicketStatus[] = ["resolved", "closed"];

export function isWorkingStatus(status: string) {
  return (WORKING_STATUSES as string[]).includes(status);
}
/** True once frontline work is done — resolved *or* closed. */
export function isFinished(status: string) {
  return (FINISHED_STATUSES as string[]).includes(status);
}
/** Only `closed` is terminal: a resolved ticket may still owe Final Review. */
export function isTerminal(status: string) {
  return status === "closed";
}

/** Named exceptions. A privileged role may use one, with a written reason. */
export const LIFECYCLE_EXCEPTIONS = {
  dispatch_prerequisites: "Dispatch without a recorded work order",
  guest_confirmation_prerequisites: "Await guest confirmation without recorded guest contact",
  closure_requirements: "Resolve without the required closure evidence",
  closure_qa: "Close without a review",
} as const;
export type LifecycleException = keyof typeof LIFECYCLE_EXCEPTIONS;

export function isLifecycleException(value: string): value is LifecycleException {
  return Object.prototype.hasOwnProperty.call(LIFECYCLE_EXCEPTIONS, value);
}


/** Everything the validator needs to judge a transition, gathered by the caller. */
export type LifecycleFacts = {
  status: string;
  /** Field/vendor work is part of this ticket, so dispatch means something. */
  requiresFieldWork: boolean;
  /** A work order, Breezeway task or vendor assignment exists. */
  hasDispatchObject: boolean;
  /** Somebody or somewhere to send it to. */
  hasDispatchDestination: boolean;
  /** What the vendor is being asked to do. */
  hasDispatchScope: boolean;
  /** Money above an approval threshold is still unapproved. */
  dispatchApprovalPending: boolean;

  waiting_on?: string | null;
  waiting_reason?: string | null;
  next_review_at?: string | null;

  hasGuestContext: boolean;
  guestCommunicationRecorded: boolean;

  /** Free-text closure evidence description the coordinator wrote. */
  closureEvidenceText?: string | null;
  /** The work type asks for closure evidence at all. */
  requiresClosureEvidence: boolean;
  /** The work type asks specifically for a photo or file. */
  requiresClosureFile: boolean;
  /** A qualifying attachment is actually linked to this ticket. */
  hasQualifyingFile: boolean;
  /** Resolution notes / closure summary. */
  hasClosureSummary: boolean;
  /** Required playbook steps are all ticked. */
  requiredStepsComplete: boolean;

  /** The stored Final Review outcome (column is still `closure_qa_result`). */
  closureQaResult?: string | null;
  /**
   * Whether this ticket needs Final Review at all. Left undefined it is
   * treated as required, so nothing slips through when a caller has not
   * worked the rule out yet.
   */
  finalReviewRequired?: boolean;

};

export type LifecycleVerdict =
  | { ok: true; exception?: LifecycleException }
  | { ok: false; code: string; message: string; exception: LifecycleException | null };

function fail(
  code: string,
  message: string,
  exception: LifecycleException | null = null,
): LifecycleVerdict {
  return { ok: false, code, message, exception };
}

/** Is the review date usable — present, parseable and in the future? */
export function reviewDateProblem(value: string | null | undefined, now = new Date()): string | null {
  if (!value || !String(value).trim()) return "Set a review date so this doesn't disappear.";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "That review date could not be read. Pick it again.";
  // One minute of slack so a date chosen "now" is not rejected by the round trip.
  if (parsed.getTime() <= now.getTime() - 60_000)
    return "The review date needs to be in the future.";
  return null;
}

/**
 * The single gate. `to` is the status being requested; `facts` describes the
 * ticket as it stands. Returns ok, or the reason and which named exception (if
 * any) a privileged role could invoke.
 */
export function validateTicketTransition(
  to: string,
  facts: LifecycleFacts,
  now: Date = new Date(),
): LifecycleVerdict {
  if (!isTicketStatus(to)) return fail("unknown_status", `"${to}" is not a ticket status.`);
  const from = facts.status;
  if (from === to) return { ok: true };

  if (isTerminal(from) && to !== "closed")
    return fail(
      "reopen_required",
      "This ticket is closed. Reopen it before changing its status.",
      null,
    );

  switch (to) {
    case "open":
    case "in_progress":
      return { ok: true };

    case "dispatched": {
      if (!facts.requiresFieldWork)
        return fail(
          "dispatch_not_applicable",
          "Nothing on this ticket needs field or vendor work, so there is nothing to dispatch.",
          "dispatch_prerequisites",
        );
      if (!facts.hasDispatchObject)
        return fail(
          "dispatch_no_work_order",
          "Create the repair / work order first — dispatch records where the work went.",
          "dispatch_prerequisites",
        );
      if (!facts.hasDispatchDestination)
        return fail(
          "dispatch_no_destination",
          "Choose who this is going to before marking it dispatched.",
          "dispatch_prerequisites",
        );
      if (!facts.hasDispatchScope)
        return fail(
          "dispatch_no_scope",
          "Write the scope of work so the vendor knows what they were sent for.",
          "dispatch_prerequisites",
        );
      if (facts.dispatchApprovalPending)
        return fail(
          "dispatch_awaiting_approval",
          "This repair still needs approval at its cost tier before it can be dispatched.",
          "dispatch_prerequisites",
        );
      return { ok: true };
    }

    case "waiting": {
      if (!facts.waiting_on || !String(facts.waiting_on).trim())
        return fail("waiting_no_dependency", "Say who this is waiting on.");
      if (!facts.waiting_reason || !String(facts.waiting_reason).trim())
        return fail("waiting_no_reason", "Say what you are waiting for.");
      const problem = reviewDateProblem(facts.next_review_at, now);
      if (problem) return fail("waiting_no_review_date", problem);
      return { ok: true };
    }

    case "awaiting_guest": {
      if (!facts.hasGuestContext)
        return fail(
          "guest_no_context",
          "There is no guest or reservation on this ticket, so there is nothing to await confirmation of.",
          "guest_confirmation_prerequisites",
        );
      if (!facts.guestCommunicationRecorded)
        return fail(
          "guest_no_communication",
          "Record the message you sent the guest before waiting on their confirmation.",
          "guest_confirmation_prerequisites",
        );
      return { ok: true };
    }

    case "resolved": {
      if (!facts.hasClosureSummary)
        return fail(
          "closure_no_summary",
          "Write what happened before resolving this ticket.",
          "closure_requirements",
        );
      if (!facts.requiredStepsComplete)
        return fail(
          "closure_steps_open",
          "Required steps on this ticket are still open.",
          "closure_requirements",
        );
      if (facts.requiresClosureEvidence && !String(facts.closureEvidenceText ?? "").trim())
        return fail(
          "closure_no_evidence",
          "This work type needs closure evidence before it can be resolved.",
          "closure_requirements",
        );
      if (facts.requiresClosureFile && !facts.hasQualifyingFile)
        return fail(
          "closure_no_file",
          "This work type needs a photo or file attached — a description on its own is not evidence.",
          "closure_requirements",
        );
      return { ok: true };
    }

    case "closed": {
      if (from !== "resolved")
        return fail(
          "close_before_resolved",
          "Resolve the ticket first — closing comes after the work is finished.",
          null,
        );
      // Selective review: only elevated-risk work waits on a supervisor.
      if (facts.finalReviewRequired === false) return { ok: true };
      if (!FINAL_REVIEW_SATISFIED.has(String(facts.closureQaResult ?? "not_reviewed")))
        return fail(
          "close_qa_outstanding",
          "A supervisor needs to review this ticket before it can be closed.",
          "closure_qa",
        );
      return { ok: true };
    }


    default:
      return fail("unknown_status", `"${to}" is not a ticket status.`);
  }
}

/** Which statuses a control may offer, given the ticket and whether exceptions are available. */
export function allowedTransitions(
  facts: LifecycleFacts,
  opts: { allowExceptions?: boolean } = {},
): TicketStatus[] {
  return TICKET_STATUSES.filter((s) => {
    if (s === facts.status) return true;
    const verdict = validateTicketTransition(s, facts);
    if (verdict.ok) return true;
    return Boolean(opts.allowExceptions) && verdict.exception !== null;
  });
}

/**
 * History is written by many code paths over a long beta, and a few older
 * rows stored the raw system word ("in_progress", "awaiting_guest"). Nobody
 * should ever read those, so history text is humanized at render time as well
 * as at write time — that repairs the rows already on file instead of leaving
 * a permanent mixed feed.
 */
export function humanizeHistoryText(body: string | null | undefined): string {
  if (!body) return "";
  let out = body;
  for (const status of TICKET_STATUSES) {
    if (!status.includes("_")) continue;
    out = out.replace(new RegExp(`\\b${status}\\b`, "g"), TICKET_STATUS_LABELS[status]);
  }
  // Single-word system statuses ("waiting", "resolved") are ordinary English
  // elsewhere in a sentence, so they are only repaired where the sentence is
  // plainly reporting a status change.
  out = out.replace(
    /\bStatus changed to ([a-z_]+)\b/g,
    (whole, word: string) =>
      (TICKET_STATUSES as readonly string[]).includes(word)
        ? `Status changed to ${TICKET_STATUS_LABELS[word as TicketStatus]}`
        : whole,
  );
  return out;
}

