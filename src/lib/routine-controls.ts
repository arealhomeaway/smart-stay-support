/**
 * Routine Controls — the four recurring checks ARHA already runs every day.
 *
 * These are not tickets. A ticket is an exception someone reported; a routine
 * control is scheduled quality work the team performs whether or not anything
 * went wrong. They deliberately reuse the same operational plumbing as every
 * other object in Resolve — assignment, a due date, history, evidence,
 * completion and reporting — but each one gets a purpose-built interface
 * because the job the person is doing is genuinely different.
 *
 * The four controls are fixed:
 *   Cleaning Review   — Property Operations reviews a completed departure clean
 *   Guest Review      — Guest Experience reads and responds to guest feedback
 *   Checkout          — a short guided post-stay pass, replacing the Fillout form
 *   Guest Touch Base  — a proactive mid-stay contact
 *
 * No thresholds, SLAs or authority live here. Those belong to the policy
 * engines, exactly as they do for tickets.
 */

export type RoutineKind = "cleaning_review" | "guest_review" | "checkout" | "guest_touch_base";
export type RoutineStatus = "due" | "in_progress" | "completed" | "cancelled";
export type RoutineOutcome = "looks_good" | "needs_follow_up" | "no_answer" | "not_applicable";

export const ROUTINE_KINDS: RoutineKind[] = [
  "cleaning_review",
  "guest_review",
  "checkout",
  "guest_touch_base",
];

/** One prompt inside a control. Deliberately phrased as the job, not as a field. */
export type RoutineStep = { id: string; prompt: string; hint?: string };

export type RoutineConfig = {
  kind: RoutineKind;
  /** What the person calls this in conversation. */
  label: string;
  plural: string;
  /** The button copy when starting one by hand. */
  runLabel: string;
  /** Which seat normally owns it. */
  team: "guest_experience" | "property_operations";
  teamLabel: string;
  /** One line explaining the job, in the words the team already uses. */
  purpose: string;
  /** How the due date reads on a row. */
  dueNoun: string;
  steps: RoutineStep[];
  /** Outcomes offered, in the order they appear. */
  outcomes: RoutineOutcome[];
  /** Prompt shown when the person chooses "needs follow-up". */
  followUpPrompt: string;
  /** Photos or links expected before this can be completed cleanly. */
  evidenceLabel: string | null;
  /** True when Resolve creates these automatically from an operational event. */
  generated: boolean;
  /** Plain-language note about where generated ones come from. */
  generatedFrom?: string;
};

export const OUTCOME_LABELS: Record<RoutineOutcome, string> = {
  looks_good: "Looks good",
  needs_follow_up: "Needs follow-up",
  no_answer: "No answer",
  not_applicable: "Not applicable",
};

