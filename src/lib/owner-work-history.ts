import { loggedMinutes } from '@/lib/owner-portal-look';
export type WorkHistoryRow = {
 id: string; entryId: string | null; saveId: string | null; source: string; cardId: string | null;
 reviewId?: string | null; title: string; kind: 'Card' | 'Added work'; date: string; savedAt: string; activity: string | null;
 minutes: number; superseded: boolean; actorId: string | null; values: Record<string, string | number | boolean | null>;
 files: { document_id: string; name: string }[]; paths: string[]; propertyIds: string[]; flagged: boolean;
};
export function historyTotals(rows: WorkHistoryRow[]) {
 const minutes = loggedMinutes(rows.map(r => ({ ...r, propertyIds: r.propertyIds ?? [] })));
 return { hours: minutes / 60, to100: Math.max(0, (6001 - minutes) / 60), to120: Math.max(0, (7200 - minutes) / 60) };
}
export function duplicateHistoryIds(rows: WorkHistoryRow[]): Set<string> {
 const groups = new Map<string, string[]>();
 for (const r of rows) {
  if (!r.entryId || r.superseded) continue;
  const key = JSON.stringify([r.date.slice(0,10),r.minutes,r.activity ?? '']);
  groups.set(key,[...(groups.get(key) ?? []),r.id]);
 }
 return new Set([...groups.values()].filter(g => g.length > 1).flat());
}
