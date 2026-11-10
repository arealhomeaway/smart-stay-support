/**
 * Home: the Needs you now side panel, See all, Recent activity and My scorecard
 * (Emily, Nov 7; register T1, T2). Pure and browser-safe: words and who sees what.
 * Every decision in the panel goes through the path it already uses elsewhere
 * (the ticket's Accept and Decline, the Work Order spending decision).
 */
import { can, type AccessSeats, type AppRole } from "@/lib/permissions";

export type NeedsKind = "handoff" | "escalation" | "approval" | "booking";

/** What the row is and why it is waiting on this person, said in the panel's first line. */
export const NEEDS_WHY: Record<NeedsKind, string> = {
  handoff: "Someone handed this ticket to you. It becomes yours only when you accept it. Decline it with a reason if it is not yours.",
  escalation: "This ticket is yours and it has gone past its time. Open it and take the next step.",
  approval: "This is waiting for your decision.",
  booking: "This booking request was sent to you. Open it to start or keep it moving.",
};

export const NEEDS_KIND_LABEL: Record<NeedsKind, string> = {
  handoff: "Handoff",
  escalation: "Escalated",
  approval: "Approval",
  booking: "Direct booking",
};

export const NEEDS_PANEL_COPY = {
  openTicket: "Open ticket",
  openRequest: "Open request",
  openWorkOrder: "Open the ticket for this work order",
  approve: "Approve this amount",
  decline: "Decline",
  decisionNote: "Why this amount is approved or declined",
  noteNeeded: "Write why first.",
  onlyLeaders: "Only the Operations Supervisor or Director of Operations can approve this spending.",
  decided: "Your decision is saved.",
  alreadyDecided: "This was already decided.",
  amount: "Amount",
  home: "Home",
  asked: "Asked",
} as const;

/** Register T2: Supervisors and above (Operations Supervisor, Directors, COO, Admin) get See all; coordinators do not. */
export function seeAllVisible(roles: AppRole[], seats: AccessSeats = {}): boolean {
  return can(roles, "oversight", seats);
}
export const SEE_ALL_LABEL = "See all in Oversight";

/**
 * Register T1: My scorecard shows only for a person who has a scorecard record
 * (recorded by them or about them, not demo), and only when the view it opens
 * is one they can open, so nobody sees a dead button.
 */
export function myScorecardVisible(hasRecord: boolean, canOpenView: boolean): boolean {
  return hasRecord && canOpenView;
}
export const MY_SCORECARD_LABEL = "My scorecard";
/** Until a staff My scorecard view exists, the button opens Analytics (register B6). */
export const MY_SCORECARD_TO = "/analytics" as const;

/** Register T1: Recent activity starts collapsed, with a plain heading and a count. */
export const RECENT_ACTIVITY_LIMIT = 6;
export function recentActivityHeading(count: number): string {
  return `Recent activity (${count})`;
}
export const RECENT_ACTIVITY_COPY = {
  show: "Show",
  hide: "Hide",
} as const;
