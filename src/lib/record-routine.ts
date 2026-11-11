/**
 * Record routine work: the one panel for the daily checks.
 *
 * Pure and browser-safe. Which checks are live, who they belong to, their
 * steps, what a saved check must contain, and the panel's words all live
 * here. The ticket type a found issue opens is decided only by the database
 * function record_routine_check (docs/pending/record-routine/01).
 */
import {
  ROUTINE_CONFIG,
  manualKey,
  maintenanceReviewKey,
  needsMaintenanceReview,
  type RoutineOutcome,
  type RoutineStep,
} from "@/lib/routine-controls";
import { needsFollowUp } from "@/lib/guest-feedback";

export type LiveCheck = "guest_touch_base" | "maintenance_review" | "guest_review" | "survey_review";
export type TeamCode = "guest_experience" | "property_operations";

/** The switch that shows Survey reviews. Off until surveys go live. */
export const SURVEY_CHECK_FLAG = "survey_review_check";

/** Retired: the Departure Review in the Team Queue covers them. Their history stays. */
export const RETIRED_CHECKS = ["checkout", "cleaning_review"] as const;

export const TEAM_NAMES: Record<TeamCode, string> = {
  guest_experience: "Team A",
  property_operations: "Team B",
};

/** Reviews and finished work orders older than this stay on the Routine Work page only. */
export const REVIEW_LOOKBACK_DAYS = 14;
export const WORK_ORDER_LOOKBACK_DAYS = 14;
/** A finished work order is due for our review within 24 hours. */
export const WORK_ORDER_REVIEW_HOURS = 24;

export type CheckDef = {
  kind: LiveCheck;
  label: string;
  /** One item, used in titles. */
  single: string;
  team: TeamCode;
  teamLine: string;
  purpose: string;
  stepsHeading: string;
  steps: RoutineStep[];
  notice?: string;
  outcomes: RoutineOutcome[];
};

export const CHECKS: Record<LiveCheck, CheckDef> = {
  guest_touch_base: {
    kind: "guest_touch_base",
    label: "Guest touch bases",
    single: "Guest touch base",
    team: "guest_experience",
    teamLine: "Team A, guest experience queue",
    purpose:
      "A mid stay check in call to make sure the guest is settled and catch small problems before they become a bad review.",
    stepsHeading: "Check each one",
    steps: ROUTINE_CONFIG.guest_touch_base.steps,
    outcomes: ["looks_good", "needs_follow_up", "no_answer", "not_applicable"],
  },
  maintenance_review: {
    kind: "maintenance_review",
    label: "Maintenance reviews",
    single: "Maintenance review",
    team: "property_operations",
    teamLine: "Team B, property operations queue",
    purpose:
      "Check maintenance and any Breezeway work order a vendor marked Finished, including lawn care and landscaping. Due within 24 hours.",
    stepsHeading: "Check each one",
    steps: ROUTINE_CONFIG.maintenance_review.steps,
    notice: "A vendor marking a job Finished is not our review. Approve it only after you have checked it.",
    outcomes: ["looks_good", "needs_follow_up", "not_applicable"],
  },
  guest_review: {
    kind: "guest_review",
    label: "Guest reviews",
    single: "Guest review",
    team: "guest_experience",
    teamLine: "Team A, guest experience queue",
    purpose: "Read the review, reply to the guest and decide what the home or the team needs to fix. Reviews under 5 stars come first.",
    stepsHeading: "Check each one",
    steps: [
      { id: "read", prompt: "Read the full review and the stay history" },
      { id: "respond", prompt: "Reply to the guest publicly or privately", hint: "Match the tone to the stay." },
      { id: "pattern", prompt: "Check whether this is a repeat issue at the home" },
      { id: "fix", prompt: "Decide what the home or the team needs to fix" },
    ],
    outcomes: ["looks_good", "needs_follow_up", "not_applicable"],
  },
  survey_review: {
    kind: "survey_review",
    label: "Survey reviews",
    single: "Survey review",
    team: "guest_experience",
    teamLine: "Team A, guest experience queue",
    purpose: ROUTINE_CONFIG.survey_review.purpose,
    stepsHeading: "Check each one",
    steps: ROUTINE_CONFIG.survey_review.steps,
    outcomes: ["looks_good", "needs_follow_up", "not_applicable"],
  },
};

