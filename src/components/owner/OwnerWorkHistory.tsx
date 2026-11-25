import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OwnerWorkForm, SavedWorkFile } from '@/components/owner/OwnerWorkForm';
import { LinkedText } from '@/components/owner/LinkedText';
import { readOwnerWorkHistory } from '@/lib/owner-work-history.functions';
import { duplicateHistoryIds, historyTotals, type WorkHistoryRow } from '@/lib/owner-work-history';
import { shortDate } from '@/lib/owner-opportunity-board';
import { linkCount, linkCountLabel } from '@/lib/owner-links';
import { participationEvidenceUrlFn } from '@/lib/owner-evidence.functions';
import { toast } from 'sonner';
export function OwnerWorkHistory({programId,propertyId=null,userId=null,readOnly=true}:{programId:string;propertyId?:string|null;userId?:string|null;readOnly?:boolean}) {
 const read=useServerFn(readOwnerWorkHistory);
 const q=useQuery({queryKey:['owner-work-history',programId],queryFn:()=>read({data:{programId}})});
 const all=q.data??[];
 const rows=all;
 const totals=historyTotals(all); const duplicates=duplicateHistoryIds(all);
 const [editing,setEditing]=useState<WorkHistoryRow|null>(null); const [adding,setAdding]=useState(false);
 const [kept,setKept]=useState<Set<string>>(new Set());
 return <section className="space-y-4" aria-label="My history">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-2xl">My history</h2>{!readOnly?<Button className="min-h-11" onClick={()=>setAdding(true)}>Add work</Button>:null}</div>
  <div className="grid grid-cols-3 gap-3 border-y py-4">{[['Hours logged',totals.hours],['To pass 100',totals.to100],['To reach 120',totals.to120]].map(([label,n])=><div key={String(label)}><p className="text-sm text-muted-foreground">{label}</p><p className="numeric text-xl font-semibold">{Number(n).toFixed(1)}</p></div>)}</div>
  {q.isError?<p role="alert">Your history could not load. <Button variant="link" onClick={()=>void q.refetch()}>Try again</Button></p>:q.isPending?<p>Loading...</p>:!rows.length?<p>No work saved yet.</p>:null}
  <ul className="divide-y">{rows.map(r=><li key={r.id} className="space-y-2 py-4" data-history-row={r.id}>
   <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold break-words">{r.title}</p><p className="text-xs text-muted-foreground">{r.kind} · Saved {shortDate(r.savedAt)}{r.superseded?' · Original kept':''} · {r.files.length+r.paths.length} {r.files.length+r.paths.length===1?'file':'files'}{linkCount(r.activity)?` · ${linkCountLabel(linkCount(r.activity))}`:''}</p></div><p className="numeric shrink-0">{(r.minutes/60).toFixed(1)} hrs</p></div>
   <LinkedText text={r.activity} className="whitespace-pre-wrap break-words text-sm"/>
   {r.files.map(f=><SavedWorkFile key={f.document_id} file={f}/>)}{r.paths.map((_,i)=><HistoryEvidence key={i} entryId={r.entryId??r.id} index={i}/>)}
   {!readOnly&&r.actorId===userId&&!r.superseded?<Button variant="outline" className="min-h-11" onClick={()=>setEditing(r)}>Edit</Button>:null}
   {duplicates.has(r.id)&&!kept.has(r.id)?<div className="space-y-2 border-l-2 border-warning pl-3"><p className="text-sm">This looks like a duplicate. Keep both or remove one?</p>{!readOnly&&r.actorId===userId?<Button variant="outline" className="min-h-11" onClick={()=>setKept(new Set([...kept,r.id]))}>Keep both</Button>:null}</div>:null}
  </li>)}</ul>
  {(adding||editing)&&!readOnly?<Dialog open onOpenChange={v=>{if(!v){setAdding(false);setEditing(null);}}}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing?'Edit':'Add work'}</DialogTitle></DialogHeader><OwnerWorkForm programId={programId} propertyId={editing?.propertyIds[0]??propertyId} source={editing?.source??'work'} cardId={editing?.cardId??null} title={editing?.title??'Added work'} initial={editing} onSaved={()=>{setAdding(false);setEditing(null);}}/></DialogContent></Dialog>:null}
 </section>;
}
function HistoryEvidence({entryId,index}:{entryId:string;index:number}) {
 const get=useServerFn(participationEvidenceUrlFn);
 const open=async()=>{try{const r=await get({data:{entryId,index}});window.open(r.url,'_blank','noopener,noreferrer');}catch{toast.error('This file could not open. Please try again.');}};
 return <Button variant="link" className="min-h-11" onClick={()=>void open()}>File {index+1}</Button>;
}
