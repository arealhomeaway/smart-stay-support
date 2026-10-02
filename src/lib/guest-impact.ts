/**
 * Occupancy and guest-impact rules for Operations Tickets.
 *
 * Pure and deterministic. Four things are kept apart on purpose:
 *  1. current occupancy — only from live reservation data, never guessed;
 *  2. the issue reservation — the stay connected to the Ticket (may be past);
 *  3. active-stay impact — does this issue affect a stay happening now;
 *  4. guest communication — whether, and in what state, we owe a guest a message.
 * This is the one place those rules live; components and next-action engines read it.
 */

export type Occupancy = "in_home" | "vacant" | "unknown";
export type ActiveStayImpact = "yes" | "no" | "unknown";
export type GuestComm = "yes" | "no" | "complete";
export type IssueRelation = "current" | "prior" | "future" | "none";

export const ACTIVE_STAY_IMPACT: { value: ActiveStayImpact; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unknown", label: "Unknown / Needs review" },
];
export const GUEST_COMM: { value: GuestComm; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "complete", label: "Complete" },
];
export const ISSUE_RELATION: { value: IssueRelation; label: string }[] = [
  { value: "current", label: "Current stay" },
  { value: "prior", label: "Prior stay" },
  { value: "future", label: "Future reservation" },
  { value: "none", label: "No guest / reservation" },
];

/** Live guest read statuses (see property-contact.ts) → occupancy. Anything unverified is unknown. */
export function occupancyFromGuestStatus(status: string | null | undefined): Occupancy {
  if (status === "occupied") return "in_home";
  if (status === "vacant") return "vacant";
  return "unknown";
}

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  in_home: "Guest in home",
  vacant: "No current guest",
  unknown: "Occupancy unknown",
};

/**
 * What the Current Guest block may say. "Guest in home" and "contact
 * unavailable" only appear together when a reservation exists but its contact
 * details are missing — never as a contradiction.
 */
export function currentGuestDisplay(guest: {
  status: string;
  guest_name?: string | null;
  phone?: string | null;
  email?: string | null;
}): { occupancy: Occupancy; headline: string; contactMissing: boolean; showGuest: boolean } {
  const occupancy = occupancyFromGuestStatus(guest.status);
  if (occupancy === "in_home") {
    const contactMissing = !guest.phone && !guest.email;
    return {
      occupancy,
      headline: contactMissing
        ? "Guest in home — current reservation found, but contact details are unavailable"
        : "Guest in home",
      contactMissing,
      showGuest: true,
    };
  }
  return { occupancy, headline: OCCUPANCY_LABEL[occupancy], contactMissing: false, showGuest: false };
}

/** Post-stay feedback work (survey / review / rating follow-up) — never an active-stay issue by itself. */
export function isPostStayFeedback(workTypeName: string | null | undefined): boolean {
  if (!workTypeName) return false;
  return /\b(guest review|review follow|survey|rating|post-stay|feedback)\b/i.test(workTypeName);
}

/** Where the issue reservation's dates sit relative to today. */
export function relationFromDates(
  arrival: string | null | undefined,
  departure: string | null | undefined,
  now = new Date(),
): IssueRelation | null {
  if (!arrival || !departure) return null;
  const today = now.toISOString().slice(0, 10);
  if (departure < today) return "prior";
  if (arrival > today) return "future";
  return "current";
}

export type ImpactSignals = {
  occupancy: Occupancy;
  relation: IssueRelation | null;
  postStay: boolean;
  /** Maintenance "Is a guest affected right now?" or the guest-in-residence toggle. */
  guestAffectedNow?: boolean | null;
  guestImpact?: string | null;
};

/** Suggested active-stay impact. Never from the category alone; staff may correct it. */
export function suggestActiveStayImpact(s: ImpactSignals): ActiveStayImpact {
  if (s.relation === "prior" || s.relation === "future" || s.relation === "none") {
    return s.guestAffectedNow ? "yes" : "no";
  }
  if (s.postStay) return s.guestAffectedNow ? "yes" : "no";
  const active = s.guestImpact === "active_guest_affected" || s.guestImpact === "safety_security";
  if (s.guestAffectedNow || active) return "yes";
  if (s.occupancy === "vacant") return "no";
  if (s.occupancy === "unknown") return "unknown";
  return s.guestImpact && s.guestImpact !== "none" ? "yes" : "no";
}