export function isLiveCheck(kind: string): kind is LiveCheck {
  return kind === "guest_touch_base" || kind === "maintenance_review" || kind === "guest_review" || kind === "survey_review";
}

const ORDER: LiveCheck[] = ["guest_touch_base", "guest_review", "survey_review", "maintenance_review"];

export type PanelCheck = { kind: LiveCheck; mine: boolean };

/**
 * The checks in the panel. The person's own team comes first and counts as
 * theirs; everyone can still open the others. People without a home team
 * (leaders) see every check as theirs. Survey reviews stay hidden until the
 * switch is on. Retired checks never appear.
 */
export function panelChecks(team: string | null | undefined, surveyOn: boolean): PanelCheck[] {
  const live = ORDER.filter((k) => k !== "survey_review" || surveyOn);
  const isMine = (k: LiveCheck) => !team || CHECKS[k].team === team;
  return [...live.filter(isMine), ...live.filter((k) => !isMine(k))].map((kind) => ({ kind, mine: isMine(kind) }));
}

/** Checks a person can start by hand, picking a home. */
export function byHandChecks(surveyOn: boolean): LiveCheck[] {
  return ORDER.filter((k) => k !== "survey_review" || surveyOn);
}

export function checkBadge(mine: boolean, count: number): string {
  if (count === 0) return "All caught up";
  return mine ? `Due now · ${count}` : `${count} open`;
}

/** True when every check that belongs to the person's team has nothing waiting. */
export function teamAllDone(checks: PanelCheck[], counts: Partial<Record<LiveCheck, number>>): boolean {
  const mine = checks.filter((c) => c.mine);
  return mine.length > 0 && mine.every((c) => (counts[c.kind] ?? 0) === 0);
}

// ---------- outcomes and review fields ----------

export const PANEL_OUTCOME_LABELS: Record<RoutineOutcome, string> = {
  looks_good: "Looks good",
  needs_follow_up: "Needs follow-up",
  no_answer: "No answer",
  not_applicable: "Not applicable",
};

export const POST_PLACES = [
  { value: "airbnb", label: "Airbnb" },
  { value: "ownerrez", label: "OwnerRez" },
  { value: "vrbo", label: "VRBO" },
  { value: "booking_com", label: "Booking.com" },
  { value: "other", label: "Somewhere else" },
] as const;
export type PostPlace = (typeof POST_PLACES)[number]["value"];

export const REPEAT_OPTIONS = [
  { value: "no", label: "No, first time" },
  { value: "yes", label: "Yes, it has come up before" },
] as const;
export type RepeatAnswer = (typeof REPEAT_OPTIONS)[number]["value"];

export type CheckAnswers = {
  steps: Record<string, boolean>;
  outcome: RoutineOutcome | null;
  issue?: string;
  fixTeam?: TeamCode | null;
  notes?: string;
  replyText?: string;
  postedOn?: PostPlace | null;
  repeatIssue?: RepeatAnswer | null;
  link?: string | null;
};

/** The team a found issue goes to unless the person picks the other one. */
export function defaultFixTeam(kind: LiveCheck): TeamCode {
  return CHECKS[kind].team;
}

