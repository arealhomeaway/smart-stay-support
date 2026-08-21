// Shared (client-safe) types and rules for the quarterly property review cycle.

/** Name of the catalog work type that carries the quarterly review standard. */
export const QUARTERLY_WORK_TYPE = "Quarterly inspection review";

/** How many days ahead a home shows up as "coming up". */
export const QUARTERLY_LOOKAHEAD_DAYS = 21;

export type QuarterlyState = "in_progress" | "overdue" | "due" | "upcoming" | "current";

export type QuarterlyRow = {
  propertyId: string;
  name: string;
  location: string;
  lastReviewedAt: string | null;
  dueOn: string;
  openTicketId: string | null;
  openTicketRef: number | null;
  status: QuarterlyState;
};

/** Whole days from today until the due date (negative when overdue). */
export function daysUntil(dueOn: string) {
  const due = new Date(`${dueOn}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function quarterlyStatus(dueOn: string, hasOpenReview: boolean): QuarterlyState {
  if (hasOpenReview) return "in_progress";
  const days = daysUntil(dueOn);
  if (days < 0) return "overdue";
  if (days === 0) return "due";
  if (days <= QUARTERLY_LOOKAHEAD_DAYS) return "upcoming";
  return "current";
}

export const QUARTERLY_LABELS: Record<QuarterlyState, { label: string; tone: string }> = {
  in_progress: { label: "Review in progress", tone: "bg-primary/10 text-primary border-primary/20" },
  overdue: { label: "Overdue", tone: "bg-destructive/10 text-destructive border-destructive/20" },
  due: { label: "Due today", tone: "bg-destructive/10 text-destructive border-destructive/20" },
  upcoming: { label: "Coming up", tone: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  current: { label: "Up to date", tone: "bg-muted text-muted-foreground border-border" },
};
