import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { sentOwnerStatus } from './ops-send-to-owner';

export const operationsOwnerContext = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ propertyId: z.string().uuid(), ticketId: z.string().uuid().optional() }).parse(value))
  .handler(async ({ context, data }) => {
    const { resolveOperationsOwnerRecipient } = await import('./ops-owner-recipient.server');
    const recipient = await resolveOperationsOwnerRecipient(context.supabase, context.userId, data.propertyId);
    let ready = false;
    if (recipient.eligible) {
      const probe = await context.supabase.rpc('ops_send_owner_ready' as never);
      if (probe.error && !['PGRST202','42883'].includes(probe.error.code)) throw probe.error;
      ready = probe.data === true;
    }
    if (data.ticketId) {
      const ticket = await context.supabase.from('tickets').select('property_id').eq('id', data.ticketId).single();
      if (ticket.error) throw ticket.error;
      if (ticket.data.property_id !== data.propertyId) throw new Error('This Ticket belongs to a different home.');
    }
    const orders = data.ticketId ? await context.supabase.from('work_orders').select('*').eq('ticket_id', data.ticketId).eq('property_id', data.propertyId).is('closed_at', null).not('quote_amount','is',null).order('created_at') : { data: [], error: null };
    if (orders.error) throw orders.error;
    return { recipient, ready, workOrders: orders.data ?? [] };
  });

export const sentOperationsOwnerItems = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.object({ propertyId: z.string().uuid(), ticketId: z.string().uuid() }).parse(value))
  .handler(async ({ context, data }) => {
    const { resolveOperationsOwnerRecipient } = await import('./ops-owner-recipient.server');
    await resolveOperationsOwnerRecipient(context.supabase, context.userId, data.propertyId);
    const db = context.supabase;
    const ticket = await db.from('tickets').select('property_id').eq('id',data.ticketId).single();
    if (ticket.error) throw ticket.error;
    if (ticket.data.property_id !== data.propertyId) throw new Error('This Ticket belongs to a different home.');
    const [mirror, updates, reviews, orders] = await Promise.all([
      db.from('work_items').select('id').eq('source_table','tickets').eq('source_id',data.ticketId).eq('kind','task').maybeSingle(),
      db.from('ticket_owner_updates').select('*').eq('ticket_id',data.ticketId).order('revision',{ascending:false}),
      db.from('owner_reviews').select('id,title,status,responded_at,notified_at,created_at,owner_decision').eq('ticket_id',data.ticketId).is('archived_at',null),
      db.from('work_orders').select('id,approval_id').eq('ticket_id',data.ticketId),
    ]);
    for (const r of [mirror,updates,reviews,orders]) if(r.error) throw r.error;
    const ids = (orders.data ?? []).flatMap(o => o.approval_id ? [o.approval_id] : []);
    const [opportunities, approvals] = await Promise.all([
      mirror.data ? db.from('work_items').select('id,title,status,sent_at,responded_at,owner_content,owner_response').eq('linked_task_id',mirror.data.id).eq('kind','opportunity').not('sent_at','is',null).is('retired_at',null) : Promise.resolve({data:[],error:null}),
      ids.length ? db.from('approvals').select('id,title,status,created_at,decided_at,entity_id').in('id',ids).eq('approver_role','owner') : Promise.resolve({data:[],error:null}),
    ]);
    if(opportunities.error) throw opportunities.error;
    if(approvals.error) throw approvals.error;
    const rows = [
      ...(updates.data ?? []).map(u=>({id:u.id,type:'Ticket update',title:'Ticket update',sentAt:u.reviewed_at,status:sentOwnerStatus({status:'open',responded:(reviews.data??[]).some(r=>Boolean(r.responded_at)&&r.responded_at>=u.reviewed_at)}),detail:'update' as const,targetId:u.id})),
      ...(reviews.data ?? []).map(r=>({id:r.id,type:'For review',title:r.title,sentAt:r.notified_at??r.created_at,status:sentOwnerStatus({status:r.status,responded:Boolean(r.responded_at),reviewed:r.owner_decision==='acknowledged'}),detail:'review' as const,targetId:r.id})),
      ...(opportunities.data??[]).map(o=>{const c=o.owner_content as Record<string,unknown>|null;const review=c?.['send_kind']==='review';return {id:o.id,type:review?'For review':'Owner task',title:o.title,sentAt:o.sent_at,status:sentOwnerStatus({status:o.status,responded:Boolean(o.responded_at),reviewed:review&&Boolean(o.responded_at||o.status==='complete')}),detail:'opportunity' as const,targetId:o.id};}),
      ...(approvals.data??[]).map(a=>({id:a.id,type:'Approval request',title:a.title,sentAt:a.created_at,status:sentOwnerStatus({status:a.status}),detail:'approval' as const,targetId:a.entity_id})),
    ];
    return rows.sort((a,b)=>(b.sentAt??'').localeCompare(a.sentAt??''));
  });