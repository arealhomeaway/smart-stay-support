/**
 * The one Current Action on a ticket — what to do now, what Resolve needs
 * you to write down, and what happens the moment you finish it.
 *
 * Pure and deterministic. It reads state the ticket already carries and
 * grants no authority: the SLA, evidence and closure engines stay the source
 * of truth. Where the next step belongs to another panel (playbook steps,
 * a field repair, closure), this hands off instead of inventing a form.
 */

import type { ActionField, GuidedAction } from "@/lib/guided-action";

export type {
  ActionField,
  ActionFieldType,
  ActionValues,
  GuidedAction,
} from "@/lib/guided-action";
export { fieldApplies, validateAction } from "@/lib/guided-action";

export type CurrentActionId =
  | "acknowledge"
  | "start_work"
  | "waiting_followup"
  | "vendor_checkin"
  | "guest_update"
  | "work_steps"
  | "add_evidence"
  | "field_repair"
  | "verify_fix"
  | "close_out";

export type CurrentAction = GuidedAction<CurrentActionId, "steps" | "repair" | "verify" | "closure">;

export type CurrentActionInput = {
  status: string | null | undefined;
  closed_at?: string | null;
  resolved_at?: string | null;
  acknowledged_at: string | null | undefined;
  action_started_at: string | null | undefined;
  waiting_on?: string | null;
  waiting_reason?: string | null;
  next_review_at?: string | null;
  guest_in_residence?: boolean | null;
  guest_confirmed?: boolean | null;
  vendor_name?: string | null;
  vendor_status?: string | null;
  /** A field repair exists and has not been reported complete. */
  repairActive?: boolean;
  /** The work plausibly needs a field repair and none has been raised. */
  repairPossible?: boolean;
  /** Required playbook steps still open. */
  requiredOpenSteps?: number;
  /** The work type asks for closure evidence that is not on file. */
  missingClosureEvidence?: boolean;
};

const WAITING_WHO: Record<string, string> = {
  guest: "the guest",
  owner: "the owner",
  vendor: "the vendor",
  approval: "whoever has to approve it",
  parts: "the parts or delivery",
  delivery: "the delivery",
  scheduled: "the scheduled date",
  internal: "someone on the team",
  other: "someone else",
};

export function waitingWho(code: string | null | undefined) {
  if (!code) return "someone else";
  return WAITING_WHO[code] ?? code.replace(/_/g, " ");
}

/** Actions the Complete & Advance flow can finish itself. */
export const COMPLETABLE: CurrentActionId[] = [
  "acknowledge",
  "start_work",
  "waiting_followup",
  "vendor_checkin",
  "guest_update",
];

export function isCompletable(id: CurrentActionId) {
  return COMPLETABLE.includes(id);
}

