import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { Link,useSearch,useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDemo } from '@/components/DemoProvider';
import { useRole } from '@/hooks/useRole';
import { useHomeTeams } from '@/hooks/useHomeTeam';
import { useStaffDirectory,displayName } from '@/hooks/useTeam';
import { useWorkspaceOrigin } from '@/components/nav/NavContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QueueOpenLogger } from '@/components/scorecard/QueueOpenLogger';
import { TicketTable,TwoLine,type TicketTableColumn } from '@/components/queue/TicketTable';
import { TicketDueLabel } from '@/components/tickets/TicketDueLabel';
import { RoutineDrawer,type RoutineRow } from '@/components/routines/RoutineDrawer';
import { DepartureReviewSheet } from '@/components/departure/DepartureReviewQueue';
import { formatPropertyLabel } from '@/lib/property-label';
import { currentOwnerId } from '@/lib/matters';
import { defaultOpsTeam,isOldBacklog,TEAM_A_SUBJECTS,TEAM_A_LABELS,teamASubject } from '@/lib/ops-simplification';
import { TEAM_B_TABS,TEAM_B_TAB_LABELS,TEAM_B_DUE,TEAM_B_DUE_LABELS,inDueFilter,teamBTab,isLawnReview,hiddenOnboarding,rollUpReported,type TeamBDue } from '@/lib/team-b-view';
import { usDate } from '@/lib/dates';

