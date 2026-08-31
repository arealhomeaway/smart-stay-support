/**
 * Excludes rows that reference a demo or pre-launch-archived ticket, for
 * tables that carry no `is_demo`/`archived_at` column of their own (e.g.
 * `vendor_job_ratings`) and can only be scoped by checking the ticket they
 * point at via `ticket_id`.
 *
 * Used by src/lib/scorecard.server.ts (vendor scorecards/scoreboard) and
 * src/lib/command-center.server.ts (Executive Command Center vendor KPIs) so
 * both share one definition of "live" instead of two independent copies.
 */
export function excludeNonLiveTicketRows<T extends { ticket_id: string }>(
  rows: T[],
  liveTicketIds: ReadonlySet<string>,
): T[] {
  return rows.filter((r) => liveTicketIds.has(r.ticket_id));
}
