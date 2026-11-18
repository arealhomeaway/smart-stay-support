/**
 * Ticket Due date (Emily, Nov 18). The date is set once by the database when a ticket is created
 * (Right now and Today: that day; Routine: seven days later, Central) and changed only through
 * set_ticket_due_on. These helpers only read it: today in Central time, the label and overdue days.
 */
const CENTRAL = "America/Chicago";
const DONE = ["resolved", "closed"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Today's date in Central time as YYYY-MM-DD. */
export function centralToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CENTRAL, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function parts(day: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
}

/** Whole days from a to b (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  if (!pa || !pb) return 0;
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** "Today", "Tomorrow", "Nov 20", or "Nov 20, 2027" for another year. */
export function dueDateLabel(dueOn: string, now = new Date()): string {
  const today = centralToday(now);
  const gap = daysBetween(today, dueOn);
  if (gap === 0) return "Today";
  if (gap === 1) return "Tomorrow";
  const p = parts(dueOn);
  if (!p) return dueOn;
  const year = p.y !== parts(today)?.y ? `, ${p.y}` : "";
  return `${MONTHS[p.m - 1]} ${p.d}${year}`;
}

/** Days past the due date for an open ticket; 0 when not overdue, resolved, closed or no date. */
export function dueOverdueDays(t: { status?: string | null; due_on?: string | null }, now = new Date()): number {
  if (!t.due_on || DONE.includes(String(t.status ?? ""))) return 0;
  return Math.max(0, daysBetween(t.due_on, centralToday(now)));
}

/** "Overdue by 1 day", "Overdue by 3 days". */
export function overdueByDays(days: number): string {
  return `Overdue by ${days} ${days === 1 ? "day" : "days"}`;
}

/** The end of the due day in Central time, for "soonest due" ordering. */
export function dueOnEndIso(dueOn: string): string {
  const p = parts(dueOn);
  if (!p) return dueOn;
  // Central is UTC-6 or UTC-5; take 23:59 Central by checking which offset lands on that day.
  for (const offset of [5, 6]) {
    const at = new Date(Date.UTC(p.y, p.m - 1, p.d, 23 + offset, 59, 59));
    if (centralToday(at) === dueOn) return at.toISOString();
  }
  return new Date(Date.UTC(p.y, p.m - 1, p.d + 1, 5, 59, 59)).toISOString();
}
