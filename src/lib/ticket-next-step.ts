/**
 * The "Do this now" line on a ticket (register T5, T13). Pure and browser-safe.
 *
 * One next step with its due time. A step a person wrote on the ticket
 * (tickets.next_action and next_action_due_at) wins; otherwise the step is the
 * ticket's current action and its due time comes from the clocks the ticket
 * already runs. This only words the line. It writes nothing and changes no
 * clock, SLA or alert.
 */

export const NEXT_STEP_COPY = {
  heading: "Do this now",
  continue: "Continue",
  change: "Change next step",
  stepLabel: "Next step",
  dueLabel: "Due",
  save: "Save next step",
  cancel: "Cancel",
  clear: "Use the suggested step",
  done: "Done",
  saved: "Next step saved.",
  cleared: "Next step done.",
  tooShort: "Write the next step in a few words.",
  tooLong: "Keep the next step under 200 characters.",
  badDue: "Pick a due time that is a real date and time.",
} as const;

export type NextStepInput = {
  /** A step a person wrote on the ticket, if any. */
  customStep?: string | null;
  customDueAt?: string | null;
  /** The ticket's current action title, when there is no written step. */
  derivedLabel?: string | null;
  /** The due time from the ticket's own clocks for the current action. */
  derivedDueAt?: string | null;
};

export type NextStepView = {
  label: string;
  dueAt: string | null;
  late: boolean;
  /** True when a person wrote this step on the ticket. */
  custom: boolean;
  /** The line shown on the card. */
  line: string;
};

function lowerFirst(s: string) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** "5 min", "1 hour", "3 hours", "3 days". */
export function lateSpan(ms: number): string {
  const mins = Math.max(1, Math.round(ms / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (mins < 60 * 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(mins / 1440);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "3 PM", "3:30 PM", "tomorrow 3 PM", "Thu 11/12, 3 PM". Viewer's own clock, like the rest of the ticket. */
export function dueText(due: Date, now: Date): string {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    ...(due.getMinutes() === 0 ? {} : { minute: "2-digit" }),
  }).format(due);
  if (sameDay(due, now)) return time;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(due, tomorrow)) return `tomorrow ${time}`;
  const day = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "numeric", day: "numeric" }).format(due);
  return `${day.replace(",", "")}, ${time}`;
}

export function nextStepView(input: NextStepInput, now: Date = new Date()): NextStepView | null {
  const written = (input.customStep ?? "").trim();
  const custom = written.length > 0;
  const label = custom ? written : (input.derivedLabel ?? "").trim();
  if (!label) return null;
  const dueAt = custom ? (input.customDueAt ?? null) : (input.derivedDueAt ?? null);
  const due = dueAt ? new Date(dueAt) : null;
  const validDue = due && !Number.isNaN(due.getTime()) ? due : null;
  const shown = custom ? label : lowerFirst(label);
  if (validDue && validDue.getTime() < now.getTime()) {
    return { label, dueAt, late: true, custom, line: `${label}: ${lateSpan(now.getTime() - validDue.getTime())} late` };
  }
  return {
    label,
    dueAt: validDue ? dueAt : null,
    late: false,
    custom,
    line: validDue ? `${NEXT_STEP_COPY.stepLabel}: ${shown}, due ${dueText(validDue, now)}` : `${NEXT_STEP_COPY.stepLabel}: ${shown}`,
  };
}

/** Checks a person's edit before it is saved. Returns the problem, or null. */
export function nextStepProblem(step: string, dueLocal: string): string | null {
  const s = step.trim();
  if (s.length < 3) return NEXT_STEP_COPY.tooShort;
  if (s.length > 200) return NEXT_STEP_COPY.tooLong;
  if (dueLocal && Number.isNaN(new Date(dueLocal).getTime())) return NEXT_STEP_COPY.badDue;
  return null;
}

/** The history line written with every change, read with who and when on the ticket. */
export function nextStepHistoryLine(step: string | null, dueIso: string | null, format: (iso: string) => string): string {
  if (!step) return "Next step done. Back to the suggested step.";
  return dueIso ? `Next step changed: ${step}. Due ${format(dueIso)}.` : `Next step changed: ${step}. No due time.`;
}
