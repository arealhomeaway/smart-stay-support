export type OwnerAttentionInput = {
  status: string;
  goalMet: boolean;
  variance: number;
  lastOwnerActivityAt: string | null;
  openTasks: number;
  daysLeft: number;
  properties: { overdue: number; coverage: string }[];
  /** When the program was created or activated, whichever is later; unknown keeps the rule as before. */
  programSince?: string | null;
};

/** The later of created and activated, for the quiet-week rule. */
export function programSince(createdAt: string | null | undefined, activatedAt: string | null | undefined) {
  const times = [createdAt, activatedAt].filter((v): v is string => Boolean(v));
  if (!times.length) return null;
  return times.reduce((a, b) => (new Date(b).getTime() > new Date(a).getTime() ? b : a));
}

/** Shared staff queue rule: reaching the goal clears pace warnings, not unfinished work. */
export function ownerAttention(row: OwnerAttentionInput) {
  if (!["active", "target_reached"].includes(row.status)) return null;
  const quietDays = row.lastOwnerActivityAt
    ? Math.floor((Date.now() - new Date(row.lastOwnerActivityAt).getTime()) / 86_400_000)
    : Infinity;
  const behind = -row.variance;
  if (!row.goalMet && behind >= 10) return { rank: 1, reason: "10+ hours behind pace" };
  if (!row.goalMet && behind >= 5) return { rank: 2, reason: "5+ hours behind pace" };
  // A program younger than 7 days cannot have been quiet for 7 days.
  const ageDays = row.programSince
    ? Math.floor((Date.now() - new Date(row.programSince).getTime()) / 86_400_000)
    : Infinity;
  if (quietDays >= 7 && ageDays >= 7 && row.openTasks > 0)
    return { rank: 3, reason: "No activity for 7 days with open tasks" };
  if (row.daysLeft < 10 && !row.goalMet)
    return { rank: 4, reason: "Under 10 days remaining and below 100 hours" };
  if (row.properties.some((p) => p.overdue > 0))
    return { rank: 5, reason: "Overdue property decisions" };
  if (row.properties.some((p) => p.coverage === "no_activity"))
    return { rank: 6, reason: "A property has no owner activity yet" };
  if (!row.goalMet && behind >= 1) return { rank: 7, reason: "Slightly behind pace" };
  return null;
}
