/**
 * Shared (browser-safe) model for the Active Owner Participation Program.
 *
 * The program is a 90-day operating window per home. ARHA sets the roadmap,
 * the homeowner does the reviews and self-reports the time they actually
 * spent. Nothing in here ever suggests an amount of time to an owner: the
 * planning ranges exist so ARHA can staff the roadmap, and stay internal.
 */

export const PROGRAM_DAYS = 90;

/** ARHA's split: 60 hours getting the home open, 40+ running it. */
export const DEFAULT_TARGET_HOURS = 100;
export const DEFAULT_ONBOARDING_HOURS = 60;
export const DEFAULT_ONGOING_HOURS = 40;

export type ProgramPhase = "onboarding" | "ongoing";
export type ProgramStatus = "pending" | "active" | "complete" | "paused";
export type DecisionPath = "inform" | "consult" | "approve" | "time_sensitive";
export type ReviewStatus = "prepared" | "awaiting_owner" | "answered" | "closed";

export const PHASE_LABELS: Record<ProgramPhase, string> = {
  onboarding: "Onboarding + launch",
  ongoing: "Ongoing operations",
};

export const ONBOARDING_STAGES = ["Discover + assess", "Plan + prepare", "Verify + launch"] as const;
export const ONGOING_STAGES = ["Recurring", "Periodic"] as const;

export const DECISION_PATHS: Record<DecisionPath, { label: string; blurb: string; tone: string }> = {
  inform: {
    label: "Inform",
    blurb: "ARHA acts within approved authority, then shares the outcome for review.",
    tone: "bg-muted text-muted-foreground border-border",
  },
  consult: {
    label: "Consult",
    blurb: "ARHA asks for the owner's input before settling the direction.",
    tone: "bg-primary/10 text-primary border-primary/20",
  },
  approve: {
    label: "Approve",
    blurb: "The owner authorizes a material or discretionary choice before ARHA proceeds.",
    tone: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  time_sensitive: {
    label: "Time-sensitive",
    blurb: "Urgent work keeps moving within approved authority; the outcome is shared after.",
    tone: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, { label: string; tone: string }> = {
  pending: { label: "Not started", tone: "bg-muted text-muted-foreground border-border" },
  active: { label: "In progress", tone: "bg-primary/10 text-primary border-primary/20" },
  complete: { label: "Complete", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  paused: { label: "Paused", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
};

export type TaskTemplate = {
  id: string;
  phase: ProgramPhase;
  stage: string;
  code: string;
  title: string;
  summary: string | null;
  owner_action: string;
  decision_path: DecisionPath;
  planning_hours_low: number;
  planning_hours_high: number;
  respond_within_days: number;
  recurring: boolean;
  sort_order: number;
};

export type ProgramRow = {
  id: string;
  propertyId: string;
  propertyName: string;
  location: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLinked: boolean;
  status: ProgramStatus;
  startedOn: string | null;
  endsOn: string | null;
  targetHours: number;
  onboardingTargetHours: number;
  ongoingTargetHours: number;
  reviewCount: number;
  openReviewCount: number;
  reportedMinutes: number;
  onboardingMinutes: number;
  ongoingMinutes: number;
};

export function hoursFromMinutes(minutes: number) {
  return Math.round((minutes / 60) * 10) / 10;
}

export function formatHours(minutes: number) {
  const h = hoursFromMinutes(minutes);
  return `${h} hr${h === 1 ? "" : "s"}`;
}

/** Whole days elapsed in the 90-day window (0 before it starts). */
export function programDay(startedOn: string | null) {
  if (!startedOn) return 0;
  const start = new Date(`${startedOn}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(0, Math.min(PROGRAM_DAYS, days));
}

export function daysRemaining(startedOn: string | null) {
  if (!startedOn) return PROGRAM_DAYS;
  return Math.max(0, PROGRAM_DAYS - programDay(startedOn));
}

/**
 * Is participation keeping pace with the calendar? A home 60 days into the
 * window with 20 hours logged is the situation we want surfaced early, while
 * there is still time to schedule the remaining reviews.
 */
export function paceState(startedOn: string | null, reportedMinutes: number, targetHours: number) {
  const day = programDay(startedOn);
  if (!startedOn || day === 0) return { state: "not_started" as const, expectedHours: 0, gapHours: 0 };
  const expectedHours = Math.round((targetHours * (day / PROGRAM_DAYS)) * 10) / 10;
  const actual = hoursFromMinutes(reportedMinutes);
  const gapHours = Math.round((expectedHours - actual) * 10) / 10;
  if (actual >= targetHours) return { state: "target_met" as const, expectedHours, gapHours };
  if (gapHours <= 0) return { state: "on_pace" as const, expectedHours, gapHours };
  if (gapHours <= targetHours * 0.1) return { state: "slipping" as const, expectedHours, gapHours };
  return { state: "behind" as const, expectedHours, gapHours };
}

export const PACE_LABELS = {
  not_started: { label: "Not started", tone: "bg-muted text-muted-foreground border-border" },
  on_pace: { label: "On pace", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  slipping: { label: "Slipping", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  behind: { label: "Behind pace", tone: "bg-destructive/10 text-destructive border-destructive/20" },
  target_met: { label: "Target met", tone: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
} as const;

/** Owner-facing invite codes: unambiguous characters only, easy to read aloud. */
export function inviteCodeLooksValid(code: string) {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.trim().toUpperCase());
}
