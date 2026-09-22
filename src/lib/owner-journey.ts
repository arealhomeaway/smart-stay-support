/**
 * "Your journey at a glance" — the six milestones the Welcome Packet promises
 * the homeowner, and where their program currently sits.
 *
 * The stage is derived from what ARHA already tracks. Nothing new is entered
 * by staff, and nothing here states an hour figure or a tax outcome.
 */

export const JOURNEY_STEPS = [
  {
    key: "initial_onboarding",
    label: "Initial Onboarding",
    blurb: "Review the program, your property plan, agreement expectations and your first decisions.",
  },
  {
    key: "design_alignment",
    label: "Design Alignment",
    blurb: "Share preferences, review the design package and floor plan, and align on selections.",
  },
  {
    key: "setup_progress",
    label: "Setup Progress",
    blurb: "Stay informed as make-ready, ordering and setup move forward.",
  },
  {
    key: "owner_handoff",
    label: "Owner Handoff",
    blurb: "Meet your Operations team and understand what carries into go-live.",
  },
  {
    key: "first_booking",
    label: "First Confirmed Booking",
    blurb: "Review the first reservation and what to expect as your home enters the market.",
  },
  {
    key: "day_90_review",
    label: "Day-90 Review",
    blurb: "Close the structured program period and confirm next-step ownership.",
  },
] as const;

export type JourneyKey = (typeof JOURNEY_STEPS)[number]["key"];

const ORDER: JourneyKey[] = JOURNEY_STEPS.map((s) => s.key);

export function journeyIndex(key: JourneyKey) {
  return ORDER.indexOf(key);
}

export type JourneyHomeSignals = {
  name: string;
  closingConfirmed: boolean | null;
  onboardingStatus: string | null;
  launchStatus: string | null;
};

export type JourneyProgramSignals = {
  status: string;
  completedAt: string | null;
  /** Whole days elapsed in the 90-day window, 0 before it starts. */
  programDay: number;
};

const LAUNCHED = new Set(["launched", "live"]);
const HANDED_OFF = new Set(["ready", "launching"]);
const ONBOARDING_DONE = new Set(["complete", "completed", "handed_off"]);
const DESIGN_STARTED = new Set(["in_progress", "design", "setup", "active"]);

/** Where one home sits on the packet's six-step path. */
export function homeStage(home: JourneyHomeSignals): JourneyKey {
  const launch = (home.launchStatus ?? "").toLowerCase();
  const onboarding = (home.onboardingStatus ?? "").toLowerCase();
  if (LAUNCHED.has(launch)) return "first_booking";
  if (HANDED_OFF.has(launch) || ONBOARDING_DONE.has(onboarding)) return "owner_handoff";
  if (DESIGN_STARTED.has(onboarding)) return "setup_progress";
  if (home.closingConfirmed) return "design_alignment";
  return "initial_onboarding";
}

/**
 * The program's current step. With several homes, the journey reads from the
 * one furthest back — that is where the homeowner's attention is needed.
 */
export function programStage(
  program: JourneyProgramSignals,
  homes: JourneyHomeSignals[],
): JourneyKey {
  if (program.completedAt || program.status === "complete") return "day_90_review";
  const stages = homes.map(homeStage);
  const current: JourneyKey = stages.length
    ? (ORDER[Math.min(...stages.map(journeyIndex))] as JourneyKey)
    : "initial_onboarding";
  // The Day-90 review is a calendar event, not a property event: once the
  // window closes it is the step in front of the homeowner regardless.
  if (program.programDay >= 90) return "day_90_review";
  return current;
}

export type JourneyStepView = {
  key: JourneyKey;
  label: string;
  blurb: string;
  state: "done" | "current" | "upcoming";
};

export function journeyView(current: JourneyKey): JourneyStepView[] {
  const at = journeyIndex(current);
  return JOURNEY_STEPS.map((step, i) => ({
    ...step,
    state: i < at ? "done" : i === at ? "current" : "upcoming",
  }));
}
