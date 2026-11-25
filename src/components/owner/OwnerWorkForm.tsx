import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MultiFileUpload } from '@/components/MultiFileUpload';
import { useOwnerCardUpload, useOpenOwnerFile } from '@/components/owner/CompletedCardPanel';
import { LinkedText } from '@/components/owner/LinkedText';
import { centralToday } from '@/lib/central-today';
import { activityCounter, OWNER_ACTIVITY_MAX, ownerSaveMessage } from '@/lib/owner-save-error';
import { readOwnerWorkHistory, saveOwnerCardWork } from '@/lib/owner-work-history.functions';
import type { WorkHistoryRow } from '@/lib/owner-work-history';
import type { OutputField } from '@/lib/ao-ui';
import { shortDate } from '@/lib/owner-opportunity-board';

export function OwnerWorkForm({programId, source='work', cardId=null, propertyId=null, title='Added work', fields=[], readOnly=false, initial=null, publicationId, approvalId, decisionChoices, reviewId=null, onSaved}: {
 programId:string; source?:string; cardId?:string|null; propertyId?:string|null; title?:string;
 fields?:OutputField[]; readOnly?:boolean; initial?:WorkHistoryRow|null; publicationId?:string; approvalId?:string;
 reviewId?:string|null; decisionChoices?: {value:string; label:string}[]; onSaved?:()=>void;
}) {
 const read = useServerFn(readOwnerWorkHistory);
 const q = useQuery({queryKey:['owner-work-history',programId],queryFn:()=>read({data:{programId}})});
 const rows=(q.data??[]).filter(r=>!r.superseded && cardId && (r.cardId===cardId || Boolean(reviewId && r.reviewId===reviewId)));
 const saved=initial??rows.find(r=>r.cardId===cardId)??rows[0]??null;
 const [mode,setMode]=useState<'view'|'edit'|'add'>(initial?'edit':'view');
 const [activity,setActivity]=useState(typeof initial?.values['activity']==='string'?initial.values['activity']:initial?.activity??'');
 const [hours,setHours]=useState(initial?String(Math.floor(initial.minutes/60)):'');
 const [minutes,setMinutes]=useState(initial?String(initial.minutes%60):'');
 const [day,setDay]=useState(initial?.date.slice(0,10)??centralToday());
 const [link,setLink]=useState(typeof initial?.values['link']==='string'?initial.values['link']:'');
 const [values,setValues]=useState<Record<string,string|number|boolean|null>>(initial?.values??{});
 const [files,setFiles]=useState(initial?.files??[]);
 const [busy,setBusy]=useState(false);
 const key=useRef(crypto.randomUUID());
 const upload=useOwnerCardUpload(propertyId);
 const call=useServerFn(saveOwnerCardWork); const qc=useQueryClient();
 const save=useMutation({mutationFn:()=>call({data:{saveKey:key.current,programId,source,cardId,propertyIds:propertyId?[propertyId]:[],
  activity,minutes:(Number(hours)||0)*60+(Number(minutes)||0),entryDate:day,
  values:{...values,activity,link},files,paths:[],phase:'ongoing',mode:mode==='add'?'add':'save',
  ...(mode==='edit'&&saved?.saveId?{editSaveId:saved.saveId}:{}),
  ...(mode==='edit'&&saved?.entryId?{editEntryId:saved.entryId}:{}),
  ...(typeof values['decision']==='string'?{decision:values['decision']}:{}),...(publicationId?{publicationId}:{}),...(approvalId?{approvalId}:{})}}),
  onSuccess:async()=>{key.current=crypto.randomUUID();setMode('view');setActivity('');setLink('');setHours('');setMinutes('');
   await Promise.all(['owner-work-history','owner-home','ao-owner-plan','ao-card-answer','owner-opportunities','owner-onboarding','owner-approvals'].map(k=>qc.invalidateQueries({queryKey:[k]})));
   toast.success('Saved'); onSaved?.();},onError:e=>toast.error(ownerSaveMessage(e))});
 const begin=(next:'edit'|'add')=>{setMode(next);key.current=crypto.randomUUID();setActivity(next==='edit'?(typeof saved?.values['activity']==='string'?saved.values['activity']:saved?.activity??''):'');setLink(next==='edit'&&typeof saved?.values['link']==='string'?saved.values['link']:'');
  setHours(next==='edit'?String(Math.floor((saved?.minutes??0)/60)):'');setMinutes(next==='edit'?String((saved?.minutes??0)%60):'');
  setValues(saved?.values??{});setFiles(next==='edit'?saved?.files??[]:[]);setDay(next==='edit'?saved?.date.slice(0,10)??centralToday():centralToday());};
 if(saved&&mode==='view') return <section className="space-y-3 pb-16" aria-label="Saved card">
  <p className="font-semibold text-success">Saved</p><p className="numeric">{(rows.length?rows.reduce((n,r)=>n+r.minutes,0):saved.minutes)/60} hrs · {shortDate(saved.date)}</p>
  <LinkedText text={saved.activity} className="whitespace-pre-wrap break-words" />
  {saved.files.map(f=><SavedWorkFile key={f.document_id} file={f}/>)}
  {!readOnly?<div className="flex flex-wrap justify-end gap-2"><Button variant="outline" className="min-h-11" onClick={()=>begin('edit')}>Edit</Button><Button variant="outline" className="min-h-11" onClick={()=>begin('add')}>Add more time</Button></div>:null}
 </section>;
 if(readOnly) return <p className="text-sm text-muted-foreground">No work saved yet.</p>;
 return <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(!save.isPending)save.mutate();}} aria-label={`Save work on ${title}`}>
  <div className="space-y-1"><Label htmlFor={`work-${cardId??'added'}`}>What did you do?</Label><Textarea id={`work-${cardId??'added'}`} value={activity} maxLength={OWNER_ACTIVITY_MAX} onChange={e=>setActivity(e.target.value)}/><p className="text-right text-xs text-muted-foreground" aria-live="polite">{activityCounter(activity)}</p></div>
  {fields.filter(f=>f.type==='yes_no').map(f=><div key={f.key}><Label htmlFor={`choice-${f.key}`}>{f.label}</Label><select id={`choice-${f.key}`} className="min-h-11 w-full rounded-md border bg-background px-3" value={String(values[f.key]??'')} onChange={e=>setValues({...values,[f.key]:e.target.value})}><option value="">Choose</option><option value="yes">Yes</option><option value="no">No</option></select></div>)}
  {decisionChoices?.length?<div><Label htmlFor="work-decision">Your choice</Label><select id="work-decision" className="min-h-11 w-full rounded-md border bg-background px-3" value={String(values['decision']??'')} onChange={e=>setValues({...values,decision:e.target.value})}><option value="">Choose</option>{decisionChoices.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>:null}
  <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="work-hours">Hours</Label><Input id="work-hours" type="number" value={hours} onChange={e=>setHours(e.target.value)}/></div><div><Label htmlFor="work-minutes">Minutes</Label><Input id="work-minutes" type="number" value={minutes} onChange={e=>setMinutes(e.target.value)}/></div></div>
  <div><Label htmlFor="work-date">Date</Label><Input id="work-date" type="date" value={day} onChange={e=>setDay(e.target.value)}/></div>
  <div><Label htmlFor="work-link">Link or file (optional)</Label><Input id="work-link" value={link} onChange={e=>setLink(e.target.value)}/></div>
  {files.map(f=><SavedWorkFile key={f.document_id} file={f}/>)}
  {propertyId?<MultiFileUpload label="Add file" autoStart upload={upload} onBusyChange={setBusy} onResults={r=>setFiles(v=>[...v,...r.filter(x=>!v.some(f=>f.document_id===x.document_id))])}/>:null}
  {save.isError?<p role="alert" className="text-sm text-destructive">{ownerSaveMessage(save.error)}</p>:null}
  <div className="flex justify-end gap-2"><Button type="submit" className="min-h-11" disabled={save.isPending||busy}>{save.isPending?'Saving...':'Save'}</Button>{mode!=='view'?<Button type="button" variant="ghost" className="min-h-11" onClick={()=>setMode('view')}>Cancel</Button>:null}</div>
 </form>;
}

export function SavedWorkFile({file}:{file:{document_id:string;name:string}}) {
 // Same signed document link used by completed cards and staff views.
 const [opening,setOpening]=useState(false); const openFile=useOpenOwnerFile();
 const open=async()=>{setOpening(true);try{await openFile(file);}catch(e){toast.error(ownerSaveMessage(e));}finally{setOpening(false);}};
 return <Button type="button" variant="link" className="min-h-11 max-w-full whitespace-normal break-words" disabled={opening} onClick={()=>void open()}>{file.name||'File'}</Button>;
}