export const ROUTINE_CONFIG: Record<RoutineKind, RoutineConfig> = {
  cleaning_review: {
    kind: "cleaning_review",
    label: "Cleaning Review",
    plural: "Cleaning Reviews",
    runLabel: "Review a clean",
    team: "property_operations",
    teamLabel: "Property Operations",
    purpose: "Review a finished departure clean and either approve it or flag what needs fixing.",
    dueNoun: "Review by",
    steps: [
      { id: "photos", prompt: "Photos match a finished clean", hint: "Kitchen, bathrooms, beds, floors, trash." },
      { id: "presentation", prompt: "Presentation is guest-ready", hint: "Staging, linens, towels, welcome items." },
      { id: "damage", prompt: "No damage or missing items reported" },
      { id: "supplies", prompt: "Consumables and supplies restocked" },
    ],
    outcomes: ["looks_good", "needs_follow_up", "not_applicable"],
    followUpPrompt: "What needs fixing before the next guest?",
    evidenceLabel: "Photos of anything you flagged",
    generated: true,
    generatedFrom: "completed departure cleans",
  },
  guest_review: {
    kind: "guest_review",
    label: "Guest Review",
    plural: "Guest Reviews",
    runLabel: "Work a guest review",
    team: "guest_experience",
    teamLabel: "Guest Experience & Reservations",
    purpose: "Read the guest's feedback, respond, and open a follow-up if there is a real problem.",
    dueNoun: "Respond by",
    steps: [
      { id: "read", prompt: "Read the full review and the stay history" },
      { id: "respond", prompt: "Reply to the guest publicly or privately", hint: "Match the tone to the stay." },
      { id: "pattern", prompt: "Check whether this is a repeat issue at the home" },
    ],
    outcomes: ["looks_good", "needs_follow_up", "not_applicable"],
    followUpPrompt: "What does the home or the team need to fix?",
    evidenceLabel: "A screenshot or link to the review",
    generated: false,
  },
  checkout: {
    kind: "checkout",
    label: "Checkout",
    plural: "Checkouts",
    runLabel: "Run a checkout",
    team: "guest_experience",
    teamLabel: "Guest Experience & Reservations",
    purpose: "A short post-stay pass: confirm the guest is out, capture anything left behind or broken.",
    dueNoun: "Complete by",
    steps: [
      { id: "departed", prompt: "Guest has departed and access is secure" },
      { id: "condition", prompt: "Nothing obviously damaged or missing" },
      { id: "left_behind", prompt: "No belongings left behind", hint: "If there are, note them and tell the guest." },
      { id: "handover", prompt: "Home is ready to hand to cleaning" },
    ],
    outcomes: ["looks_good", "needs_follow_up", "not_applicable"],
    followUpPrompt: "What came out of this checkout that someone has to act on?",
    evidenceLabel: "Photos of anything left behind or damaged",
    generated: false,
  },
  guest_touch_base: {
    kind: "guest_touch_base",
    label: "Guest Touch Base",
    plural: "Guest Touch Bases",
    runLabel: "Touch base with a guest",
    team: "guest_experience",
    teamLabel: "Guest Experience & Reservations",
    purpose: "Reach out mid-stay before a small problem becomes a bad review.",
    dueNoun: "Reach out by",
    steps: [
      { id: "contact", prompt: "Contacted the guest", hint: "Whichever channel they have been using." },
      { id: "settled", prompt: "Guest is settled and has what they need" },
      { id: "issues", prompt: "Asked directly whether anything needs attention" },
    ],
    outcomes: ["looks_good", "needs_follow_up", "no_answer", "not_applicable"],
    followUpPrompt: "What did the guest raise?",
    evidenceLabel: null,
    generated: false,
  },
};

export function routineConfig(kind: string): RoutineConfig {
  return ROUTINE_CONFIG[kind as RoutineKind] ?? ROUTINE_CONFIG.cleaning_review;
}

export function isRoutineKind(value: string): value is RoutineKind {
  return (ROUTINE_KINDS as string[]).includes(value);
}

/** Routine controls owned by a given seat's team. */
export function kindsForTeam(team: string | null | undefined): RoutineKind[] {
  if (!team) return ROUTINE_KINDS;
  return ROUTINE_KINDS.filter((k) => ROUTINE_CONFIG[k].team === team);
}

export type RoutineDueState = "overdue" | "today" | "upcoming" | "done";

/** How late is it? Plain state, no SLA meaning — routines are not ticket clocks. */
export function routineDueState(
  row: { status: string; due_at: string | null | undefined },
  now: Date = new Date(),
): RoutineDueState {
  if (row.status === "completed" || row.status === "cancelled") return "done";
  if (!row.due_at) return "upcoming";
  const due = new Date(row.due_at);
  if (Number.isNaN(due.getTime())) return "upcoming";
  // A routine is not late the instant it becomes due: routine checks are
  // day-shaped work, so the person has the rest of the due day to do them.
  const endOfDueDay = new Date(due);
  endOfDueDay.setHours(23, 59, 59, 999);
  if (now.getTime() > endOfDueDay.getTime()) return "overdue";
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return due.getTime() <= endOfToday.getTime() ? "today" : "upcoming";
}


/** The sentence a person reads on the row, without needing to know the model. */
export function routineDueLabel(row: { status: string; due_at: string | null | undefined }): string {
  const state = routineDueState(row);
  if (state === "done") return "Completed";
  if (!row.due_at) return "No date set";
  const when = new Date(row.due_at).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  if (state === "overdue") return "Due now";
  if (state === "today") return `Due ${when}`;
  return when;
}

/**
 * Stable key for an automatically generated control. Generation is idempotent
 * because the key is derived from the operational event, never from the clock.
 */
export function cleaningReviewKey(breezewayWorkOrderId: string): string {
  return `bz_clean:${breezewayWorkOrderId}`;
}

/** Manual controls still get a key, so a double click cannot create two rows. */
export function manualKey(kind: RoutineKind, propertyId: string | null, isoDay: string): string {
  return `manual:${kind}:${propertyId ?? "no_property"}:${isoDay}`;
}
