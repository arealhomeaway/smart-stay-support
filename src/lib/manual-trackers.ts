/**
 * Build 14 (register BN7, BN8, BN9; docs/specs/bonus-guide-values.md G): browser-safe words and
 * helpers for Team records, Coaching and the Weekly scorecard. Every rule (the random draw, who
 * may see what, On time or Late, the counts the bonus uses) lives in the database functions in
 * docs/pending/manual-trackers/01_manual_trackers.sql; this file only formats what they return.
 */
export const CHECKLIST: { key: string; label: string }[] = [
  { key: "notes_complete", label: "The notes are complete" },
  { key: "guest_communication", label: "Guest communication was right for the situation" },
  { key: "expenses_tracked", label: "Expenses are tracked, or there are none" },
  { key: "handoff_ready", label: "Everything needed for a handoff is in the notes" },
  { key: "proof_attached", label: "Proof is attached when the work says done" },
];

export const RECORD_KIND_LABEL: Record<string, string> = {
  ticket: "Ticket",
  routine: "Routine work",
  handoff: "Shift handoff",
};

export const RECORD_STATUS_LABEL: Record<string, string> = {
  waiting: "To review",
  clean: "Clean",
  not_clean: "Not clean",
  skipped: "Skipped",
};

export const SESSION_TYPES: { value: string; label: string }[] = [
  { value: "check_in", label: "Check in" },
  { value: "training", label: "Training" },
  { value: "team_feedback", label: "Feedback from the team" },
  { value: "onboarding", label: "Onboarding coaching" },
  { value: "other", label: "Other" },
];
export const SESSION_TYPE_LABEL: Record<string, string> = Object.fromEntries(SESSION_TYPES.map((t) => [t.value, t.label]));

export const FOLLOW_UP_OWNERS: { value: string; label: string }[] = [
  { value: "coordinator", label: "Property Coordinator" },
  { value: "ops_supervisor", label: "Operations Supervisor" },
];
export const FOLLOW_UP_OWNER_LABEL: Record<string, string> = Object.fromEntries(FOLLOW_UP_OWNERS.map((t) => [t.value, t.label]));

/** The Supervisor's own call for each coordinator: a level name, never a typed number. */
export const COORDINATOR_LEVELS: { value: string; label: string }[] = [
  { value: "below", label: "Below goal" },
  { value: "goal_met", label: "Goal met" },
  { value: "strong", label: "Strong" },
  { value: "exceeds", label: "Exceeds" },
];

export const WEEKLY_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  on_time: "On time",
  late: "Late",
  not_submitted: "Not submitted",
};

export const WEEKLY_EVENT_LABEL: Record<string, string> = {
  submitted: "Submitted",
  reviewed: "Reviewed",
  returned: "Returned",
};

export const TRACKER_COPY = {
  records: {
    title: "Team records",
    hint: "Records chosen at random each Monday from last week's work. Open each one, check it, and mark it.",
    progress: (done: number, total: number) => `${done} of ${total} reviewed`,
    none: "No records were drawn for this week yet.",
    drawsAt: "Records are drawn at 6 AM on Monday.",
    open: "Open the record",
    review: "Review",
    clean: "Clean",
    notClean: "Not clean",
    note: "What is missing",
    evidence: "Link to the evidence",
    skip: "Cannot review this one",
    skipReason: "Why it cannot be reviewed",
    skipSave: "Skip and draw another",
    save: "Save review",
    checkTitle: "Double check",
    checkHint: "Reviews chosen at random once the week is done. Your call decides the result.",
    agree: "Agree",
    disagree: "Disagree",
    checkNote: "Note",
    history: "Past weeks",
    mineTitle: "Your record checks",
    mineFrom: (day: string) => `Your results show from ${day}.`,
    mineNone: "No records reviewed yet.",
    financeHint: "Totals only.",
    settings: "Settings",
    perCoordinator: "Records a coordinator each week",
    directorChecks: "Double checks each week",
    saved: "Saved.",
  },
  coaching: {
    title: "Coaching",
    hint: "One session with each coordinator each month. Onboarding coaching counts.",
    month: "Month",
    count: (done: number, required: number) => `${done} of ${required} sessions this month`,
    newSession: "Record a coaching session",
    coordinator: "Coordinator",
    date: "Date",
    type: "Type",
    agenda: "Agenda items",
    addAgenda: "Add an item",
    notes: "Notes",
    wentWell: "What went well",
    followUps: "Follow ups",
    addFollowUp: "Add a follow up",
    owner: "Owner",
    dueOn: "Due",
    nextOn: "Next session",
    save: "Save session",
    saved: "Saved.",
    none: "No sessions this month yet.",
    mineTitle: "Your coaching sessions",
    mineNone: "No coaching sessions yet.",
    settings: "Sessions required",
    perMonth: "Each coordinator, each month",
    override: "This coordinator",
    sameAsTeam: "Same as the team",
  },
  weekly: {
    title: "Weekly scorecard",
    hint: "Due Thursday at 3 PM, covering Thursday to Wednesday. The numbers fill in from Resolve.",
    week: "Week",
    due: (day: string) => `Due ${day} at 3 PM`,
    covers: (from: string, to: string) => `Covers ${from} to ${to}`,
    opensOn: (day: string) => `Opens ${day}.`,
    facts: "From Resolve",
    followThrough: "On time follow through",
    urgentReply: "Urgent replies within 3 minutes",
    urgentAction: "Urgent action within 5 minutes",
    handoffs: "Shift handoffs",
    duties: "Team duties on time",
    records: "Team records clean",
    arrivals: "Homes ready for guests (team)",
    yourCall: "Your call",
    notes: "Notes from the one on one",
    wins: "Wins",
    problems: "Problems",
    requests: "Requests for the Director of Operations",
    saveDraft: "Save",
    submit: "Submit",
    correct: "Start a correction",
    reason: "Reason for the correction",
    submitCorrection: "Submit the correction",
    reviewed: "Reviewed",
    returnIt: "Return",
    returnNote: "What to fix",
    returned: "Returned",
    history: "History",
    none: "Nothing yet.",
    saved: "Saved.",
    submitted: "Submitted. The Director of Operations will review it.",
    financeHint: "Status and numbers only.",
  },
  loadError: "This could not be loaded. Try again.",
} as const;

export type Count = { met: number; total: number };

/** "4 of 5" with a percent, or a dash when there was nothing to count. */
export function countText(c: Count | null | undefined): string {
  if (!c || !c.total) return "None";
  return `${c.met} of ${c.total} (${Math.round((c.met * 100) / c.total)}%)`;
}

/** Monday of the week (Central) as YYYY-MM-DD, for the Team records week picker. */
export function mondayOf(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's date in Central time, YYYY-MM-DD. */
export function centralToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

/** First day of a month, YYYY-MM-01. */
export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthLabel(iso: string): string {
  return new Date(`${iso.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** A Not clean review needs a note and an http(s) link; Clean needs every checklist item. */
export function reviewProblem(clean: boolean | null, checklist: Record<string, boolean>, note: string, url: string): string | null {
  if (clean === null) return "Mark it Clean or Not clean.";
  const all = CHECKLIST.every((c) => checklist[c.key]);
  if (clean && !all) return "A record is clean only when every item is there, proof included.";
  if (!clean && note.trim().length < 3) return "Add a note about what is missing.";
  if (!clean && !/^https?:\/\/\S+$/i.test(url.trim())) return "Add a link to the evidence.";
  return null;
}