export function ticketCurrentAction(t: CurrentActionInput): CurrentAction | null {
  const status = t.status ?? "open";
  if (status === "closed" || t.closed_at) return null;

  if (!t.acknowledged_at) {
    return {
      id: "acknowledge",
      title: "Acknowledge this ticket",
      because: "Nobody has confirmed we have it yet, and the response clock is running.",
      then: "Then you'll say what you're doing first.",
      completeLabel: "Acknowledge & advance",
      fields: [
        {
          name: "note",
          label: "Anything worth noting (optional)",
          type: "text",
          required: false,
        },
      ],
    };
  }

  if (status === "waiting") {
    const who = waitingWho(t.waiting_on);
    return {
      id: "waiting_followup",
      title: `Follow up with ${who}`,
      because: t.waiting_reason
        ? `${t.waiting_reason} — the clock is paused, not finished.`
        : "This is parked with someone else — the clock is paused, not finished.",
      then: "Either it comes back to you now, or it's parked again with a new follow-up time.",
      completeLabel: "Record & advance",
      fields: [
        {
          name: "update",
          label: "What happened when you followed up",
          type: "longtext",
          required: true,
          minLength: 5,
        },
        {
          name: "outcome",
          label: "Where does it stand?",
          type: "choice",
          required: true,
          options: [
            { value: "resume", label: "It's unblocked — pick the work back up" },
            { value: "still_waiting", label: "Still waiting — park it again" },
          ],
        },
        {
          name: "next_review_at",
          label: "When should it come back to you?",
          type: "datetime",
          required: true,
          showWhen: { field: "outcome", equals: ["still_waiting"] },
          help: "Nothing parked is allowed to disappear.",
        },
      ],
    };
  }

  if (!t.action_started_at) {
    return {
      id: "start_work",
      title: "Start the work",
      because: "It's acknowledged but nothing has actually moved yet.",
      then: t.guest_in_residence ? "Then you'll update the guest." : "Then work it through.",
      completeLabel: "Start & advance",
      fields: [
        {
          name: "first_step",
          label: "What you're doing first",
          type: "longtext",
          required: true,
          minLength: 5,
          help: "One line is enough — it becomes the first entry in the ticket's history.",
        },
      ],
    };
  }

  if (t.repairActive) {
    return {
      id: "field_repair",
      title: "The field team has it",
      because: "A repair is open and hasn't been reported complete.",
      then: "Then confirm the fix with the guest.",
      completeLabel: "Open the repair",
      fields: [],
      handoff: { label: "Go to the repair", target: "repair" },
    };
  }

  if (t.vendor_name && t.vendor_status && t.vendor_status !== "completed") {
    return {
      id: "vendor_checkin",
      title: `Check in with ${t.vendor_name}`,
      because: "A vendor is engaged and hasn't reported the work complete.",
      then: "Then confirm the fix and update the guest.",
      completeLabel: "Record & advance",
      fields: [
        {
          name: "update",
          label: "What the vendor said",
          type: "longtext",
          required: true,
          minLength: 5,
        },
        {
          name: "vendor_state",
          label: "Where does the work stand?",
          type: "choice",
          required: true,
          options: [
            { value: "in_progress", label: "Still working on it" },
            { value: "completed", label: "Vendor says it's done" },
          ],
        },
      ],
    };
  }

  if ((t.requiredOpenSteps ?? 0) > 0) {
    const n = t.requiredOpenSteps ?? 0;
    return {
      id: "work_steps",
      title: "Work the remaining steps",
      because: `${n} required step${n === 1 ? "" : "s"} still open on this ticket.`,
      then: "Then close it out.",
      completeLabel: "Go to the steps",
      fields: [],
      handoff: { label: "Go to the steps", target: "steps" },
    };
  }

  if (t.guest_in_residence && !t.guest_confirmed && status !== "resolved") {
    return {
      id: "guest_update",
      title: "Update the guest",
      because: "Someone is in the home waiting to hear from us.",
      then: "Then close it out when it's genuinely done.",
      completeLabel: "Record & advance",
      fields: [
        {
          name: "update",
          label: "What you told the guest",
          type: "longtext",
          required: true,
          minLength: 5,
        },
      ],
    };
  }

  if (t.missingClosureEvidence) {
    return {
      id: "add_evidence",
      title: "Add the evidence this work needs",
      because: "The work looks done, but the evidence this work type requires isn't on file.",
      then: "Then close it out.",
      completeLabel: "Go to closure",
      fields: [],
      handoff: { label: "Go to closure", target: "closure" },
    };
  }

  if (t.repairPossible) {
    return {
      id: "field_repair",
      title: "Decide whether this needs a field repair",
      because: "Nothing is blocking the work, and no repair has been raised yet.",
      then: "Then close it out, or hand it to the field team.",
      completeLabel: "Open the repair decision",
      fields: [],
      handoff: { label: "Open the repair decision", target: "repair" },
    };
  }

  if (t.resolved_at || status === "resolved") {
    return {
      id: "close_out",
      title: "Review and close",
      because: "The work is finished. A reviewer approves it or sends it back for changes.",
      completeLabel: "Go to review",
      fields: [],
      handoff: { label: "Go to review", target: "closure" },
    };
  }

  return {
    id: "close_out",
    title: "Close it out",
    because: "The work is done. Add the closing summary and final guest message, then close.",
    completeLabel: "Go to closure",
    fields: [],
    handoff: { label: "Go to closure", target: "closure" },
  };
}
