/**
 * Who the homeowner talks to, and when.
 *
 * Taken verbatim from the Active Owner Welcome Packet. The named people here
 * are escalation contacts: during onboarding the homeowner's day-to-day
 * traffic runs through their project manager and utility manager, and after
 * handoff through their property coordinator and the Director of Onboarding.
 */

export type ArhaContact = {
  name: string;
  role: string;
  email: string;
  phone: string | null;
  /** How the homeowner should use this person. */
  use: string;
};

export const KATI: ArhaContact = {
  name: "Kati Hand",
  role: "Director of Onboarding",
  email: "kati@arealhomeaway.com",
  phone: "405-415-2899",
  use: "Escalations on design, setup, owner communications and handoff.",
};

export const EMILY: ArhaContact = {
  name: "Emily Jimenez",
  role: "Chief Operating Officer",
  email: "emily.jimenez@arealhomeaway.com",
  phone: "918-215-2504 ext. 5",
  use: "Escalations on program oversight, expectations and concerns during the 90-day period.",
};

export const JAMES: ArhaContact = {
  name: "James Miller, Jr.",
  role: "Chief Financial Officer",
  email: "james@arealhomeaway.com",
  phone: "405-446-7259",
  use: "Invoicing, billing questions and ongoing owner concerns after the Day-90 closeout.",
};

export type ContactPhase = "onboarding" | "post_handoff" | "after_closeout";

export type ContactSeat = {
  /** The seat, e.g. "Your project manager". */
  seat: string;
  /** Resolved name where ARHA has recorded one. */
  name: string | null;
  note: string;
};

export type ContactsView = {
  phase: ContactPhase;
  /** Who the homeowner works with day to day in this phase. */
  dayToDay: ContactSeat[];
  /** Named people to escalate to. */
  escalation: ArhaContact[];
  /** Set only after the Day-90 closeout. */
  primary: ArhaContact | null;
};

export type ContactLeads = {
  projectManager?: string | null;
  utilityManager?: string | null;
  propertyCoordinator?: string | null;
  directorOfOnboarding?: string | null;
};

function seat(label: string, name: string | null | undefined, note: string): ContactSeat {
  return { seat: label, name: name?.trim() || null, note };
}

/** Which contacts apply, given where the program is. */
export function contactsFor(phase: ContactPhase, leads: ContactLeads = {}): ContactsView {
  if (phase === "after_closeout")
    return {
      phase,
      dayToDay: [
        seat(
          "Your property coordinator",
          leads.propertyCoordinator,
          "Day-to-day care of your home under your management agreement.",
        ),
      ],
      escalation: [EMILY],
      primary: JAMES,
    };

  if (phase === "post_handoff")
    return {
      phase,
      dayToDay: [
        seat(
          "Your property coordinator",
          leads.propertyCoordinator,
          "Your first call for guests, maintenance and day-to-day questions once the home is listed.",
        ),
        seat(
          "Director of Onboarding",
          leads.directorOfOnboarding ?? KATI.name,
          "Continued management of the property after listing.",
        ),
      ],
      escalation: [EMILY],
      primary: null,
    };

  return {
    phase,
    dayToDay: [
      seat(
        "Your project manager",
        leads.projectManager,
        "Runs your setup plan and brings you the decisions that need you.",
      ),
      seat(
        "Your utility manager",
        leads.utilityManager,
        "Handles electric, gas, water, trash and internet for your home.",
      ),
    ],
    escalation: [KATI, EMILY],
    primary: null,
  };
}

/** Phase from the program's own state — no new field for staff to maintain. */
export function contactPhaseFor(input: {
  completedAt: string | null;
  status: string;
  handedOff: boolean;
}): ContactPhase {
  if (input.completedAt || input.status === "complete") return "after_closeout";
  return input.handedOff ? "post_handoff" : "onboarding";
}
