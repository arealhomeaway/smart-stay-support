/**
 * Waiting never counts against the person (register T13). Pure and browser-safe.
 *
 * Waiting spans come from the add-only ticket_state_log (field 'waiting',
 * change 'started' / 'ended'). Minutes inside a span are taken out of any
 * elapsed time that is credited to a person or the team, so time spent
 * waiting on the guest, owner, vendor or anyone else is never theirs.
 */

export type WaitingLogRow = {
  ticket_id: string;
  change: string;
  recorded_at: string;
};

/** Waiting spans per ticket. An open span ends at `openEnd` (or stays open as null). */
export function waitingSpans(rows: WaitingLogRow[]): Map<string, { from: number; to: number | null }[]> {
  const byTicket = new Map<string, WaitingLogRow[]>();
  for (const r of rows) {
    const list = byTicket.get(r.ticket_id) ?? [];
    list.push(r);
    byTicket.set(r.ticket_id, list);
  }
  const out = new Map<string, { from: number; to: number | null }[]>();
  for (const [id, list] of byTicket) {
    list.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    const spans: { from: number; to: number | null }[] = [];
    let start: number | null = null;
    for (const r of list) {
      const at = new Date(r.recorded_at).getTime();
      if (Number.isNaN(at)) continue;
      if (r.change === "started" && start === null) start = at;
      else if (r.change === "ended" && start !== null) {
        spans.push({ from: start, to: at });
        start = null;
      }
    }
    if (start !== null) spans.push({ from: start, to: null });
    out.set(id, spans);
  }
  return out;
}

/** Minutes from `fromIso` to `toIso` with every waiting minute taken out. Never below zero. */
export function minutesExcludingWaiting(
  fromIso: string,
  toIso: string,
  spans: { from: number; to: number | null }[] | undefined,
): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0;
  let waited = 0;
  for (const s of spans ?? []) {
    const a = Math.max(from, s.from);
    const b = Math.min(to, s.to ?? to);
    if (b > a) waited += b - a;
  }
  return Math.max(0, Math.round((to - from - waited) / 60000));
}