/** Null when the check can be saved, otherwise the message to show. */
export function checkAnswersProblem(kind: LiveCheck, a: CheckAnswers): string | null {
  if (!a.outcome || !CHECKS[kind].outcomes.includes(a.outcome)) return "Choose how it went.";
  if (kind === "guest_review" && a.outcome !== "not_applicable") {
    if (!(a.replyText ?? "").trim()) return "Paste what we replied.";
    if (!a.postedOn || !POST_PLACES.some((p) => p.value === a.postedOn)) return "Choose where you posted it.";
    if (!a.repeatIssue || !REPEAT_OPTIONS.some((r) => r.value === a.repeatIssue)) return "Answer whether this is a repeat issue at this home.";
  }
  if (a.outcome === "needs_follow_up") {
    if (!(a.issue ?? "").trim()) return "Say what needs fixing.";
    if (a.fixTeam !== "guest_experience" && a.fixTeam !== "property_operations") return "Choose which team should fix it.";
  }
  if ((a.notes ?? "").length > 4000 || (a.issue ?? "").length > 4000 || (a.replyText ?? "").length > 8000)
    return "That is too long to save. Shorten it a little.";
  return null;
}

/** The stored answers. Steps keep their wording so history reads on its own. */
export function buildAnswers(kind: LiveCheck, a: CheckAnswers) {
  const def = CHECKS[kind];
  return {
    check: def.label,
    steps: def.steps.map((s) => ({ id: s.id, prompt: s.prompt, done: Boolean(a.steps[s.id]) })),
    outcome: a.outcome,
    ...(kind === "guest_review"
      ? {
          reply_text: (a.replyText ?? "").trim() || null,
          posted_on: a.postedOn ?? null,
          repeat_issue: a.repeatIssue ?? null,
        }
      : {}),
    ...(a.outcome === "needs_follow_up" ? { fix_team: a.fixTeam ?? null } : {}),
  };
}

/** The same answers as plain lines, for the check's notes and the ticket. */
export function answersSummary(kind: LiveCheck, a: CheckAnswers): string {
  const def = CHECKS[kind];
  const lines: string[] = [];
  const done = def.steps.filter((s) => a.steps[s.id]).map((s) => s.prompt);
  const open = def.steps.filter((s) => !a.steps[s.id]).map((s) => s.prompt);
  if (done.length) lines.push(`Steps done: ${done.join("; ")}`);
  if (open.length) lines.push(`Steps not ticked: ${open.join("; ")}`);
  if (a.outcome) lines.push(`How it went: ${PANEL_OUTCOME_LABELS[a.outcome]}`);
  if (kind === "guest_review") {
    if ((a.replyText ?? "").trim()) lines.push(`What we replied: ${a.replyText!.trim()}`);
    const place = POST_PLACES.find((p) => p.value === a.postedOn);
    if (place) lines.push(`Posted on: ${place.label}`);
    const repeat = REPEAT_OPTIONS.find((r) => r.value === a.repeatIssue);
    if (repeat) lines.push(`Repeat issue at this home: ${repeat.label}`);
  }
  if (a.outcome === "needs_follow_up" && a.fixTeam) lines.push(`Sent to: ${TEAM_NAMES[a.fixTeam]}`);
  if ((a.notes ?? "").trim()) lines.push(`Notes: ${a.notes!.trim()}`);
  if (a.link) lines.push(`Link: ${a.link}`);
  return lines.join("\n");
}

/** The ticket a found issue opens: a plain title and the check's story. */
export function followUpTicketText(kind: LiveCheck, a: CheckAnswers, homeLabel: string | null) {
  const issue = (a.issue ?? "").trim();
  const first = issue.split("\n")[0]!.trim();
  const title = `${CHECKS[kind].single}: ${first.length > 80 ? `${first.slice(0, 77)}...` : first}`;
  const description = [
    issue,
    "",
    `Found during a ${CHECKS[kind].single.toLowerCase()}${homeLabel ? ` at ${homeLabel}` : ""}.`,
    answersSummary(kind, a),
  ].join("\n");
  return { title, description };
}

// ---------- what is waiting ----------

export function reviewCheckKey(feedbackId: string): string {
  return `review:${feedbackId}`;
}

export function byHandKey(kind: LiveCheck, propertyId: string | null, now: Date = new Date()): string {
  return manualKey(kind, propertyId, `${now.toISOString().slice(0, 10)}:${now.getTime()}`);
}

export { maintenanceReviewKey };

