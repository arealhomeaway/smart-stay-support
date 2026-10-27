import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { manageReleasedActivity, readReleasedConversation, readReleasedPropertyActivities } from "@/lib/onboarding-cleanup.functions";
import { toast } from "sonner";
import { linkifyText } from "@/lib/linkify";

export function ReleasedActivityDetail({activity,readOnly}:{activity:Awaited<ReturnType<typeof readReleasedPropertyActivities>>[number];readOnly:boolean}) {
  const qc=useQueryClient(),read=useServerFn(readReleasedConversation),manage=useServerFn(manageReleasedActivity);
  const q=useQuery({queryKey:["released-conversation",activity.id],queryFn:()=>read({data:{id:activity.id}})});
  const [reply,setReply]=useState(""),[editing,setEditing]=useState(false),[title,setTitle]=useState(activity.title),[what,setWhat]=useState(activity.recommendation??""),[why,setWhy]=useState(activity.impact??"");
  const action=useMutation({mutationFn:(kind:"reply"|"resolve"|"reopen"|"edit")=>manage({data:{id:activity.id,action:kind,body:reply,title,what,why,expectedUpdatedAt:activity.updated_at}}),onSuccess:()=>{setReply("");setEditing(false);void qc.invalidateQueries({queryKey:["released-property-activities"]});void qc.invalidateQueries({queryKey:["released-conversation"]});},onError:e=>toast.error(e.message)});
  const enabled=!readOnly&&q.data?.available===true,closed=activity.status==="closed";
  return <div className="space-y-4"><h2 className="text-xl font-semibold">{activity.title}</h2><p className="text-xs text-muted-foreground">Program activity · Sent {activity.notified_at?new Date(activity.notified_at).toLocaleDateString():"date not recorded"}</p>
    {editing?<div className="space-y-2"><Label>Title</Label><Input value={title} onChange={e=>setTitle(e.target.value)}/><Label>What they'll do</Label><Textarea value={what} onChange={e=>setWhat(e.target.value)}/><Label>Why it matters</Label><Textarea value={why} onChange={e=>setWhy(e.target.value)}/><Button disabled={action.isPending||title.trim().length<3} onClick={()=>action.mutate("edit")}>Save</Button><Button variant="ghost" onClick={()=>setEditing(false)}>Cancel</Button></div>:<><Button variant="outline" size="sm" disabled={!enabled} onClick={()=>setEditing(true)}>Edit</Button><h3 className="text-sm font-semibold">What they'll do</h3><div className="whitespace-pre-wrap text-sm">{linkifyText(activity.recommendation??activity.business_question??"No instructions recorded.")}</div>{activity.impact?<><h3 className="text-sm font-semibold">Why it matters</h3><p className="whitespace-pre-wrap text-sm">{activity.impact}</p></>:null}</>}
    {activity.evidence?<div className="whitespace-pre-wrap text-sm">{linkifyText(activity.evidence)}</div>:null}
    <section className="space-y-3" aria-label="Conversation with homeowner"><h3 className="text-sm font-semibold">Conversation with homeowner</h3>{activity.owner_response?<div className="rounded-md bg-muted p-3 text-sm"><p className="text-xs text-muted-foreground">Homeowner · {activity.responded_at?new Date(activity.responded_at).toLocaleString():"Date not recorded"}</p><p>{activity.owner_response}</p></div>:null}<ol className="space-y-2">{q.data?.messages.map(m=><li key={m.id} className="rounded-md bg-muted p-3 text-sm"><p className="text-xs text-muted-foreground">{m.author_name} · {new Date(m.created_at).toLocaleString()}</p><p>{m.body}</p></li>)}</ol>{q.data?.available===false?<p className="text-sm text-muted-foreground">Replies for program activities will be available after the approved update.</p>:null}{!closed?<><Textarea aria-label="Reply to the homeowner" disabled={!enabled} value={reply} onChange={e=>setReply(e.target.value)} maxLength={5000}/><Button disabled={!enabled||!reply.trim()||action.isPending} onClick={()=>action.mutate("reply")}>Send reply</Button><Button variant="outline" disabled={!enabled||action.isPending} onClick={()=>action.mutate("resolve")}>Resolve conversation</Button></>:<Button variant="outline" disabled={!enabled||action.isPending} onClick={()=>action.mutate("reopen")}>Reopen conversation</Button>}</section>
  </div>;
}