type QueueRow = { id:string; kind:'ticket'|'routine'|'departure'|'booking'; title:string; property:string; property_id:string|null; team:'a'|'b'; subject:string; typeName:string; status:string; priority:string; due_on:string|null; due_locked?:boolean; owner:string|null; created_at:string|null; routine?:RoutineRow; rollup?:QueueRow[] };
type Raw=Record<string,any>;
export function OperationsQueue({embedded=false}:{embedded?:boolean}) {
 const role=useRole();const {demoMode,demoReady}=useDemo();const {homeTeamOf}=useHomeTeams();const {data:staff}=useStaffDirectory();const navigate=useNavigate();const params=useSearch({strict:false}) as Record<string,string|undefined>;const qc=useQueryClient();const origin=useWorkspaceOrigin('Team Queue');
 const own=defaultOpsTeam(role.roles.includes('tech'),homeTeamOf(role.userId ?? null));
 const active=['a','b','mine'].includes(params['opsTeam']??'')?params['opsTeam'] as 'a'|'b'|'mine':params['homeTeam']==='property_operations'?'b':params['homeTeam']==='guest_experience'?'a':own;
 const subject=params['subject']??(active==='b'?'maintenance':'guest');const due=(TEAM_B_DUE as readonly string[]).includes(params['bDue']??'')?params['bDue'] as TeamBDue:'today';
 const [q,setQ]=useState('');const [routine,setRoutine]=useState<RoutineRow|null>(null);const [departure,setDeparture]=useState<string|null>(null);
 const set=(patch:Record<string,string|undefined>)=>void navigate({to:'.',search:((prev:Record<string,string|undefined>)=>({...prev,...patch})) as never});
 const data=useQuery({queryKey:['ops-live-queue',demoMode,role.userId],enabled:demoReady&&!role.isLoading,refetchInterval:60000,queryFn:async()=>{
  const [tickets,routines,departures,bookings]=await Promise.all([
   supabase.from('tickets').select('*,work_types(name),properties(id,name,nickname,address_line1,unit,city,state,postal_code,ownerrez_property_id,lifecycle_status),handoff_carryovers(ticket_id)').eq('is_demo',demoMode).is('archived_at',null).limit(5000),
   supabase.from('routine_controls').select('*,properties(name,nickname,address_line1,unit,city,state,postal_code,ownerrez_property_id)').eq('is_demo',demoMode).eq('kind','maintenance_review').limit(1000),
   supabase.from('departure_reviews').select('*,properties(name,nickname,address_line1,unit,city,state,postal_code,ownerrez_property_id)').eq('is_demo',demoMode).limit(1000),
   supabase.from('leads').select('*').eq('is_demo',demoMode).eq('kind','direct_booking').limit(1000),
  ]);for(const r of [tickets,routines,departures,bookings])if(r.error)throw r.error;
  const rows:QueueRow[]=[];const property=(r:Raw)=>r['properties']?formatPropertyLabel(r['properties']).primary:'No property';
  for(const r of (tickets.data??[]) as Raw[]){if(isOldBacklog(r)||hiddenOnboarding(r as never))continue;const name=r['work_types']?.name??'Other';const team=name==='Arrival check'||String(r['functional_role_code']??'').startsWith('ge_')?'a':'b';rows.push({id:r['id'],kind:'ticket',title:r['title'],property:property(r),property_id:r['property_id'],team,subject:team==='a'?teamASubject(name):teamBTab(r as never),typeName:name,status:r['status'],priority:r['priority'],due_on:r['due_on'],due_locked:r['due_locked'],owner:currentOwnerId(r as never),created_at:r['created_at']});}
  for(const r of (routines.data??[]) as Raw[]){if(isOldBacklog(r)||r['status']==='cancelled')continue;rows.push({id:r['id'],kind:'routine',title:r['title']??'Maintenance review',property:property(r),property_id:r['property_id'],team:'b',subject:isLawnReview(r['title'])?'lawn':'maintenance',typeName:isLawnReview(r['title'])?'Lawn care review':'Maintenance review',status:r['status']==='completed'?'closed':'open',priority:'p3',due_on:r['due_at']?new Date(r['due_at']).toLocaleDateString('en-CA',{timeZone:'America/Chicago'}):null,owner:r['assigned_to'],created_at:r['created_at'],routine:r as RoutineRow});}
  for(const r of (departures.data??[]) as Raw[]){if(r['status']==='cancelled')continue;rows.push({id:r['id'],kind:'departure',title:r['clean_name']?`Cleaning review: ${r['clean_name']}`:'Cleaning review',property:property(r),property_id:r['property_id'],team:'b',subject:'cleaning',typeName:'Cleaning review',status:r['status']==='completed'?'closed':'open',priority:'p3',due_on:(r['clean_completed_at']??r['stay_departure'])?.slice(0,10)??null,owner:r['assigned_to']??null,created_at:r['created_at']});}
  for(const r of (bookings.data??[]) as Raw[]){if(isOldBacklog(r))continue;rows.push({id:r['id'],kind:'booking',title:r['subject']??r['partner_name']??'Direct booking request',property:'',property_id:null,team:'a',subject:'bookings',typeName:'Direct booking',status:r['outcome']?'closed':'open',priority:'p1',due_on:(r['follow_up_due_at']??r['ops_live_at']??r['created_at'])?.slice(0,10)??null,owner:r['owned_by']??r['assigned_to'],created_at:r['created_at']});}
  return rows;
 }});
 const all=data.data??[];const scoped=all.filter(r=>active==='mine'?r.owner===role.userId:r.team===active);const filtered=scoped.filter(r=>!q||`${r.title} ${r.property} ${r.typeName}`.toLowerCase().includes(q.toLowerCase()));const now=new Date();
 const subjects=active==='b'?TEAM_B_TABS:active==='a'?TEAM_A_SUBJECTS:[];
 const counts=(s:string)=>filtered.filter(r=>(active==='mine'||r.subject===s)&&inDueFilter(r as never,due,now)).length;
 const rows0=filtered.filter(r=>(active==='mine'||r.subject===subject)&&inDueFilter(r as never,due,now));
 const rows=(active==='b'&&subject==='reported'?rollUpReported(rows0 as never) as QueueRow[]:rows0).sort((a,b)=>(a.due_on??'9999').localeCompare(b.due_on??'9999')||a.priority.localeCompare(b.priority)||(a.created_at??'').localeCompare(b.created_at??''));
 async function take(r:QueueRow){if(!role.userId||role.readOnly)return;let res;
  if(r.kind==='ticket')res=await supabase.from('tickets').update({assigned_to:role.userId,current_action_owner:role.userId}).eq('id',r.id);
  else if(r.kind==='routine')res=await supabase.from('routine_controls').update({assigned_to:role.userId}).eq('id',r.id);
  else if(r.kind==='booking')res=await supabase.rpc('start_direct_booking',{_lead_id:r.id});
  else {toast.error('Open the review to take it.');return;}
  if(res.error){toast.error(res.error.message);return;}toast.success('You have it.');void qc.invalidateQueries({queryKey:['ops-live-queue']});
 }
 const columns:TicketTableColumn<QueueRow>[]=[
  {key:'priority',header:'Priority',track:'70px',cell:r=><Badge variant='outline'>{r.priority.toUpperCase()}</Badge>},
  {key:'title',header:'Description',track:'minmax(230px,2fr)',cell:r=><TwoLine top={r.title} sub={r.typeName}/>},
  {key:'property',header:'Property',track:'minmax(190px,1.5fr)',cell:r=>r.property},
  {key:'owner',header:'Owner',track:'150px',cell:r=>r.owner?displayName(staff?.find(s=>s.id===r.owner)):'Unassigned'},
  {key:'status',header:'Status',track:'100px',cell:r=>r.status==='closed'||r.status==='resolved'?'Closed':r.status==='waiting'?'Waiting':'Open'},
  {key:'due',header:'Due date',track:'140px',cell:r=><TicketDueLabel dueOn={r.due_on} locked={r.due_locked}/>},
  {key:'take',header:'',track:'85px',cell:r=>role.readOnly||r.owner===role.userId?null:<Button variant='outline' size='sm' className='min-h-11' onClick={e=>{e.preventDefault();e.stopPropagation();void take(r);}}>Take it</Button>},
 ];
 return <div className='space-y-4' data-testid='ops-simple-queue'>
  <QueueOpenLogger source='team_queue'/>{!embedded&&<h1 className='text-2xl font-semibold'>Team Queue</h1>}
  <div className='flex flex-wrap items-center justify-between gap-3'><nav aria-label='Team' className='flex gap-2'>{(['a','b','mine'] as const).map(t=><Button key={t} variant={active===t?'default':'outline'} className='min-h-11' aria-pressed={active===t} onClick={()=>set({opsTeam:t,subject:undefined,homeTeam:undefined})}>{t==='mine'?'Mine':`Team ${t.toUpperCase()}`}</Button>)}</nav><Input aria-label='Search work' placeholder='Search work' value={q} onChange={e=>setQ(e.target.value)} className='max-w-sm'/></div>
  {subjects.length>0&&<nav aria-label='Work type' className='flex flex-wrap gap-2'>{subjects.map(s=><Button key={s} variant={subject===s?'default':'outline'} className='min-h-11' aria-pressed={subject===s} onClick={()=>set({subject:s})}>{active==='b'?TEAM_B_TAB_LABELS[s as keyof typeof TEAM_B_TAB_LABELS]:TEAM_A_LABELS[s as keyof typeof TEAM_A_LABELS]} <span className='ml-2 tabular-nums'>{counts(s)}</span></Button>)}</nav>}
  <div className='flex flex-wrap gap-2'>{TEAM_B_DUE.map(f=><Button key={f} variant={due===f?'default':'outline'} className='min-h-11' aria-pressed={due===f} onClick={()=>set({bDue:f})}>{TEAM_B_DUE_LABELS[f]} <span className='ml-2 tabular-nums'>{filtered.filter(r=>(active==='mine'||r.subject===subject)&&inDueFilter(r as never,f,now)).length}</span></Button>)}</div>
  {data.isPending?<p>Loading work...</p>:data.error?<p role='alert'>Work could not be loaded. Try again.</p>:<TicketTable columns={columns} groups={[{key:'work',label:'Work',header:null,rows,empty:<span>No work here.</span>}]} rowKey={r=>`${r.kind}:${r.id}`} label='Work' testId='ops-work-table' minWidth={950} renderRow={(r,props,children)=>r.kind==='ticket'?<Link to='/tickets/$ticketId' params={{ticketId:r.id}} search={{...origin.originSearch,...(r.rollup?{issues:r.rollup.map(i=>i.id).join(',')}:{})}} {...props}>{children}</Link>:r.kind==='booking'?<Link to='/direct-bookings/$requestId' params={{requestId:r.id}} {...props}>{children}</Link>:<div role='button' tabIndex={0} onClick={()=>r.kind==='routine'?setRoutine(r.routine??null):setDeparture(r.id)} onKeyDown={e=>{if(e.key==='Enter'){r.kind==='routine'?setRoutine(r.routine??null):setDeparture(r.id);}}} {...props}>{children}</div>}/>} 
  <RoutineDrawer row={routine} open={Boolean(routine)} onOpenChange={v=>{if(!v)setRoutine(null);}}/><DepartureReviewSheet reviewId={departure} onClose={()=>setDeparture(null)}/>
 </div>;
}