type ReviewLike = {
  id: string;
  feedback_type?: string | null;
  rating: number | null;
  submitted_at: string | null;
  /** False for an OwnerRez review with no publish date: history only (Build 17 finding 8). */
  published_date_known?: boolean | null;
};

/** A synced OwnerRez review from the past 14 days that nobody has checked yet. */
export function reviewNeedsCheck(r: ReviewLike, checkedKeys: Set<string>, now: number = Date.now()): boolean {
  if (r.feedback_type && r.feedback_type !== "external_review") return false;
  if (r.published_date_known === false) return false;
  if (checkedKeys.has(reviewCheckKey(r.id))) return false;
  const at = Date.parse(r.submitted_at ?? "");
  return Number.isFinite(at) && now - at <= REVIEW_LOOKBACK_DAYS * 86_400_000;
}

/** Under 5 stars first (the under 5 star tracker), then newest. */
export function sortReviews<T extends ReviewLike>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const low = Number(needsFollowUp(b.rating)) - Number(needsFollowUp(a.rating));
    return low || (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "");
  });
}

export function reviewTracker(rating: number | null): string | null {
  return needsFollowUp(rating) ? "Under 5 stars" : null;
}

type WorkOrderLike = {
  id: string;
  department: string | null;
  status: string | null;
  finished_at?: string | null;
  breezeway_updated_at?: string | null;
  scheduled_date?: string | null;
};

/** When the vendor marked it Finished, as best Resolve knows. */
export function workOrderFinishedAt(w: WorkOrderLike): string | null {
  return w.finished_at ?? w.breezeway_updated_at ?? (w.scheduled_date ? `${w.scheduled_date}T12:00:00Z` : null);
}

/** Our review is due 24 hours after the vendor marked it Finished. */
export function workOrderDueBy(w: WorkOrderLike): string | null {
  const at = Date.parse(workOrderFinishedAt(w) ?? "");
  return Number.isFinite(at) ? new Date(at + WORK_ORDER_REVIEW_HOURS * 3_600_000).toISOString() : null;
}

/**
 * Maintenance (lawn care and landscaping included) a vendor marked Finished in
 * the past 14 days that the team has not approved yet.
 */
export function workOrderNeedsCheck(w: WorkOrderLike, approvedIds: Set<string>, now: number = Date.now()): boolean {
  if (!needsMaintenanceReview({ id: w.id, department: w.department, status: w.status }, approvedIds)) return false;
  const at = Date.parse(workOrderFinishedAt(w) ?? "");
  return Number.isFinite(at) && now - at <= WORK_ORDER_LOOKBACK_DAYS * 86_400_000;
}

// ---------- words ----------

export const PANEL_COPY = {
  title: "Record routine work",
  intro: "The daily checks that keep our guests happy and our homes in great shape.",
  close: "Close",
  whichCheck: "Which check?",
  emptyCheck: "All caught up on this one. Nice work.",
  allDone: "Every routine check for your team is done. Nice work.",
  byHand: "Not on the list? Start one by hand",
  byHandTitle: "Start a check by hand",
  whichHome: "Select a home",
  homeSearch: "Start typing an address or home name",
  dueNow: "Due now",
  postedOn: (date: string) => `Posted ${date}`,
  leftToday: (n: number) => (n === 0 ? "Nothing left today. Nice work." : `${n} left today.`),
  howDidItGo: "How did it go?",
  whatNeedsFixing: "What needs fixing?",
  whoFixes: "Who should fix it?",
  whoFixesHint: "A ticket opens in that team's queue and stays linked to this check.",
  replyLabel: "What we replied",
  postedLabel: "Where did you post it?",
  postedHelp: "Post your reply on Airbnb or in OwnerRez first, then paste it here so we have a record.",
  repeatLabel: "Is this a repeat issue at this home?",
  notesLabel: "Notes (optional)",
  save: "Save this check",
  saved: "Saved. Thank you for taking care of it.",
  backToList: "Back to the list",
  openTicket: "Open the ticket",
  ticketFormNext: "Next, write the ticket so the right team can fix it.",
} as const;
