/**
 * Browser-safe model for the Active Owner Participation Program.
 *
 * One homeowner, one program, one combined hour goal (100+ logged hours),
 * running from each property's closing date to December 31 of that year.
 * Nothing in this module ever produces, estimates or suggests an amount of
 * participation time: every hour was logged by the homeowner and counts
 * as soon as it is logged.
 */

/** Participation goal: 100+ logged hours. */
export const OWNER_GOAL_HOURS = 100;
/** Kept for stored-row compatibility; pacing now targets the 100-hour goal. */
export const OPERATING_TARGET_HOURS = OWNER_GOAL_HOURS;
export const ONBOARDING_MILESTONE_HOURS = 60;

export const OWNER_GOAL_LABEL = "At least 100 hours";

export function parseOwnerMinutes(value: string): number {
  const minutes = Number(value);
  if (!value.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440)
    throw new Error("Enter the actual time spent, from 1 to 1440 whole minutes.");
  return minutes;
}

export const MANUAL_ENTRY_NOTICE =
  "Enter the actual time you personally spent completing this activity. ARHA does not assign or recommend a standard amount of time.";
export const MANUAL_ENTRY_CONFIRMATION =
  "I confirm that this entry reflects the activity I personally completed and the actual time I spent.";
export const COMBINED_TOTAL_NOTICE =
  "Your progress includes the actual time you manually report across all properties in this program. When one activity involves multiple properties, enter the total time once and select every property involved.";
export const REPORT_DISCLAIMER =
  "Participation totals are based on activity and time manually reported by the homeowner. Activities involving multiple properties are counted once in the combined program total.";

export type ProgramStatus =
  | "draft"
  | "waiting_for_closing"
  | "ready_for_onboarding"
  | "active"
  | "target_reached"
  | "completed"
  | "paused"
  | "closed"
  // legacy values still present on older rows
  | "pending"
  | "complete";

