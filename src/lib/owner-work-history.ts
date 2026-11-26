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
function duplicateGroups(rows: WorkHistoryRow[]): WorkHistoryRow[][] {
 const groups = new Map<string, WorkHistoryRow[]>();
 for (const r of rows) {
  if (!r.entryId || r.superseded) continue;
  const key = JSON.stringify([r.date.slice(0,10),r.minutes,r.activity ?? '']);
  groups.set(key,[...(groups.get(key) ?? []),r]);
 }
 return [...groups.values()].filter(g => g.length > 1);
}
export function duplicateHistoryIds(rows: WorkHistoryRow[]): Set<string> {
 return new Set(duplicateGroups(rows).flat().map(r => r.id));
}
/** Only later copies can be archived; the earliest saved matching entry stays as the original. */
export function duplicateRemovalIds(rows: WorkHistoryRow[]): Set<string> {
 return new Set(duplicateGroups(rows).flatMap(group => group
  .sort((a,b) => a.savedAt.localeCompare(b.savedAt) || a.id.localeCompare(b.id))
  .slice(1).map(r => r.id)));
}
