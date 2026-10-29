import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Send, ArrowLeft, ClipboardCheck, FileText, ListTodo, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmailComposer } from '@/components/EmailComposer';
import { TicketOwnerUpdatePanel } from '@/components/TicketOwnerUpdatePanel';
import { OpportunityEditor, useOwnerCollaboration } from '@/components/onboarding/OwnerCollaboration';
import { operationsOwnerContext } from '@/lib/ops-send-to-owner.functions';
import { ownerSendTypes, approvalPolicyLine, type OwnerSendType } from '@/lib/ops-send-to-owner';
import { evaluateAuthority } from '@/lib/work-orders';
import { useRole } from '@/hooks/useRole';

type Props = { propertyId: string; ticketId?: string; initialType?: OwnerSendType; approvalTrigger?: boolean; onWorkOrders?: (() => void) | undefined };
export function SendToOwner(props: Props) {
  const [open,setOpen]=useState(false);
  const role=useRole();
  if(!role.isStaff) return null;
  return <><Button variant="outline" disabled={role.readOnly} onClick={()=>setOpen(true)}><Send className="size-4"/>{props.approvalTrigger?'Review Owner Approval':'Send to owner'}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">{open?<SendToOwnerWindow {...props} onClose={()=>setOpen(false)}/>:null}</DialogContent></Dialog></>;
}
export function SendToOwnerWindow({propertyId,ticketId,initialType,onWorkOrders,onClose}: Props & {onClose:()=>void}) {
  const load=useServerFn(operationsOwnerContext),qc=useQueryClient();
  const [type,setType]=useState<OwnerSendType|null>(initialType??null);
  const q=useQuery({queryKey:['ops-owner-context',propertyId,ticketId],queryFn:()=>load({data:{propertyId,...(ticketId?{ticketId}:{})}})});
  const collab=useOwnerCollaboration(propertyId);
  const sent=()=>{void qc.invalidateQueries({queryKey:['sent-to-owner']});void qc.invalidateQueries({queryKey:['owner-collaboration']});void qc.invalidateQueries({queryKey:['ticket-work-orders']});onClose();};
  if(q.isPending)return <><DialogTitle>Send to owner</DialogTitle><p role="status">Loading homeowner...</p></>;
  if(q.error)return <><DialogTitle>Send to owner</DialogTitle><p role="alert">{q.error.message}</p></>;
  if(!q.data.recipient.eligible)return <><DialogHeader><DialogTitle>Send to owner</DialogTitle><DialogDescription>This homeowner doesn't have portal access yet.</DialogDescription></DialogHeader><EmailComposer context={ticketId?'ticket':'property'} recordId={ticketId??propertyId} label="Email Owner"/></>;
  const back=()=>setType(null);
  if(type==='owner_task'||type==='review')return <OpportunityEditor key={type} propertyId={propertyId} data={collab.data} editing="new" defaultTitle={type==='review'?'Please review: ':''} defaultResponseType="acknowledge" onClose={back} operations={{kind:type,ticketId:ticketId??null,ready:q.data.ready,onSent:sent}}/>;
  if(type==='ticket_update'&&ticketId)return <><DialogTitle>Send to owner</DialogTitle><TicketOwnerUpdatePanel ticketId={ticketId} wizard={{onBack:back,onSent:sent}}/></>;
  if(type==='approval'&&ticketId)return <ApprovalSend workOrders={q.data.workOrders} onBack={back} onSent={sent} onWorkOrders={()=>{onClose();onWorkOrders?.();}}/>;
  const icons={owner_task:ListTodo,ticket_update:FileText,approval:ShieldCheck,review:ClipboardCheck};
  return <><DialogHeader><DialogTitle>1. Send to owner</DialogTitle><DialogDescription>{q.data.recipient.name??'Homeowner'}</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2">{ownerSendTypes(ticketId).map(item=>{const Icon=icons[item.type];return <Button key={item.type} variant="outline" className="h-auto items-start justify-start whitespace-normal p-4 text-left" onClick={()=>setType(item.type)}><Icon className="mt-1 size-5 shrink-0"/><span><span className="block font-semibold">{item.label}</span><span className="block text-sm font-normal text-muted-foreground">{item.description}</span></span></Button>;})}</div></>;
}
function ApprovalSend({workOrders,onBack,onSent,onWorkOrders}:{workOrders:Awaited<ReturnType<typeof operationsOwnerContext>>['workOrders'];onBack:()=>void;onSent:()=>void;onWorkOrders:()=>void}) {
  const [selected,setSelected]=useState(''),[summary,setSummary]=useState(''),[preview,setPreview]=useState(false);
  const wo=workOrders.find(w=>w.id===selected);
  const verdict=wo?evaluateAuthority({...wo,phase:wo.phase==='mitigation'?'mitigation':'permanent'}):null;
  const mutation=useMutation({mutationFn:async()=>{
    if(!wo||!verdict?.ownerApprovalRequired||wo.approval_id)throw new Error('Open the Work Order to review its current approval.');
    const r=await supabase.rpc('prepare_work_order_owner_approval',{_work_order_id:wo.id,_expected_updated_at:wo.updated_at,_owner_summary:summary.trim()});
    if(r.error)throw r.error;
    // Preparation already publishes the reviewed summary atomically. Never publish twice.
    if(!r.data)throw new Error('The approval was not confirmed. Refresh the Work Order before trying again.');
  },onSuccess:onSent});
  if(!workOrders.length)return <><DialogTitle>Approval request</DialogTitle><p>Add a quote to a Work Order first, then send it for approval.</p><Button onClick={onWorkOrders}>Go to Work Orders</Button><Button variant="ghost" onClick={onBack}>Back</Button></>;
  return <><DialogTitle>{preview?'3. Preview':'2. Fill in'}: Approval request</DialogTitle>
    {preview&&wo?<section aria-label="Homeowner preview" className="space-y-3 whitespace-pre-wrap"><h3 className="text-xl font-semibold">{'Owner approval: property repair'}</h3><p>{summary}</p><p className="font-semibold">${Number(wo.quote_amount).toFixed(2)}</p><p>Approve or request changes</p></section>:<div className="space-y-3"><Label>Work Order</Label><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="Work Order"><SelectValue placeholder="Choose a quoted Work Order"/></SelectTrigger><SelectContent>{workOrders.map(w=><SelectItem key={w.id} value={w.id}>{w.title} · ${Number(w.quote_amount).toFixed(2)}</SelectItem>)}</SelectContent></Select>{wo?<p>{approvalPolicyLine(Number(wo.quote_amount))}</p>:null}{wo&&verdict&&!verdict.ownerApprovalRequired&&(wo.contractual_exception||wo.phase==='mitigation')?<p>{verdict.label}. Open the Work Order to follow its recorded exception.</p>:null}{wo?.approval_id?<p>There is already an approval for this Work Order. Open Work Orders to review it.</p>:null}<Label htmlFor="ops-approval-summary">Explanation for the owner</Label><Textarea id="ops-approval-summary" value={summary} onChange={e=>setSummary(e.target.value)} minLength={20} maxLength={4000}/></div>}
    {mutation.error?<p role="alert">{mutation.error.message}</p>:null}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={mutation.isPending} onClick={()=>preview?setPreview(false):onBack()}><ArrowLeft className="size-4"/>Back</Button>{preview?<Button disabled={mutation.isPending} onClick={()=>mutation.mutate()}>{mutation.isPending?'Sending...':'Send'}</Button>:<Button disabled={!wo||!verdict?.ownerApprovalRequired||Boolean(wo.approval_id)||summary.trim().length<20} onClick={()=>setPreview(true)}>Preview</Button>}<Button variant="ghost" onClick={onWorkOrders}>Go to Work Orders</Button></div>
  </>;
}