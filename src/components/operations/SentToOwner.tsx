import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { sentOperationsOwnerItems } from '@/lib/ops-send-to-owner.functions';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TicketOwnerUpdatePanel } from '@/components/TicketOwnerUpdatePanel';
import { OpportunityDetail, useOwnerCollaboration } from '@/components/onboarding/OwnerCollaboration';
import { OwnerParticipationOffer } from '@/components/OwnerParticipationOffer';
import { readReleasedPropertyActivities } from '@/lib/onboarding-cleanup.functions';
import { ReleasedActivityDetail } from '@/components/onboarding/ReleasedActivityDetail';
import { usDateTime } from '@/lib/dates';
import { useRole } from '@/hooks/useRole';

export function SentToOwner({propertyId,ticketId,onWorkOrders}:{propertyId:string;ticketId:string;onWorkOrders:()=>void}) {
  const {readOnly}=useRole();
  const load=useServerFn(sentOperationsOwnerItems);
  const q=useQuery({queryKey:['sent-to-owner',ticketId],queryFn:()=>load({data:{propertyId,ticketId}})});
  const collab=useOwnerCollaboration(propertyId);
  const readReleased=useServerFn(readReleasedPropertyActivities);
  const released=useQuery({queryKey:['released-property-activities',propertyId],queryFn:()=>readReleased({data:{propertyId}})});
  const [selected,setSelected]=useState<string|null>(null);
  const item=q.data?.find(r=>r.id===selected),opportunity=collab.data?.opportunities.find(o=>o.id===item?.targetId);
  const activity=released.data?.find(r=>r.id===item?.targetId);
  return <section className="space-y-2" aria-label="Sent to owner"><h3 className="text-sm font-semibold">Sent to owner</h3>{q.error?<p role="alert">{q.error.message}</p>:q.isPending?<p className="text-sm">Loading sent items...</p>:!q.data?.length?<p className="text-sm text-muted-foreground">Nothing sent for this Ticket yet.</p>:<ul className="divide-y divide-border">{q.data.map(r=><li key={r.id} className="py-2"><Button variant="ghost" className="h-auto w-full flex-wrap justify-start whitespace-normal text-left" onClick={()=>r.detail==='approval'?onWorkOrders():setSelected(r.id)}><span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">{r.type}</span>{r.title}<span className="block text-xs text-muted-foreground">{usDateTime(r.sentAt)}</span></span><span className="text-xs capitalize">{r.status}</span></Button></li>)}</ul>}
    <Dialog open={Boolean(selected)} onOpenChange={o=>!o&&setSelected(null)}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogTitle>{item?.title??'Sent to owner'}</DialogTitle>{item?.detail==='update'?<TicketOwnerUpdatePanel ticketId={ticketId}/>:item?.detail==='review'&&activity?<ReleasedActivityDetail activity={activity} readOnly={readOnly}/>:item?.detail==='review'?<OwnerParticipationOffer source="operations" sourceId={ticketId}/>:opportunity?<OpportunityDetail o={opportunity} files={collab.data?.files??[]} readOnly={readOnly}/>:<p>Loading details...</p>}</DialogContent></Dialog>
  </section>;
}