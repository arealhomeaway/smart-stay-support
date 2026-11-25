/** Oversight bulk selection rules (change 4, item 2). A rolled-up reported issues row stands for every issue inside it. */
export type OpenRow = {
  id: string; ref?: number | null; title?: string | null; status: string; priority?: string | null;
  assigned_to?: string | null; due_on?: string | null; due_locked?: boolean | null;
  property_id?: string | null; properties?: unknown; rollup?: OpenRow[];
};

/** Ticket ids a selection touches: a rolled-up row expands to all its issues. */
export function selectedTicketIds(rows: OpenRow[]): string[] {
  return Array.from(new Set(rows.flatMap((r) => (r.rollup?.length ? r.rollup.map((x) => x.id) : [r.id]))));
}

/** Whether any selected ticket (inside roll-ups too) has a locked due date, so one reason is asked for. */
export function anyLocked(rows: OpenRow[]): boolean {
  return rows.some((r) => (r.rollup?.length ? r.rollup.some((x) => Boolean(x.due_locked)) : Boolean(r.due_locked)));
}
