// Active Owner plan engine (pass 1): pure, browser-safe rules.
// Mirrors docs/pending/ao-engine/01_engine_foundation.sql. Times are America/Chicago.

export type Lane = "critical" | "launch" | "flexible" | "triggered";
export type StageWindow = "onboarding_early" | "onboarding_launch" | "anytime" | "operations";
export type HomeStage = "onboarding_early" | "onboarding_launch" | "operations";

export interface LibraryCard {
  id: string;
  title: string;
  lane: Lane;
  stageWindow: StageWindow;
  teamNeedsThis: boolean;
  lockRule: "none" | "until_linked_step_done";
  /** Read-only references; may list matching steps in both Full Plan and Standard. */
  linkedTemplateStepIds: readonly string[];
  deadlineBusinessDays: number;
  cutoffBusinessDays: number; // ARHA cutoff = deadline + N business days at 9:00 am
  takeoverText: string;
}

export type JoinOutcome = "skipped_passed" | "already_covered" | "locked" | "open";

const STAGE_ORDER: Record<HomeStage, number> = { onboarding_early: 0, onboarding_launch: 1, operations: 2 };

/** Joining at the current stage: passed windows are skipped, covered work is marked, the rest appears on day one. */
export function joinOutcome(
  card: LibraryCard,
  homeStage: HomeStage,
  coveredCardIds: ReadonlySet<string>,
  linkedTaskDone: boolean,
): JoinOutcome {
  if (card.stageWindow !== "anytime" && STAGE_ORDER[card.stageWindow] < STAGE_ORDER[homeStage]) return "skipped_passed";
  if (coveredCardIds.has(card.id)) return "already_covered";
  if (card.lockRule === "until_linked_step_done" && !linkedTaskDone) return "locked";
  return "open";
}

export function lockedLabel(waitingOn: string): string {
  return `Coming soon: waiting on ARHA to ${waitingOn}`;
}

export function isBusinessDay(ymd: string, holidays: ReadonlySet<string> = new Set()): boolean {
  const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
  return dow !== 0 && dow !== 6 && !holidays.has(ymd);
}

export function addBusinessDays(ymd: string, n: number, holidays: ReadonlySet<string> = new Set()): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  let left = n;
  const step = n >= 0 ? 1 : -1;
  while (left !== 0) {
    d.setUTCDate(d.getUTCDate() + step);
    if (isBusinessDay(d.toISOString().slice(0, 10), holidays)) left -= step;
  }
  return d.toISOString().slice(0, 10);
}

/** Calendar date in Central time for an instant. */
export function centralDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Instant for a Central wall-clock time on a date (handles daylight saving). */
export function centralInstant(ymd: string, hh: number, mm = 0): Date {
  const guess = new Date(`${ymd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit" }).formatToParts(guess);
  const h = Number(parts.find((p) => p.type === "hour")!.value) % 24;
  const day = Number(parts.find((p) => p.type === "day")!.value);
  let offsetH = hh - h;
  if (day !== guess.getUTCDate()) offsetH += day < guess.getUTCDate() ? 24 : -24;
  return new Date(guess.getTime() + offsetH * 3600_000);
}

export interface Clock { deadline: Date; reminder: Date; cutoff: Date }

/** Clock starts at unlock: deadline 5:00 pm, reminder 1 business day before, ARHA cutoff next business day 9:00 am. */
export function cardClock(card: LibraryCard, unlockedAt: Date, holidays: ReadonlySet<string> = new Set()): Clock {
  const start = centralDate(unlockedAt);
  const dl = addBusinessDays(start, card.deadlineBusinessDays, holidays);
  return {
    deadline: centralInstant(dl, 17),
    reminder: centralInstant(addBusinessDays(dl, -1, holidays), 17),
    cutoff: centralInstant(addBusinessDays(dl, Math.max(1, card.cutoffBusinessDays), holidays), 9),
  };
}

export type ClockEvent = "none" | "send_reminder" | "expire";

/** Flexible cards have a target only: never a reminder or takeover. */
export function dueEvent(card: LibraryCard, clock: Clock, now: Date, reminderSent: boolean, closed: boolean): ClockEvent {
  if (closed || card.lane === "flexible") return "none";
  if (now >= clock.cutoff) return "expire";
  if (now >= clock.reminder && !reminderSent) return "send_reminder";
  return "none";
}

export const EXPIRED_LABEL = "Owner opportunity expired, ARHA completed";
export function expiryAlertText(cardTitle: string): string {
  return `Homeowner did not complete ${cardTitle}; proceed as normal`;
}
export const VERIFY_BADGE = "Homeowner completed: verify";

/** Owner pace: weekly hours needed to reach the goal by the program end date. */
export function ownerPace(loggedHours: number, now: Date, endDate: Date, goal = 100, plannedWeekly?: number) {
  const remaining = Math.max(0, goal - loggedHours);
  const weeks = Math.max(1 / 7, (endDate.getTime() - now.getTime()) / (7 * 86400_000));
  const weeklyNeeded = Math.round((remaining / weeks) * 10) / 10;
  const onTrack = remaining === 0 || (plannedWeekly !== undefined ? plannedWeekly >= weeklyNeeded : weeklyNeeded <= 10);
  return { weeklyNeeded, onTrack, label: onTrack ? "On track" : "Behind" };
}

/** Send to Active Owner is offered only when the home has an active program. */
export function canSendToActiveOwner(programStatus: string | null | undefined): boolean {
  return programStatus === "active";
}

export function contributionsCsv(rows: { card: string; home: string; member: string; submittedAt: string; values: Record<string, unknown> }[]): string {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r.values)))].sort();
  const esc = (v: unknown) => {
    const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Card", "Home", "Submitted by", "Submitted at", ...keys].map(esc).join(",");
  return [head, ...rows.map((r) => [r.card, r.home, r.member, r.submittedAt, ...keys.map((k) => r.values[k])].map(esc).join(","))].join("\n");
}

/** Finds the home's own Task created from any linked template step, whichever template the home uses. Read-only. */
export function matchLinkedTask<T extends { id: string; template_task_id: string | null }>(card: LibraryCard, homeTasks: readonly T[]): T | null {
  return homeTasks.find((t) => t.template_task_id != null && card.linkedTemplateStepIds.includes(t.template_task_id)) ?? null;
}