export const PROGRAM_STATUS_META: Record<ProgramStatus, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "bg-muted text-muted-foreground border-border" },
  waiting_for_closing: {
    label: "Waiting for property closing",
    tone: "bg-muted text-muted-foreground border-border",
  },
  ready_for_onboarding: {
    label: "Ready for owner onboarding",
    tone: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  active: { label: "Active", tone: "bg-primary/10 text-primary border-primary/20" },
  target_reached: {
    label: "Target reached",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  completed: {
    label: "Completed",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  paused: { label: "Paused", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  closed: { label: "Closed", tone: "bg-muted text-muted-foreground border-border" },
  pending: { label: "Draft", tone: "bg-muted text-muted-foreground border-border" },
  complete: {
    label: "Completed",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
};

export const ACTIVATABLE_STATUSES: ProgramStatus[] = [
  "draft",
  "pending",
  "waiting_for_closing",
  "ready_for_onboarding",
];

export type TaskType = "program_wide" | "property_specific" | "multi_property";

export const TASK_TYPE_META: Record<TaskType, { label: string; blurb: string }> = {
  program_wide: {
    label: "Program-wide",
    blurb: "Applies to the whole program and is completed once.",
  },
  property_specific: { label: "Property", blurb: "Applies to a single home." },
  multi_property: {
    label: "Multi-property",
    blurb: "One shared activity covering two or more homes.",
  },
};

export const ACTIVITY_CATEGORIES = [
  "Onboarding meeting",
  "Property assessment review",
  "Make-ready or furnishing decision",
  "Vendor estimate review",
  "Listing, photography or pricing review",
  "Guest experience or standards",
  "Operating decision",
  "Assessment or maintenance review",
  "Financial or reporting review",
  "Other participation",
] as const;

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

/**
 * Program window: the property's closing date through December 31 of the
 * same calendar year. There is no fixed day count.
 */
export function programWindowEnd(startedOn: string | null | undefined) {
  if (!startedOn || !/^\d{4}-\d{2}-\d{2}/.test(startedOn)) return null;
  return `${startedOn.slice(0, 4)}-12-31`;
}

/** Inclusive length of the closing-date-to-year-end window, in days. */
export function programLengthDays(startedOn: string | null | undefined) {
  const end = programWindowEnd(startedOn);
  if (!startedOn || !end) return 0;
  const start = Date.parse(`${startedOn.slice(0, 10)}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  return Math.max(1, Math.round((last - start) / 86_400_000) + 1);
}

export function projectDay(startedOn: string | null | undefined) {
  if (!startedOn) return 0;
  const start = new Date(`${startedOn}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(0, Math.min(programLengthDays(startedOn), days));
}

export function daysRemaining(startedOn: string | null | undefined) {
  if (!startedOn) return 0;
  return Math.max(0, programLengthDays(startedOn) - projectDay(startedOn));
}

export function hoursFromMinutes(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatHours(minutes: number) {
  const h = Math.round((minutes / 60) * 10) / 10;
  return `${h} hr${h === 1 ? "" : "s"}`;
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr${h === 1 ? "" : "s"}`;
  return `${h} hr ${m} min`;
}

/* ------------------------------------------------------------------ */
/* Benchmark — program level only, never a task estimate               */
/* ------------------------------------------------------------------ */

/**
 * Cumulative pace benchmark for the whole program, independent of how many
 * homes are attached. 60 hours by day 35, 105 by day 90.
 */
export function benchmarkHours(day: number) {
  if (day <= 0) return 0;
  const d = Math.min(day, PROGRAM_TOTAL_DAYS);
  const raw =
    d <= ONBOARDING_MILESTONE_DAY
      ? ONBOARDING_MILESTONE_HOURS * (d / ONBOARDING_MILESTONE_DAY)
      : ONBOARDING_MILESTONE_HOURS + 45 * ((d - ONBOARDING_MILESTONE_DAY) / 55);
  return Math.min(OPERATING_TARGET_HOURS, Math.round(raw * 100) / 100);
}

export const BENCHMARK_MILESTONES = [7, 14, 21, 28, 35, 45, 60, 75, 85, 90].map((day) => ({
  day,
  hours: Math.round(benchmarkHours(day)),
}));

const FINAL_MILESTONE = { day: PROGRAM_TOTAL_DAYS, hours: OPERATING_TARGET_HOURS };

export function nextMilestone(day: number): { day: number; hours: number } {
  return BENCHMARK_MILESTONES.find((m) => m.day > day) ?? FINAL_MILESTONE;
}

/* ------------------------------------------------------------------ */
/* Progress status                                                     */
/* ------------------------------------------------------------------ */

export type ProgressState =
  | "not_started"
  | "on_track"
  | "slightly_behind"
  | "action_needed"
  | "significantly_behind"
  | "target_reached"
  | "program_completed";

export const PROGRESS_META: Record<ProgressState, { label: string; tone: string; dot: string }> = {
  not_started: {
    label: "Not started",
    tone: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  on_track: {
    label: "On track",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    dot: "bg-emerald-600",
  },
  slightly_behind: {
    label: "Slightly behind",
    tone: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    dot: "bg-amber-500",
  },
  action_needed: {
    label: "Action needed",
    tone: "bg-orange-500/10 text-orange-700 border-orange-500/20",
    dot: "bg-orange-500",
  },
  significantly_behind: {
    label: "Significantly behind",
    tone: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  target_reached: {
    label: "Target reached",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    dot: "bg-emerald-600",
  },
  program_completed: {
    label: "Program completed",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
    dot: "bg-emerald-600",
  },
};

export const PROGRESS_SEVERITY: Record<ProgressState, number> = {
  program_completed: 0,
  target_reached: 0,
  on_track: 1,
  not_started: 1,
  slightly_behind: 2,
  action_needed: 3,
  significantly_behind: 4,
};

export type ProgressSnapshot = {
  day: number;
  daysLeft: number;
  reportedHours: number;
  benchmark: number;
  variance: number;
  percentOfTarget: number;
  hoursToGoal: number;
  state: ProgressState;
  next: { day: number; hours: number };
};

/**
 * The single source of truth for program pace. `reportedMinutes` must already
 * be a distinct-entry total — never a sum of per-property rollups.
 */
export function progressSnapshot(input: {
  status: ProgramStatus;
  startedOn: string | null;
  reportedMinutes: number;
}): ProgressSnapshot {
  const day = projectDay(input.startedOn);
  const reportedHours = hoursFromMinutes(input.reportedMinutes);
  const benchmark = benchmarkHours(day);
  const variance = Math.round((reportedHours - benchmark) * 100) / 100;
  const active = Boolean(input.startedOn) && day > 0;

  let state: ProgressState;
  if (input.status === "completed" || input.status === "complete" || input.status === "closed") {
    state = "program_completed";
  } else if (ownerGoalMet(input.reportedMinutes)) {
    // Compare actual minutes so display rounding cannot satisfy the goal early.
    state = "target_reached";
  } else if (!active) {
    state = "not_started";
  } else {
    const behind = -variance;
    if (behind < 1) state = "on_track";
    else if (behind < 5) state = "slightly_behind";
    else if (behind < 10) state = "action_needed";
    else state = "significantly_behind";
  }

  return {
    day,
    daysLeft: daysRemaining(input.startedOn),
    reportedHours,
    benchmark,
    variance,
    percentOfTarget: Math.min(
      100,
      Math.round((reportedHours / OPERATING_TARGET_HOURS) * 1000) / 10,
    ),
    hoursToGoal: Math.ceil(Math.max(0, OWNER_GOAL_HOURS - input.reportedMinutes / 60) * 100) / 100,
    state,
    next: nextMilestone(day),
  };
}

/* ------------------------------------------------------------------ */
/* Property coverage — task based, never hour based                    */
/* ------------------------------------------------------------------ */

export type CoverageState =
  "no_activity" | "needs_attention" | "in_progress" | "launch_ready" | "complete";

export const COVERAGE_META: Record<CoverageState, { label: string; tone: string }> = {
  no_activity: {
    label: "No owner activity yet",
    tone: "bg-muted text-muted-foreground border-border",
  },
  needs_attention: {
    label: "Needs attention",
    tone: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  },
  in_progress: { label: "In progress", tone: "bg-primary/10 text-primary border-primary/20" },
  launch_ready: {
    label: "Launch ready",
    tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  complete: { label: "Complete", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
};

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export type BadgeKind = "hours" | "action" | "portfolio";

export type BadgeDef = {
  code: string;
  name: string;
  kind: BadgeKind;
  requirement: string;
  /** Combined reported hours needed, when this is an hour badge. */
  hours?: number;
};

export const BADGES: BadgeDef[] = [
  {
    code: "first_step",
    name: "First Step",
    kind: "hours",
    requirement: "Your first participation entry",
  },
  {
    code: "building_momentum",
    name: "Building Momentum",
    kind: "hours",
    hours: 10,
    requirement: "10 reported hours",
  },
  {
    code: "engaged_owner",
    name: "Engaged Owner",
    kind: "hours",
    hours: 25,
    requirement: "25 reported hours",
  },
  {
    code: "halfway",
    name: "Halfway Milestone",
    kind: "hours",
    hours: 50,
    requirement: "50 reported hours",
  },
  {
    code: "onboarding_champion",
    name: "Onboarding Champion",
    kind: "hours",
    hours: 60,
    requirement: "60 reported hours with onboarding activities substantially complete",
  },
  {
    code: "strong_finish",
    name: "Strong Finish",
    kind: "hours",
    hours: 75,
    requirement: "75 reported hours",
  },
  {
    code: "hundred_plus",
    name: "100-Hour Milestone",
    kind: "hours",
    hours: 100,
    requirement: "At least 100 reported hours",
  },
  {
    code: "program_complete",
    name: "Program Complete",
    kind: "action",
    requirement: "ARHA has completed the formal program closeout",
  },
  {
    code: "decision_maker",
    name: "Decision Maker",
    kind: "action",
    requirement: "Your first completed owner decision",
  },
  {
    code: "consistent_participation",
    name: "Consistent Participation",
    kind: "action",
    requirement: "Activity reported in three separate program weeks",
  },
  {
    code: "on_track_owner",
    name: "On-Track Owner",
    kind: "action",
    requirement: "Met three consecutive weekly benchmarks",
  },
  {
    code: "responsive_partner",
    name: "Responsive Partner",
    kind: "action",
    requirement: "Ten owner activities completed by their response dates",
  },
  {
    code: "property_launch_partner",
    name: "Property Launch Partner",
    kind: "action",
    requirement: "Required pre-launch decisions completed for a property",
  },
  {
    code: "portfolio_participant",
    name: "Portfolio Participant",
    kind: "portfolio",
    requirement: "At least one property-specific activity completed for every included home",
  },
  {
    code: "portfolio_decision_maker",
    name: "Portfolio Decision Maker",
    kind: "portfolio",
    requirement: "Required owner decisions completed across all included homes",
  },
  {
    code: "portfolio_launch_partner",
    name: "Portfolio Launch Partner",
    kind: "portfolio",
    requirement: "Every included home has met its launch-readiness requirements",
  },
];

export const BADGE_BY_CODE = Object.fromEntries(BADGES.map((b) => [b.code, b])) as Record<
  string,
  BadgeDef
>;

export const BADGE_HOURS_NOTE =
  "Hour milestones are based on participation you reported yourself. Badges never add, estimate or suggest time, and they do not imply tax qualification.";

/** The next hour badge the owner is working toward, with a share of progress. */
export function nextHourBadge(reportedHours: number, earned: string[]) {
  const remaining = BADGES.filter(
    (b) => b.kind === "hours" && b.hours != null && !earned.includes(b.code),
  ).sort((a, b) => (a.hours ?? 0) - (b.hours ?? 0));
  const target = remaining[0];
  if (!target || target.hours == null) return null;
  return {
    badge: target,
    percent: Math.min(100, Math.round((reportedHours / target.hours) * 100)),
    hoursAway: Math.max(0, Math.round((target.hours - reportedHours) * 10) / 10),
  };
}

/** A photo attached to an owner decision (stored in owner_reviews.photos). */
export type ReviewPhoto = { url: string; caption?: string | null };

/** Parses the `photos` jsonb column into a safe, serializable list. */
export function parseReviewPhotos(raw: unknown): ReviewPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (typeof p === "string" ? { url: p } : (p as ReviewPhoto)))
    .filter((p) => p && typeof p.url === "string" && p.url.length > 0)
    .map((p) => ({ url: p.url, caption: p.caption ?? null }));
}

/** Corrections replace earlier entries; returned work does not count toward progress. */
export function countableParticipationEntries<
  T extends { id: string; amends_entry_id: string | null; review_status: string },
>(entries: T[]): T[] {
  const superseded = new Set(entries.map((entry) => entry.amends_entry_id).filter(Boolean));
  return entries.filter((entry) => entry.review_status !== "returned" && !superseded.has(entry.id));
}

/** One inclusive 90-day window; historical rows remain available outside it. */
export function participationWindowEnd(
  startedOn: string | null | undefined,
  endsOn?: string | null,
) {
  if (!startedOn) return null;
  const start = new Date(`${startedOn}T00:00:00Z`);
  if (!Number.isFinite(start.getTime())) return null;
  start.setUTCDate(start.getUTCDate() + PROGRAM_TOTAL_DAYS - 1);
  const lastDay = start.toISOString().slice(0, 10);
  return endsOn && endsOn < lastDay ? endsOn : lastDay;
}

export function inParticipationWindow(
  date: string,
  startedOn: string | null | undefined,
  endsOn?: string | null,
  today = new Date().toISOString().slice(0, 10),
) {
  const end = participationWindowEnd(startedOn, endsOn);
  return !!startedOn && !!end && date >= startedOn && date <= end && date <= today;
}

/** Use counted minutes, never rounded display hours, to decide completion. */
export function ownerGoalMet(reportedMinutes: number): boolean {
  return Number.isFinite(reportedMinutes) && reportedMinutes >= OWNER_GOAL_HOURS * 60;
}