/** Suggested communication requirement: only an active-stay issue owes the guest updates. */
export function suggestGuestComm(impact: ActiveStayImpact): GuestComm {
  return impact === "yes" ? "yes" : "no";
}

export type ImpactTicket = {
  active_stay_impact?: string | null;
  guest_comm_required?: string | null;
  issue_reservation_relation?: string | null;
  guest_in_residence?: boolean | null;
  guest_confirmed?: boolean | null;
};

/**
 * Stored values win. Tickets created before this pass (all NULL) fall back to
 * the old guest-in-residence flag — except post-stay feedback, which is never
 * an active stay.
 */
export function effectiveGuestImpact(t: ImpactTicket, workTypeName?: string | null) {
  const postStay = isPostStayFeedback(workTypeName);
  const relation = (t.issue_reservation_relation as IssueRelation | null) ?? null;
  let impact = (t.active_stay_impact as ActiveStayImpact | null) ?? null;
  if (!impact) impact = postStay ? "no" : t.guest_in_residence ? "yes" : "no";
  let comm = (t.guest_comm_required as GuestComm | null) ?? null;
  if (!comm) comm = t.guest_confirmed ? "complete" : postStay ? "no" : suggestGuestComm(impact);
  /** Active-stay update cadence only applies to a live stay that owes updates. */
  const activeCadence = impact === "yes" && comm === "yes" && !postStay;
  return { impact, comm, relation, postStay, activeCadence };
}

export type CommState =
  | "not_required"
  | "initial_ack"
  | "update_due"
  | "waiting_guest"
  | "informed"
  | "contact_prior_guest"
  | "complete";

export const COMM_STATE_LABEL: Record<CommState, string> = {
  not_required: "No guest communication required",
  initial_ack: "Initial guest acknowledgement needed",
  update_due: "Guest update due",
  waiting_guest: "Waiting for guest response",
  informed: "Guest informed — no update due right now",
  contact_prior_guest: "Contact prior guest",
  complete: "Guest communication complete",
};

export function guestCommState(input: {
  impact: ActiveStayImpact;
  comm: GuestComm;
  postStay: boolean;
  guest_update_at?: string | null;
  next_guest_update_at?: string | null;
  waiting_on?: string | null;
  guest_confirmed?: boolean | null;
  now?: Date;
}): { state: CommState; label: string; dueAt: string | null } {
  const now = input.now ?? new Date();
  const out = (state: CommState, dueAt: string | null = null) => ({
    state,
    label: COMM_STATE_LABEL[state],
    dueAt,
  });
  if (input.comm === "complete" || input.guest_confirmed) return out("complete");
  if (input.comm === "no") return out("not_required");
  // Required, but not an active stay: a one-off contact, never a cadence.
  if (input.impact !== "yes" || input.postStay) {
    return input.guest_update_at ? out("informed") : out("contact_prior_guest");
  }
  if (input.waiting_on === "guest") return out("waiting_guest", input.next_guest_update_at ?? null);
  if (!input.guest_update_at) return out("initial_ack");
  const due = input.next_guest_update_at ? new Date(input.next_guest_update_at) : null;
  if (due && due.getTime() <= now.getTime()) return out("update_due", input.next_guest_update_at ?? null);
  return out("informed", input.next_guest_update_at ?? null);
}

/** One call for the engines: effective impact + communication state for a ticket row. */
export function ticketGuestComm(
  t: ImpactTicket & {
    guest_update_at?: string | null;
    next_guest_update_at?: string | null;
    waiting_on?: string | null;
  },
  workTypeName?: string | null,
  now = new Date(),
) {
  const eff = effectiveGuestImpact(t, workTypeName);
  const comm = guestCommState({
    impact: eff.impact,
    comm: eff.comm,
    postStay: eff.postStay,
    guest_update_at: t.guest_update_at ?? null,
    next_guest_update_at: t.next_guest_update_at ?? null,
    waiting_on: t.waiting_on ?? null,
    guest_confirmed: t.guest_confirmed ?? null,
    now,
  });
  return { ...eff, commState: comm.state, commLabel: comm.label, commDueAt: comm.dueAt };
}
