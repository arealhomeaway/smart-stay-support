import { useState } from 'react';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { usDateTime } from '@/lib/dates';
import { useRole } from '@/hooks/useRole';
import { toast } from 'sonner';
type Item={entity_type:string;id:string;property_id:string|null;description:string;ticket_type:string;opened:string;last_update:string};
export function useOldBacklog(){return useQuery({queryKey:['ops-old-backlog'],queryFn:async()=>{const r=await supabase.rpc('ops_old_backlog' as never);if(r.error)throw r.error;return (r.data??[]) as unknown as Item[];}});}
export function OldBacklog(){
 const q=useOldBacklog();const qc=useQueryClient();const role=useRole();const [selected,setSelected]=useState<string[]>([]);const [intent,setIntent]=useState<{action:string;items:Item[]}|null>(null);const [reason,setReason]=useState('Done outside Resolve');const [saving,setSaving]=useState(false);
 const homes=useQuery({queryKey:['ops-backlog-homes'],queryFn:async()=>{const r=await supabase.from('properties').select('id,address_line1,name');if(r.error)throw r.error;return new Map((r.data??[]).map(x=>[x.id,x.address_line1??x.name]));}});
 const rows=q.data??[];const key=(r:Item)=>r.entity_type+':'+r.id;
 const choose=(action:string,items:Item[])=>{setReason(action==='close'?'Done outside Resolve':'');setIntent({action,items});};
 async function save(){if(!intent||role.readOnly)return;setSaving(true);try{const r=await supabase.rpc('ops_backlog_action' as never,{_items:intent.items.map(x=>({type:x.entity_type,id:x.id})),_action:intent.action,_reason:reason} as never);if(r.error)throw r.error;toast.success('Saved.');setIntent(null);setSelected([]);await qc.invalidateQueries();}catch(e){toast.error(e instanceof Error?e.message:'Could not save.');}finally{setSaving(false);}}
 const actions=(items:Item[])=><div className='flex flex-wrap gap-2'>{[['close','Close'],['live','Move to live work'],['archive','Archive']].map(([a,label])=><Button key={a} variant='outline' size='sm' className='min-h-11' disabled={!items.length||role.readOnly} onClick={()=>choose(a??'close',items)}>{label}</Button>)}</div>;
 return <section className='space-y-4'><h2 className='text-xl font-semibold'>Old backlog</h2><div className='flex flex-wrap items-center gap-3'><Checkbox checked={rows.length>0&&selected.length===rows.length} aria-label='Select all old backlog' onCheckedChange={v=>setSelected(v?rows.map(key):[])}/><span>{selected.length} selected</span>{actions(rows.filter(x=>selected.includes(key(x))))}</div>
 {q.isPending?<p>Loading old backlog...</p>:q.error?<p role='alert'>Old backlog could not be loaded.</p>:<div className='overflow-x-auto'><table className='w-full min-w-[900px] text-sm'><thead><tr className='border-b text-left'><th className='p-3'>Pick</th><th>Property</th><th>Description</th><th>Ticket type</th><th>Opened</th><th>Last update</th><th/></tr></thead><tbody>{rows.map(r=><tr key={key(r)} className='border-b'><td className='p-3'><Checkbox aria-label={`Select ${r.description}`} checked={selected.includes(key(r))} onCheckedChange={v=>setSelected(prev=>v?[...prev,key(r)]:prev.filter(x=>x!==key(r)))}/></td><td>{r.property_id?homes.data?.get(r.property_id)??'Property':''}</td><td className='max-w-sm p-3'>{r.description}</td><td>{r.ticket_type}</td><td className='whitespace-nowrap'>{usDateTime(r.opened)}</td><td className='whitespace-nowrap'>{usDateTime(r.last_update)}</td><td className='p-3'>{actions([r])}</td></tr>)}</tbody></table></div>}
 <Dialog open={Boolean(intent)} onOpenChange={v=>{if(!v&&!saving)setIntent(null);}}><DialogContent><DialogHeader><DialogTitle>{intent?.action==='live'?'Move to live work':intent?.action==='archive'?'Archive':'Close'} {intent?.items.length} items</DialogTitle></DialogHeader><Input aria-label='Reason' placeholder='Reason' value={reason} onChange={e=>setReason(e.target.value)}/><Button className='min-h-11' disabled={saving||reason.trim().length<3} onClick={()=>void save()}>{saving?'Saving...':'Save'}</Button></DialogContent></Dialog></section>;
}
