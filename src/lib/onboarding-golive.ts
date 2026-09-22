/**
 * Target go-live countdown and the one thing most in the way.
 *
 * Pure and read-only: it reads the target handoff date and the blockers the
 * lifecycle model already derives, and answers the two questions a project
 * manager asks at a glance — how long is left, and what is holding it up.
 */
import type { Blocker } from "./onboarding-lifecycle";

/** Which kind of blocker speaks for the project when several are open. */
const KIND_ORDER: Blocker["kind"][] = [
  "access",
  "owner",
  "review",
  "correction",
  "dependency",
  "evidence",
  "field",
  "other",
];

export type GoLiveCountdown = {
  /** Stored calendar date (YYYY-MM-DD), or null when no target exists. */
  target: string | null;
  /** Whole days from today to the target; negative once the date has passed. */
  daysRemaining: number | null;
  state: "none" | "live" | "on_track" | "soon" | "overdue";
  /** Plain-language countdown, e.g. "12 days remaining". */
  countdownLabel: string;
  /** What the project is most waiting on right now. */
  bottleneck: string | null;
  bottleneckOwner: string | null;
  bottleneckTaskId: string | null;
};

function dayNumber(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / 86_400_000);
}

export function goLiveCountdown(input: {
  target: string | null;
  blockers: Blocker[];
  accepted: boolean;
  /** Today as YYYY-MM-DD; supplied so the result is deterministic. */
  today: string;
}): GoLiveCountdown {
  const primary =
    [...input.blockers].sort(
      (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
    )[0] ?? null;

  const base = {
    target: input.target,
    bottleneck: primary ? primary.what : null,
    bottleneckOwner: primary ? primary.owner : null,
    bottleneckTaskId: primary && primary.taskId ? primary.taskId : null,
  };

  if (input.accepted)
    return {
      ...base,
      daysRemaining: null,
      state: "live",
      countdownLabel: "Live with Operations",
      bottleneck: null,
      bottleneckOwner: null,
      bottleneckTaskId: null,
    };

  const targetDay = input.target ? dayNumber(input.target) : null;
  const todayDay = dayNumber(input.today);
  if (targetDay === null || todayDay === null)
    return { ...base, daysRemaining: null, state: "none", countdownLabel: "No target date set" };

  const days = targetDay - todayDay;
  if (days < 0)
    return {
      ...base,
      daysRemaining: days,
      state: "overdue",
      countdownLabel: `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} past target`,
    };
  if (days === 0) return { ...base, daysRemaining: 0, state: "soon", countdownLabel: "Target is today" };
  return {
    ...base,
    daysRemaining: days,
    state: days <= 7 ? "soon" : "on_track",
    countdownLabel: `${days} ${days === 1 ? "day" : "days"} remaining`,
  };
}

/** Today in the viewer's calendar, as a stored-style YYYY-MM-DD string. */
export function todayCalendarDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
