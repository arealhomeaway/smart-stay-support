/** Pure rules for the After-handoff owner plan and follow-up screen. */

export type PlanItem = {
  id: string;
  title: string;
  source_kind: "template" | "library";
  template_id: string | null;
  library_id: string | null;
  send_after_days: number;
  active: boolean;
  sort_order: number;
  notes: string | null;
};

export type ScheduleRow = {
  id: string;
  program_id: string;
  property_id: string;
  title: string;
  source_kind: "template" | "library";
  send_on: string;
  status: "scheduled" | "sent" | "skipped" | "cancelled" | "failed";
  one_off: boolean;
};

export type WaitingItem = { id: string; title: string; property_id: string | null; sent_at: string; responded_at: string | null; status: string };

export function dayLabel(days: number) {
  return `Day ${days}`;
}

export function sourceLabel(kind: "template" | "library") {
  return kind === "template" ? "Owner task template" : "Optional Library item";
}

/** Sorted by send day, then by the saved order within a day. */
export function sortPlan<T extends Pick<PlanItem, "send_after_days" | "sort_order">>(items: T[]): T[] {
  return [...items].sort((a, b) => a.send_after_days - b.send_after_days || a.sort_order - b.sort_order);
}

/** Move one item up or down among items that share its send day. Returns the full id order. */
export function moveWithinDay(items: PlanItem[], id: string, dir: -1 | 1): string[] {
  const sorted = sortPlan(items);
  const i = sorted.findIndex((x) => x.id === id);
  const j = i + dir;
  const a = sorted[i];
  const b = sorted[j];
  if (!a || !b || a.send_after_days !== b.send_after_days) return sorted.map((x) => x.id);
  sorted[i] = b;
  sorted[j] = a;
  return sorted.map((x) => x.id);
}

function dayNumber(iso: string) {
  return Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/** Scheduled rows due within the next 30 days (including overdue), soonest first. */
export function scheduledNext30(rows: ScheduleRow[], todayIso: string) {
  const today = dayNumber(todayIso);
  return rows
    .filter((r) => r.status === "scheduled" && dayNumber(r.send_on) <= today + 30)
    .sort((a, b) => a.send_on.localeCompare(b.send_on));
}

export function sentRows(rows: ScheduleRow[]) {
  return rows.filter((r) => r.status === "sent").sort((a, b) => b.send_on.localeCompare(a.send_on));
}

/** Sent and unanswered homeowner items, oldest first, with days waiting. */
export function waitingOnHomeowner(items: WaitingItem[], todayIso: string) {
  const today = dayNumber(todayIso);
  return items
    .filter((w) => w.status === "open" && w.sent_at && !w.responded_at)
    .map((w) => ({ ...w, daysWaiting: Math.max(0, today - dayNumber(w.sent_at)) }))
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at));
}

export const SENDING_OFF_BANNER = "Sending is off. Scheduled tasks are not sent yet.";
export const PLAN_CHANGE_NOTE = "Changes apply to homes handed off after you save. Homes already scheduled keep their schedule.";
