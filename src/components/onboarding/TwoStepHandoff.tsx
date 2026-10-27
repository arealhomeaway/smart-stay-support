import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { acceptIntoOperations, FUNCTIONAL_ROLES, logHandoffDeficiency, markReadyForOperations, readHandoffV2, roleLabel } from "@/lib/v2-workflow.functions";
import { handoffSummary, type HandoffRequirement } from "@/lib/onboarding-cleanup";
import { ONBOARDING_STAGES } from "@/lib/onboarding";

function stageName(stage:string) { return (ONBOARDING_STAGES.find(s=>s.value===stage)?.label??stage.replace(/_/g," ")).replace(/ — /g,": "); }
function date(value:string|null) { return value?new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString():"No date set"; }
export function TwoStepHandoff({propertyId,readOnly=false,onOpenTask}:{propertyId:string;readOnly?:boolean;onOpenTask?:(id:string)=>void}) {
  const qc=useQueryClient(), read=useServerFn(readHandoffV2), ready=useServerFn(markReadyForOperations), accept=useServerFn(acceptIntoOperations), deficiency=useServerFn(logHandoffDeficiency);
  const key=["handoff-v2",propertyId], q=useQuery({queryKey:key,queryFn:()=>read({data:{propertyId}})});
  const [showAll,setShowAll]=useState(false),[showProblem,setShowProblem]=useState(false),[title,setTitle]=useState(""),[detail,setDetail]=useState(""),[role,setRole]=useState("onboarding_project_manager");
  const done=()=>void qc.invalidateQueries();
  const error=(e:unknown)=>toast.error(e instanceof Error?e.message:"Could not save this step.");
  const mark=useMutation({mutationFn:(projectId:string)=>ready({data:{projectId}}),onSuccess:done,onError:error});
  const take=useMutation({mutationFn:(projectId:string)=>accept({data:{projectId}}),onSuccess:done,onError:error});
  const problem=useMutation({mutationFn:(projectId:string)=>deficiency({data:{projectId,title,detail,role}}),onSuccess:()=>{setShowProblem(false);setTitle("");setDetail("");done();},onError:error});
  if(q.isPending) return <p>Loading handoff…</p>;
  if(q.error||!q.data) return <p role="alert">Could not load handoff.</p>;
  const {project,requirements,canMarkReady,canAccept}=q.data;
  if(!project) return <p>No onboarding plan for this home.</p>;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Chicago",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const summary=handoffSummary(requirements,today), state=project.handoff_state;
  const row=(t:HandoffRequirement,chip?:string)=><li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-border py-3 text-sm">{chip?<span className={`rounded px-2 py-1 text-xs ${chip==="Overdue"?"bg-destructive/10 text-destructive":"bg-info/10 text-info"}`}>{chip}</span>:null}<span className="min-w-0 flex-1 font-medium">{t.title}</span><span className="text-muted-foreground">{roleLabel(t.assigned_seat)}</span><span className="text-muted-foreground">{date(t.due_on)}</span>{["complete","done"].includes(t.status)?<span className="text-state-done">Done</span>:null}<Button variant="ghost" size="sm" onClick={()=>onOpenTask?.(t.id)}>Open</Button></li>;
  return <section className="space-y-6">
    <ol className="grid gap-4 md:grid-cols-2"><li className="rounded-md border border-border p-4"><h2 className="font-semibold">1. Ready for Operations</h2><p className="mt-2 inline-block rounded bg-info/10 px-2 py-1 text-sm text-info">{state==="in_progress"?`In progress · ${summary.open.length} requirements left`:"Ready"}</p><p className="mt-3 text-sm text-muted-foreground">Director of Onboarding marks the home ready.</p>{project.ready_for_ops_at?<p className="text-sm">Ready on {date(project.ready_for_ops_at)}</p>:null}</li><li className="rounded-md border border-border p-4"><h2 className="font-semibold">2. Operations acceptance</h2><p className="mt-2 inline-block rounded bg-muted px-2 py-1 text-sm">{state==="accepted"?`Accepted on ${date(project.ops_accepted_at)}`:state==="in_progress"?"Starts after step 1":summary.open.length?`In progress · ${summary.open.length} requirements left`:"Ready"}</p><p className="mt-3 text-sm text-muted-foreground">Director of Operations accepts and the home goes live.</p>{state==="ready"?<div className="mt-3 flex gap-2"><Button disabled={readOnly||!canAccept||summary.open.length>0||take.isPending} onClick={()=>take.mutate(project.id)}>Accept</Button><Button variant="outline" disabled={readOnly||!canAccept} onClick={()=>setShowProblem(v=>!v)}>Log problem</Button></div>:null}</li></ol>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"><div className="space-y-4"><h2 className="font-semibold">Overdue or due next</h2><p className="text-sm">{summary.done} of {summary.total} handoff requirements done</p><Progress value={summary.total?summary.done/summary.total*100:100}/><ul>{summary.overdue.map(t=>row(t,"Overdue"))}{summary.next.map(t=>row(t,"Next"))}</ul>{!summary.overdue.length&&!summary.next.length?<p className="text-sm text-muted-foreground">No dated requirements due next.</p>:null}<Button variant="link" onClick={()=>setShowAll(v=>!v)} aria-expanded={showAll}>Show all {summary.total} by stage</Button>{showAll?summary.stages.map(s=><div key={s.stage}><h3 className="font-medium">{stageName(s.stage)} · {s.done} of {s.total}</h3><ul>{s.tasks.map(t=>row(t))}</ul></div>):null}<p className="text-sm text-muted-foreground">Other onboarding Tasks don't hold up handoff. They stay on the Tasks tab.</p></div>
    <aside className="space-y-4 border-l border-border pl-4"><h2 className="font-semibold">Readiness by stage</h2>{summary.stages.map(s=><div className="space-y-1" key={s.stage}><p className="text-sm">{stageName(s.stage)}</p><p className="text-xs text-muted-foreground">{s.done} of {s.total}</p><Progress value={s.done/s.total*100}/></div>)}{state==="in_progress"?<><Button className="w-full whitespace-normal" disabled={readOnly||!canMarkReady||summary.open.length>0||mark.isPending} onClick={()=>mark.mutate(project.id)}>Mark ready for Operations</Button>{summary.open.length?<p className="text-xs text-muted-foreground">Turns on when all {summary.total} requirements are done.</p>:null}{!canMarkReady?<p className="text-xs text-muted-foreground">Only the Director of Onboarding or an Admin can mark ready.</p>:null}</>:null}</aside></div>
    {showProblem?<div className="space-y-3 border-t border-border pt-4"><Label htmlFor="handoff-problem">What needs fixing</Label><Input id="handoff-problem" value={title} onChange={e=>setTitle(e.target.value)}/><Label htmlFor="handoff-detail">Details</Label><Textarea id="handoff-detail" value={detail} onChange={e=>setDetail(e.target.value)}/><Label>Assign to role</Label><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{FUNCTIONAL_ROLES.filter(r=>r.code!=="owner").map(r=><SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}</SelectContent></Select><Button disabled={title.trim().length<3||problem.isPending} onClick={()=>problem.mutate(project.id)}>Create Task</Button></div>:null}
  </section>;
}
