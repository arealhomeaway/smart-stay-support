/**
 * Display-only helpers for the ticket layout: the step tracker, the "Do this
 * now" due line and the refund status chip. Every input is existing ticket
 * state; nothing here changes routing, priority, SLA or approval rules.
 */
import type { CommState } from "@/lib/guest-impact";

export type TrackerStepKey = "logged" | "tell_guest" | "fix_it" | "make_right" | "done";
export const TRACKER_LABELS: Record<TrackerStepKey, string> = {
  logged: "Logged",
  tell_guest: "Tell the guest",
  fix_it: "Fix it",
  make_right: "Make it right",
  done: "Done",
};

export type TrackerFacts = {
  closed: boolean;
  /** The guest is owed communication on this ticket (not "No guest communication required"). */
  guestInvolved: boolean;
  commState: CommState;
  /** Display stage from ticketStage(). */
  stage: string;
  status: string;
  acknowledged: boolean;
  /** A refund, credit or claim exists that is not finished, or "needs refund" is ticked with nothing logged yet. */
  makeRightOpen: boolean;
};

export type TrackerStep = { key: TrackerStepKey; label: string; complete: boolean; current: boolean };
export type Tracker = { steps: TrackerStep[]; current: TrackerStepKey | null; unmapped: string | null };

const WORK_OPEN = new Set(["repair", "repair_active", "steps", "verify"]);
const TELL_DUE = new Set<CommState>(["initial_ack", "update_due", "contact_prior_guest"]);

/**
 * Which step this ticket is on. When the state cannot be mapped confidently
 * the tracker shows no current step (`unmapped` says why) instead of guessing.
 */
export function ticketTracker(f: TrackerFacts): Tracker {
  const keys: TrackerStepKey[] = f.guestInvolved
    ? ["logged", "tell_guest", "fix_it", "make_right"]
    : ["logged", "fix_it", "done"];
  let current: TrackerStepKey | null = null;
  let unmapped: string | null = null;

  if (f.closed) {
    current = null;
  } else if (f.status === "waiting" || f.stage === "waiting") {
    unmapped = "Parked as waiting";
  } else if (f.guestInvolved && TELL_DUE.has(f.commState)) {
    current = "tell_guest";
  } else if (f.guestInvolved && f.commState === "waiting_guest") {
    unmapped = "Waiting for the guest to reply";
  } else if (!f.acknowledged) {
    current = f.guestInvolved ? "tell_guest" : "fix_it";
  } else if (WORK_OPEN.has(f.stage)) {
    current = "fix_it";
  } else if (f.makeRightOpen) {
    current = f.guestInvolved ? "make_right" : null;
    if (!f.guestInvolved) unmapped = "Refund or claim open on a ticket with no guest";
  } else if (f.stage === "closure") {
    current = f.guestInvolved ? "make_right" : "done";
  } else {
    unmapped = `Stage "${f.stage}"`;
  }

  const idx = current ? keys.indexOf(current) : -1;
  const steps = keys.map((key, i) => {
    let complete: boolean;
    if (f.closed) complete = true;
    else if (current) complete = i < idx;
    else complete = key === "logged" || (key === "tell_guest" && (f.commState === "informed" || f.commState === "complete"));
    return { key, label: TRACKER_LABELS[key], complete, current: key === current };
  });
  return { steps, current, unmapped };
}

/** "due in 3 min", "due in 2 h", "overdue by 5 min". */
export function dueInLabel(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  const mins = Math.round(Math.abs(ms) / 60000);
  const span = mins < 60 ? `${mins} min` : mins < 60 * 48 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
  return ms >= 0 ? `due in ${span}` : `overdue by ${span}`;
}

/** The due time shown on the "Do this now" card, from the same clocks the ticket already runs. */
export function doThisNowDueAt(t: {
  commState: CommState;
  commDueAt: string | null;
  acknowledged_at: string | null;
  action_started_at: string | null;
  response_due_at: string | null;
  action_due_at: string | null;
  next_guest_update_at: string | null;
}): string | null {
  if (!t.acknowledged_at) return t.response_due_at;
  if (t.commState === "update_due" || t.commState === "initial_ack") return t.commDueAt ?? t.next_guest_update_at;
  if (!t.action_started_at) return t.action_due_at;
  return t.commState === "informed" ? t.next_guest_update_at : null;
}

// ---------- refund status ----------

export type RecoveryLike = {
  stage: string;
  approval_status?: string | null;
  approval_authority?: string | null;
  approved_amount?: number | string | null;
  delivered_amount?: number | string | null;
};

export type ApproverNames = { supervisor: string | null; director: string | null };

const firstName = (n: string | null, fallback: string) => (n ? n.trim().split(/\s+/)[0]! : fallback);

/** One chip per refund or credit. */
export function recoveryStatusChip(r: RecoveryLike, names: ApproverNames): string {
  const delivered = r.delivered_amount !== null && r.delivered_amount !== undefined && r.delivered_amount !== "";
  if (r.approval_status === "declined") return "Declined";
  if (delivered || r.stage === "completed" || r.stage === "closed") return "Issued";
  if (r.approval_status === "pending") {
    return r.approval_authority === "director"
      ? `Waiting on ${firstName(names.director, "the Operations Director")}`
      : `Waiting on ${firstName(names.supervisor, "the Operations Supervisor")}`;
  }
  if (r.approval_status === "approved") return "Approved";
  if (r.approval_status === "returned") return "Sent back";
  return "No approval needed";
}

export const RECOVERY_TRACK = ["Requested", "Approval", "Issued", "Done"] as const;

/** How many of Requested > Approval > Issued > Done are complete (0 to 4). */
export function recoveryTrackDone(r: RecoveryLike): number {
  if (r.stage === "closed") return 4;
  const delivered = r.delivered_amount !== null && r.delivered_amount !== undefined && r.delivered_amount !== "";
  if (delivered || r.stage === "completed") return 3;
  if (r.approval_status === "approved" || r.approval_status === "not_required") return 2;
  return 1;
}

/** Is this refund or credit still open (counts toward "Make it right")? */
export function recoveryOpen(r: RecoveryLike): boolean {
  return r.stage !== "completed" && r.stage !== "closed" && r.approval_status !== "declined";
}
