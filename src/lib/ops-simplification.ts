/** Operations go-live and one shared projection of live work. */
export const OPS_GO_LIVE = '2026-11-16T00:00:00-06:00';
export const HOME_NEEDS_LIMIT = 7;
export type OpsRecord = { ops_backlog_at?: string | null; ops_live_at?: string | null; ops_archived_at?: string | null; created_at?: string | null; reported_at?: string | null; external_source?: string | null; external_status?: string | null; status?: string; kind?: string | null };
const DONE = new Set(['closed','resolved','completed','cancelled']);
/** reported_at is the source creation time; created_at is the retained import time. */
export function recentAtNotionImport(r: OpsRecord): boolean {
 if(r.external_source !== 'notion' || !r.reported_at || !r.created_at)return false;
 const source=Date.parse(r.reported_at), imported=Date.parse(r.created_at);
 return Number.isFinite(source)&&Number.isFinite(imported)&&source<=imported&&imported-source<=30*86_400_000;
}
export function isQuietNotionImport(r: OpsRecord): boolean {
 return r.external_source==='notion'&&!r.ops_live_at&&r.external_status!=='reopened_in_resolve';
}
/** The one-time assignment excludes ALL Notion imports, even already started ones. */
export function cutoverAssignmentEligible(r: OpsRecord): boolean {
 return r.external_source!=='notion'&&!DONE.has(r.status??'open')&&!isOldBacklog(r);
}
export function isOldBacklog(r: OpsRecord): boolean {
  if (DONE.has(r.status??'open')) return false;
  if (r.ops_archived_at) return true;
  if (r.ops_live_at) return false;
  if (r.external_source === 'notion') return r.external_status!=='reopened_in_resolve'&&!recentAtNotionImport(r);
  if (r.ops_backlog_at) return true;
  return Boolean(r.created_at && Date.parse(r.created_at) < Date.parse(OPS_GO_LIVE));
}
export const TEAM_A_SUBJECTS = ['guest','bookings','arrival','reviews','other'] as const;
export type TeamASubject = typeof TEAM_A_SUBJECTS[number];
export const TEAM_A_LABELS: Record<TeamASubject,string> = { guest:'Guest issues',bookings:'Direct bookings',arrival:'Arrival checks',reviews:'Reviews and surveys',other:'Other' };
export const TEAM_A_TYPE_MAPPING: Record<TeamASubject,readonly string[]> = {
  guest:['Current or past guest request','Tone-check call'],
  bookings:['New booking request','Tenant lead tracker'],
  arrival:['Arrival check','Arrival information'],
  reviews:['Guest review, survey and rating logs'],
  other:['Adding homes to portals','OwnerRez booking blocks','Property or owner information update'],
};
export function teamASubject(name: string): TeamASubject {
  return TEAM_A_SUBJECTS.find(k=>TEAM_A_TYPE_MAPPING[k].includes(name)) ?? 'other';
}
export function defaultOpsTeam(coordinator: boolean, homeTeam: string | null): 'a'|'b'|'mine' {
  return coordinator && homeTeam==='guest_experience' ? 'a' : coordinator && homeTeam==='property_operations' ? 'b' : 'mine';
}
export type PersonalNeed = { id:string; personId:string; priority:number; at:string|null; bookingCreatedAt?:string|null; backlog?:boolean };
export function personalNeeds<T extends PersonalNeed>(rows:T[],personId:string,now=Date.now()):{rows:T[];total:number} {
 const seen=new Set<string>();
 const eligible=rows.filter(r=>{
  if(r.personId!==personId||r.backlog||seen.has(r.id))return false;
  if(r.bookingCreatedAt && now-Date.parse(r.bookingCreatedAt)>24*60*60*1000)return false;
  seen.add(r.id);return true;
 }).sort((a,b)=>a.priority-b.priority||(a.at??'9999').localeCompare(b.at??'9999')||a.id.localeCompare(b.id));
 return {rows:eligible.slice(0,HOME_NEEDS_LIMIT),total:eligible.length};
}
