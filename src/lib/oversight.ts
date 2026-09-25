/**
 * Cross-team oversight aggregation — pure, no data access.
 */

import { currentOwnerId } from "@/lib/matters";

export type WorkloadTicket = {
  current_action_owner: string | null;
  assigned_to: string | null;
  record_owner?: string | null;
  accountable_owner?: string | null;
};

export type WorkloadEntry = { id: string; who: string; count: number };

/**
 * Open work grouped by whoever currently owns it, most-loaded first.
 *
 * `id` is either a real user id or the literal `"unassigned"` — the exact
 * value Team Queue's own `?assignee=` filter already accepts, so a
 * supervisor's Oversight bar can link straight into that person's (or
 * unassigned work's) filtered queue with no translation step.
 */
export function workloadByPerson(
  tickets: WorkloadTicket[],
  nameFor: (id: string) => string,
): WorkloadEntry[] {
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    const key = currentOwnerId(t) ?? "unassigned";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([id, count]) => ({ id, who: id === "unassigned" ? "Unassigned" : nameFor(id), count }))
    .sort((a, b) => b.count - a.count);
}
