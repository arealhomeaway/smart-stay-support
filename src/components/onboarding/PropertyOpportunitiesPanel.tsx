import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GripVertical, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { compareArhaPriority, reorderArhaOpportunities } from "@/lib/v2-workflow.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ownerPrograms, ownerProgramDetail } from "@/lib/owner-program.functions";
import { OpportunityDetail, OpportunityEditor, useOwnerCollaboration, type CollabOpp } from "@/components/onboarding/OwnerCollaboration";
import { groupOwnerTab, waitingDays, type OwnerTabItem } from "@/lib/onboarding-cleanup";
import { LibraryVideoPlayer, useLibraryVideoIndex } from "@/components/owner/LibraryVideoPlayer";
import { imageFor } from "@/lib/opportunity-images";
import { useRole } from "@/hooks/useRole";
import { readReleasedPropertyActivities } from "@/lib/onboarding-cleanup.functions";
import { ReleasedActivityDetail } from "./ReleasedActivityDetail";

function when(value:string|null|undefined) { return value?new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"Date not recorded"; }
function SortableOpportunity({o,onOpen}:{o:CollabOpp;onOpen:()=>void}) {
  const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition}=useSortable({id:o.id});
  return <li ref={setNodeRef} style={{transform:CSS.Transform.toString(transform),transition}} className="flex items-center gap-2 border-b border-border py-2"><Button ref={setActivatorNodeRef} {...attributes} {...listeners} variant="ghost" size="icon" aria-label={`Reorder ${o.title}`} className="touch-none"><GripVertical className="size-4"/></Button><Button className="h-auto justify-start whitespace-normal text-left" variant="ghost" onClick={onOpen}>{o.title}</Button></li>;
}
export function PropertyOpportunitiesPanel({propertyId,openId}:{propertyId:string;openId?:string|null}) {
  const {readOnly}=useRole(), qc=useQueryClient();
  const loadPrograms=useServerFn(ownerPrograms),loadDetail=useServerFn(ownerProgramDetail),loadReleased=useServerFn(readReleasedPropertyActivities);
  const [editing,setEditing]=useState<CollabOpp|"new"|null>(null),[selected,setSelected]=useState<string|null>(openId??null),[completedOpen,setCompletedOpen]=useState(false),[draftsOpen,setDraftsOpen]=useState(false),[reorderMode,setReorderMode]=useState(false);
  const programs=useQuery({queryKey:["owner-programs","property",propertyId],queryFn:async()=>{const live=await loadPrograms({data:{}});if(live.rows.some(p=>p.properties.some(h=>h.id===propertyId)))return live;const demo=await loadPrograms({data:{demo:true}});return {...live,rows:[...live.rows,...demo.rows]};}});
  const program=programs.data?.rows.find(p=>p.properties.some(h=>h.id===propertyId));
  const detail=useQuery({queryKey:["owner-program-detail",program?.id],enabled:Boolean(program),queryFn:()=>{if(!program)throw new Error("No program.");return loadDetail({data:{programId:program.id}});}});
  const released=useQuery({queryKey:["released-property-activities",propertyId],queryFn:()=>loadReleased({data:{propertyId}})});
  const q=useOwnerCollaboration(propertyId), videos=useLibraryVideoIndex();
  useEffect(()=>{if(openId)setSelected(openId);},[openId]);
  const reorderFn=useServerFn(reorderArhaOpportunities);
  const [order,setOrder]=useState<string[]|null>(null);
  const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:4}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  const reorder=useMutation({mutationFn:(ids:string[])=>reorderFn({data:{propertyId,ids}}),onSuccess:()=>{setOrder(null);void qc.invalidateQueries({queryKey:["owner-collaboration"]});toast.success("Order saved.");},onError:e=>{setOrder(null);toast.error(e.message);}});
  if(programs.isPending||q.isPending||released.isPending)return <p>Loading Active Owner…</p>;
  if(programs.error||q.error||released.error)return <p role="alert">Could not load all Active Owner items. Please try again.</p>;
  if(!program)return null;
  const opps=q.data?.opportunities??[], messages=q.data?.messages??[];
  const requests:OwnerTabItem[]=opps.map(o=>{
    const thread=messages.filter(m=>m.work_item_id===o.id);
    const files=(q.data?.files??[]).filter(f=>f.workItemId===o.id);
    const ownerTimes=[...o.owner_response.map(r=>r.at),...thread.filter(m=>m.author_type==="homeowner").map(m=>m.created_at),...files.map(f=>f.uploadedAt)].filter((x):x is string=>Boolean(x)).sort();
    const staffTimes=thread.filter(m=>m.author_type==="staff").map(m=>m.created_at).sort();
    const latest=thread.filter(m=>m.author_type==="homeowner").slice(-1)[0];
    return {id:o.id,kind:"request",title:o.title,status:o.status,sentAt:o.sent_at,completedAt:o.completed_at,ownerAt:ownerTimes.at(-1)??null,staffAt:staffTimes.at(-1)??null,activity:latest?`${latest.author_name} replied`:files.length?"Homeowner uploaded a file":"Homeowner responded"};
  });
  const reviews:OwnerTabItem[]=(released.data??[]).map(r=>({id:r.id,kind:"review",title:r.title,status:r.status,sentAt:r.notified_at,completedAt:r.closed_at,ownerAt:r.responded_at,staffAt:r.last_staff_at,activity:r.owner_response?"Homeowner replied":"Homeowner responded"}));
  const groups=groupOwnerTab([...requests,...reviews]);
  const o=opps.find(o=>o.id===selected), review=released.data?.find(r=>r.id===selected);
  const current=o?requests.find(x=>x.id===o.id):reviews.find(x=>x.id===review?.id);
  const arhaSaved=opps.filter(o=>o.source==="arha"&&o.status!=="draft"&&o.status!=="complete").sort(compareArhaPriority);
  const arha=order?order.map(id=>arhaSaved.find(o=>o.id===id)).filter((o):o is CollabOpp=>Boolean(o)):arhaSaved;
  function drag(e:DragEndEvent){if(!e.over||e.active.id===e.over.id)return;const ids=arha.map(o=>o.id);const next=arrayMove(ids,ids.indexOf(String(e.active.id)),ids.indexOf(String(e.over.id)));setOrder(next);reorder.mutate(next);}
  const row=(item:OwnerTabItem,group:string)=>{const days=waitingDays(item.sentAt,Date.now());return <li key={`${item.kind}-${item.id}`} className={`flex flex-wrap items-center gap-3 border-b border-border py-3 ${group==="waiting"&&days!==null&&days>14?"bg-amber/10":""}`}><Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left" onClick={()=>setSelected(item.id)}>{item.title}</Button><span className="text-xs text-muted-foreground">{item.kind==="review"?"Program activity":"Opportunity"}</span><span className="text-xs text-muted-foreground">{group==="attention"?`${item.activity} · ${when(item.ownerAt)}`:group==="completed"?when(item.completedAt):group==="drafts"?"Not sent":`Sent ${when(item.sentAt)}${days===null?"":` · ${days} days`}`}</span><Button variant="outline" size="sm" onClick={()=>setSelected(item.id)}>{group==="attention"?"Reply":"Open"}</Button></li>;};
  const last=groups.completed.map(i=>i.completedAt).filter((x):x is string=>Boolean(x)).sort().at(-1);
  const hours=program.reportedHours,goal=detail.data?.program.target_hours??100,closing=program.properties.find(h=>h.id===propertyId)?.closingDate;
  const year=closing?.slice(0,4)??program.startedOn?.slice(0,4);
  return <section className="space-y-6">
    <div className="grid gap-4 border-b border-border pb-5 sm:grid-cols-[2fr_1fr_1fr]"><div className="space-y-2"><h2 className="font-semibold">{program.ownerName}</h2><p className="text-sm">{hours.toFixed(1)} of {goal} hours {year?`in ${year}`:"this year"}</p><Progress value={Math.min(100,hours/goal*100)}/><p className="text-xs text-muted-foreground">{when(closing)} to {year?`Dec 31, ${year}`:"End date not recorded"}</p></div><div className="rounded-md border border-amber/40 bg-amber/10 p-3"><p className="text-sm">Needs your reply</p><p className="text-2xl font-semibold">{groups.attention.length}</p></div><div className="rounded-md border border-border p-3"><p className="text-sm">Waiting on homeowner</p><p className="text-2xl font-semibold">{groups.waiting.length}</p></div></div>
    <div className={`grid items-start gap-6 ${selected?"lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]":""}`}><div className="min-w-0 space-y-6"><section><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Needs your attention</h2><Button disabled={readOnly} onClick={()=>setEditing("new")}><Plus className="size-4"/>Create Opportunity</Button></div>{groups.attention.length?<ul>{groups.attention.map(i=>row(i,"attention"))}</ul>:<p className="py-4 text-sm text-muted-foreground">Nothing needs a reply right now.</p>}</section>
      <section><div className="flex items-center justify-between"><h2 className="font-semibold">Waiting on homeowner</h2>{arha.length>1?<Button variant="ghost" disabled={readOnly} onClick={()=>setReorderMode(v=>!v)}>{reorderMode?"Done reordering":"Reorder"}</Button>:null}</div>{reorderMode?<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drag}><SortableContext items={arha.map(o=>o.id)} strategy={verticalListSortingStrategy}><ul>{arha.map(o=><SortableOpportunity key={o.id} o={o} onOpen={()=>setSelected(o.id)}/>)}</ul></SortableContext></DndContext>:null}<ul>{groups.waiting.map(i=>row(i,"waiting"))}</ul>{!groups.waiting.length?<p className="py-3 text-sm text-muted-foreground">Nothing waiting on the homeowner.</p>:null}</section>
      <section><Button variant="ghost" onClick={()=>setCompletedOpen(v=>!v)} aria-expanded={completedOpen}>Completed ({groups.completed.length}){last?` · Last on ${when(last)}`:""}</Button>{completedOpen?<ul>{groups.completed.map(i=>row(i,"completed"))}</ul>:null}</section><section><Button variant="link" onClick={()=>setDraftsOpen(v=>!v)} aria-expanded={draftsOpen}>Drafts ({groups.drafts.length})</Button>{draftsOpen?<ul>{groups.drafts.map(i=>row(i,"drafts"))}</ul>:null}</section></div>
      {selected?<aside className="min-w-0 space-y-4 border-t border-border pt-4 lg:sticky lg:top-4 lg:max-h-[85dvh] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:pl-5" aria-label="Active Owner details"><div className="flex items-start justify-between gap-2"><span className="rounded bg-muted px-2 py-1 text-xs">{current?.status==="complete"||current?.status==="closed"?"Completed":current?.status==="draft"?"Draft":current?.ownerAt?"Homeowner responded":"Waiting on homeowner"}</span><Button size="icon" variant="ghost" aria-label="Close details" onClick={()=>setSelected(null)}><X className="size-4"/></Button></div>{o?<><h2 className="text-xl font-semibold">{o.title}</h2><p className="text-xs text-muted-foreground">{o.source==="arha"?"Sent by ARHA":"Optional Library"} · {when(o.sent_at)}</p><Button size="sm" variant="outline" disabled={readOnly||o.source!=="arha"} onClick={()=>setEditing(o)}>Edit</Button>{o.owner_content?.what?<div><h3 className="text-sm font-semibold">What they'll do</h3><p className="whitespace-pre-wrap text-sm">{o.owner_content.what}</p></div>:null}{o.owner_content?.why?<div><h3 className="text-sm font-semibold">Why it matters</h3><p className="whitespace-pre-wrap text-sm">{o.owner_content.why}</p></div>:null}{o.library_template_id&&videos.has(o.library_template_id)?<LibraryVideoPlayer libraryId={o.library_template_id} poster={imageFor(null)} label={videos.get(o.library_template_id)?.label??o.title}/>:null}<OpportunityDetail o={o} files={q.data?.files??[]} readOnly={readOnly}/></>:review?<ReleasedActivityDetail activity={review} readOnly={readOnly}/>:<p>That item is not available for this home.</p>}</aside>:null}</div>
    <OpportunityEditor propertyId={propertyId} data={q.data} editing={editing} onClose={()=>setEditing(null)}/>
  </section>;
}
