import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createPropertyManuallyFn, importOwnerRezPropertyFn, ownerRezOwnerPreviewFn, searchOwnerRezPropertiesFn } from "@/lib/property-intake.functions";
import { startOnboardingProjectFn } from "@/lib/onboarding.functions";
import { listOnboardingTemplatesFn } from "@/lib/onboarding-template-admin.functions";
import { activeOwnerEnrollmentContext, enrollActiveOwner } from "@/lib/owner-welcome.functions";
import { suggestedModules } from "@/lib/onboarding-scope";
import { runPropertySetup, type IntakeReceipt } from "@/lib/onboarding-cleanup";
import { useRole } from "@/hooks/useRole";
import type { OwnerRezCandidate } from "@/lib/property-intake";

export function AddPropertyDialog({ trigger, disabled, onCreated }: { trigger?: React.ReactNode; disabled?: boolean; onCreated?: (id: string) => void }) {
  const [open,setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild>{trigger ?? <Button disabled={disabled}>Add property</Button>}</DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add property</DialogTitle><DialogDescription>Choose the home and the setup you want to start.</DialogDescription></DialogHeader>
      {open ? <PropertySetupFields close={() => setOpen(false)} onCreated={onCreated} /> : null}
    </DialogContent></Dialog>;
}
function PropertySetupFields({close,onCreated}:{close:()=>void;onCreated?: ((id:string)=>void) | undefined}) {
  const { can, readOnly } = useRole();
  const mayEnroll = can("active_owner_enroll") && !readOnly;
  const qc = useQueryClient();
  const [method,setMethod] = useState<"ownerrez"|"manual">("ownerrez");
  const [query,setQuery] = useState("");
  const [selected,setSelected] = useState<OwnerRezCandidate|null>(null);
  const [form,setForm] = useState({name:"",addressLine1:"",city:"",state:"",postalCode:"",ownerName:"",ownerEmail:""});
  const [startPlan,setStartPlan] = useState(true);
  const [template,setTemplate] = useState("default");
  const [active,setActive] = useState(false);
  const [closing,setClosing] = useState("");
  const [notes,setNotes] = useState("");
  const [receipt,setReceipt] = useState<IntakeReceipt|null>(null);
  const [requestId] = useState(()=>crypto.randomUUID());
  const search = useServerFn(searchOwnerRezPropertiesFn), ownerPreview = useServerFn(ownerRezOwnerPreviewFn);
  const manual = useServerFn(createPropertyManuallyFn), importHome = useServerFn(importOwnerRezPropertyFn);
  const start = useServerFn(startOnboardingProjectFn), enroll = useServerFn(enrollActiveOwner), context = useServerFn(activeOwnerEnrollmentContext);
  const listTemplates = useServerFn(listOnboardingTemplatesFn);
  const templates = useQuery({queryKey:["onboarding-templates"],queryFn:()=>listTemplates()});
  const candidates = useQuery({queryKey:["ownerrez-candidates"],enabled:method==="ownerrez",queryFn:()=>search({data:{query:""}}),retry:false});
  const prefill = useQuery({queryKey:["ownerrez-owner",selected?.listingId],enabled:Boolean(selected),queryFn:()=>{if(!selected) throw new Error("Choose a listing."); return ownerPreview({data:{listingId:selected.listingId}});},retry:false});
  useEffect(()=>{const owner=prefill.data; if(owner) setForm(f=>({...f,ownerName:owner.name??"",ownerEmail:owner.email??""}));},[prefill.data]);
  const run = useMutation({mutationFn:()=>runPropertySetup({startPlan,activeOwner:active,mayEnroll},receipt,{
    intake:async()=>{
      const owner={name:form.ownerName||null,email:form.ownerEmail||null,phone:null};
      const milestones={plannedClosingOn:active?closing:null,actualClosingOn:null,accessOn:null};
      if(method==="ownerrez") { if(!selected) throw new Error("Choose an OwnerRez listing."); const r=await importHome({data:{listingId:selected.listingId,linkToPropertyId:selected.likely?.id??null,isDemo:false,milestones,owner}}); return {id:r.property.id,name:r.property.name}; }
      const r=await manual({data:{name:form.name,addressLine1:form.addressLine1,city:form.city,state:form.state,postalCode:form.postalCode,ownerName:owner.name,ownerEmail:owner.email,ownerRecordId:null,unit:null,market:null,ownerPhone:null,ownerRezPropertyId:null,isDemo:false,milestones}}); return {id:r.property.id,name:r.property.name};
    },
    plan:(propertyId)=>start({data:{propertyId,templateId:template==="default"?null:template,branch:null,projectManager:null,director:null,plannedClosingOn:active?closing:null,possessionOn:null,targetHandoffOn:null,furnishingScope:"full_furnishing",modules:suggestedModules({pool_spa:null,hoa:null}),poolLocation:"none",notes:null,externalRefs:{}}}),
    enroll:async(propertyId)=>{const c=await context({data:{propertyId,email:form.ownerEmail}}); return enroll({data:{requestId,propertyId,ownerRecordId:c.owner.id,name:form.ownerName,email:form.ownerEmail,closingDate:closing,notes,reason:"",onboardingLead:c.program?.onboarding_lead??null,operationsLead:c.program?.operations_lead??null}});}
  }),onSuccess:(r)=>{setReceipt(r); void qc.invalidateQueries(); if(r.propertyId) onCreated?.(r.propertyId);}});
  const field=(key:keyof typeof form,label:string,required=false,type="text")=><div className="space-y-1" key={key}><Label htmlFor={`add-${key}`}>{label}</Label><Input id={`add-${key}`} type={type} required={required} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/></div>;
  if(receipt) return <div className="space-y-4" role="status"><h3 className="font-semibold">{receipt.propertyName || "Property setup"}</h3><ol className="space-y-2">{receipt.steps.map(s=><li key={s.key}><strong>{{property:"Property",plan:"Onboarding plan",activeOwner:"Active Owner setup"}[s.key]}</strong> · {{done:"Done",failed:"Failed",not_reached:"Not reached",not_requested:"Not requested"}[s.status]}{s.detail?<p className="text-sm text-destructive">{s.detail}</p>:null}</li>)}</ol>
    {receipt.enrollment?<ol className="space-y-1 text-sm">{receipt.enrollment.steps.map(s=><li key={s.key}>{{account:"Homeowner login",enrollment:"Program and home linked",closing:"Closing date",activation:"Program active",onboarding:"Onboarding activities",operating:"Operating activities",welcome:receipt.enrollment?.welcomeHeld?"Welcome email held":"Welcome email queued"}[s.key]} · {s.status==="done"?"Done":s.status==="failed"?"Failed":"Not reached"}{s.detail?<p className="text-destructive">{s.detail}</p>:null}</li>)}</ol>:null}
    {receipt.steps.some(s=>s.status==="failed")?<Button disabled={run.isPending} onClick={()=>run.mutate()}>{run.isPending?"Retrying…":"Retry"}</Button>:null}
    {receipt.propertyId?<Button asChild variant="outline" onClick={close}><Link to="/onboarding/$propertyId" params={{propertyId:receipt.propertyId}}>Open property</Link></Button>:null}<Button variant="ghost" onClick={close}>Done</Button></div>;
  const items=candidates.data?.ok?candidates.data.items.filter(c=>[c.name,c.address,c.city].some(x=>x?.toLowerCase().includes(query.toLowerCase()))):[];
  const validHome=method==="ownerrez"?Boolean(selected):form.name.trim().length>=2&&form.addressLine1.trim().length>=3&&form.city.trim().length>=2&&form.state.trim().length>=2&&form.postalCode.trim().length>=3;
  const validOwner=!active||(form.ownerName.trim().length>=2&&/\S+@\S+\.\S+/.test(form.ownerEmail)&&Boolean(closing));
  const creates=[selected?.existing||selected?.likely?"existing property reused":"property",...(form.ownerName.trim()?["homeowner record created or reused"]:[]),...(startPlan?["onboarding plan"]:[]),...(active?["Active Owner program created or reused","homeowner login created or reused"]:[])];
  return <form className="space-y-6" onSubmit={e=>{e.preventDefault();run.mutate();}}>
    <section className="space-y-3"><h3 className="font-semibold">1. Where is this home coming from?</h3><div className="flex gap-2"><Button type="button" variant={method==="ownerrez"?"default":"outline"} onClick={()=>setMethod("ownerrez")}>Import from OwnerRez</Button><Button type="button" variant={method==="manual"?"default":"outline"} onClick={()=>setMethod("manual")}>Add manually</Button></div>
      {method==="ownerrez"?<><Input aria-label="Search OwnerRez listings" placeholder="Search listings" value={query} onChange={e=>setQuery(e.target.value)}/>{candidates.isPending?<p>Loading listings…</p>:candidates.data?.ok===false?<p role="alert" className="text-destructive">{candidates.data.error}</p>:candidates.error?<p role="alert">Could not load listings.</p>:<div className="max-h-44 overflow-y-auto divide-y divide-border border border-border rounded-md">{items.map(c=><Button key={c.listingId} type="button" variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>setSelected(c)}>{c.name}{selected?.listingId===c.listingId?" · Selected":""}{c.existing?" · Already in Resolve":c.likely?" · Existing home will be linked":""}</Button>)}</div>}</>:<div className="grid gap-3 sm:grid-cols-2">{field("name","Property name",true)}{field("addressLine1","Street address",true)}{field("city","City",true)}{field("state","State",true)}{field("postalCode","ZIP",true)}</div>}
      <div className="grid gap-3 sm:grid-cols-2">{field("ownerName","Homeowner name",active)}{field("ownerEmail","Homeowner email",active,"email")}</div>
    </section>
    <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">2. Start onboarding</h3><label className="flex items-center gap-2 text-sm"><Checkbox checked={startPlan} onCheckedChange={v=>setStartPlan(v===true)}/>Start the onboarding plan now</label><Label>Plan template</Label><Select disabled={!startPlan} value={template} onValueChange={setTemplate}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="default">{templates.data?.find(t=>t.isDefault)?.name??"Current default plan"}</SelectItem>{templates.data?.filter(t=>!t.isArchived&&!t.isDefault&&t.id).map(t=><SelectItem key={t.id} value={t.id??"default"}>{t.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Picked for you. Change it only if this home is different.</p>{templates.error?<p className="text-sm text-destructive">Could not load plan choices. The current default will be used.</p>:null}</section>
    <section className="space-y-3 border-t border-border pt-4"><h3 className="font-semibold">3. Enroll in Active Owner?</h3>{mayEnroll?<><div className="flex gap-2"><Button type="button" variant={!active?"default":"outline"} onClick={()=>setActive(false)}>No, standard home</Button><Button type="button" variant={active?"default":"outline"} onClick={()=>setActive(true)}>Yes, Active Owner</Button></div>{active?<><Label htmlFor="add-closing">Closing date</Label><Input id="add-closing" type="date" required value={closing} onChange={e=>setClosing(e.target.value)}/><p className="text-xs text-muted-foreground">Expected date is fine. Update it when it closes.</p><Label htmlFor="add-notes">Notes (optional)</Label><Textarea id="add-notes" maxLength={4000} value={notes} onChange={e=>setNotes(e.target.value)}/><p className="rounded-md bg-info/10 p-3 text-sm">The homeowner gets your welcome email with a set-password link, their activities are released, and they can log hours right away.</p></>:null}</>:<p className="text-sm text-muted-foreground">An Admin or the Onboarding Director can enroll later from the property page.</p>}</section>
    {run.error?<p role="alert" className="text-destructive">{run.error.message}</p>:null}<footer className="sticky bottom-0 space-y-3 border-t border-border bg-background pt-4"><p className="text-sm">Creates: {creates.join(", ")}</p><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit" disabled={readOnly||run.isPending||!validHome||!validOwner}>{run.isPending?"Adding property…":"Add property"}</Button></div></footer>
  </form>;
}
