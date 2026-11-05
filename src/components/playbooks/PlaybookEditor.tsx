import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/tickets";
import { playbookContentSchema, reorderPlaybookSteps, type PlaybookContent } from "@/lib/playbook-editing";

const lines = (text: string) => text.split("\n").map((s) => s.trim()).filter(Boolean);
export function PlaybookEditor({ initial, busy, onSave, onCancel }: {
  initial: PlaybookContent; busy: boolean; onSave: (content: PlaybookContent) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const set = <K extends keyof PlaybookContent>(key: K, value: PlaybookContent[K]) => setForm((f) => ({ ...f, [key]: value }));
  return <form className="space-y-5" onSubmit={(e) => {
    e.preventDefault();
    const parsed = playbookContentSchema.safeParse(form);
    if (!parsed.success) { setError("Add a title, category, applies to and an instruction for each step."); return; }
    setError(""); onSave(parsed.data);
  }}>
    <div className="space-y-2"><Label htmlFor="edit-pb-title">Title</Label><Input id="edit-pb-title" required value={form.title} onChange={(e) => set("title", e.target.value)} /></div>
    <div className="space-y-2"><Label htmlFor="edit-pb-description">Description</Label><Textarea id="edit-pb-description" value={form.summary ?? ""} onChange={(e) => set("summary", e.target.value)} /></div>
    <div className="space-y-2"><Label>Category</Label><Select value={form.category} onValueChange={(v) => set("category", v)}><SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger><SelectContent>
      {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
      {!CATEGORIES.some((c) => c.value === form.category) && <SelectItem value={form.category}>{form.category}</SelectItem>}
    </SelectContent></Select></div>
    <fieldset className="space-y-2"><legend className="text-sm font-medium">Applies to</legend><div className="flex flex-wrap gap-4">
      {([['ticket', 'Ticket'], ['work_order', 'Work Order'], ['recovery', 'Refund or credit'], ['claim', 'Claim']] as const).map(([v, label]) => <label key={v} className="flex items-center gap-2 text-sm"><Checkbox checked={form.applies_to.includes(v)} onCheckedChange={(checked) => set("applies_to", checked ? [...form.applies_to, v] : form.applies_to.filter((s) => s !== v))} />{label}</label>)}
    </div></fieldset>
    <div className="space-y-2"><Label htmlFor="edit-pb-keywords">Matching keywords</Label><Textarea id="edit-pb-keywords" value={form.keywords.join("\n")} onChange={(e) => set("keywords", lines(e.target.value))} /></div>
    <section className="space-y-3"><h3 className="text-sm font-medium">Consider</h3>
      {form.risk_flags.map((risk, index) => <div className="flex items-start gap-2" key={index}><div className="min-w-0 flex-1 space-y-2"><Input aria-label={`Consider ${index + 1}`} value={risk.title} onChange={(e) => set("risk_flags", form.risk_flags.map((r, i) => i === index ? { ...r, title: e.target.value } : r))} /><Input aria-label={`Why ${index + 1}`} placeholder="Why, if helpful" value={risk.why ?? ""} onChange={(e) => set("risk_flags", form.risk_flags.map((r, i) => i === index ? { ...r, why: e.target.value } : r))} /></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove consideration ${index + 1}`} title="Remove consideration" onClick={() => set("risk_flags", form.risk_flags.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button></div>)}
      <Button type="button" variant="outline" size="sm" onClick={() => set("risk_flags", [...form.risk_flags, { title: "", why: null }])}><Plus className="size-4" />Add consideration</Button>
    </section>
    {([['immediate_actions', 'Do first'], ['escalate_if', 'Escalate if'], ['required_evidence', 'Required evidence']] as const).map(([key, label]) => <div key={key} className="space-y-2"><Label htmlFor={`edit-pb-${key}`}>{label}</Label><Textarea id={`edit-pb-${key}`} value={form[key].join("\n")} onChange={(e) => set(key, lines(e.target.value))} /></div>)}
    <section className="space-y-3"><h3 className="font-medium">Ordered steps</h3>
      {form.steps.map((step, index) => <div key={index} className="space-y-2 border-b border-border pb-4">
        <div className="flex items-center gap-2"><span className="mr-auto text-sm font-medium">Step {index + 1}</span>
          <Button type="button" variant="ghost" size="icon" title="Move up" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => set("steps", reorderPlaybookSteps(form.steps, index, -1))}><ArrowUp className="size-4" /></Button>
          <Button type="button" variant="ghost" size="icon" title="Move down" aria-label={`Move step ${index + 1} down`} disabled={index === form.steps.length - 1} onClick={() => set("steps", reorderPlaybookSteps(form.steps, index, 1))}><ArrowDown className="size-4" /></Button>
          <Button type="button" variant="ghost" size="icon" title="Remove step" aria-label={`Remove step ${index + 1}`} onClick={() => set("steps", form.steps.filter((_, i) => i !== index))}><Trash2 className="size-4" /></Button>
        </div>
        <Textarea aria-label={`Step ${index + 1} instruction`} required value={step.instruction} onChange={(e) => set("steps", form.steps.map((s, i) => i === index ? { ...s, instruction: e.target.value } : s))} />
        <Textarea aria-label={`Step ${index + 1} detail`} value={step.detail ?? ""} onChange={(e) => set("steps", form.steps.map((s, i) => i === index ? { ...s, detail: e.target.value } : s))} />
        <div className="flex flex-wrap gap-4">{([['required', 'Required'], ['photo_required', 'Photo required']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm"><Checkbox checked={step[key]} onCheckedChange={(checked) => set("steps", form.steps.map((s, i) => i === index ? { ...s, [key]: checked === true } : s))} />{label}</label>)}</div>
      </div>)}
      <Button type="button" size="sm" variant="outline" onClick={() => set("steps", [...form.steps, { instruction: "", detail: null, required: true, photo_required: false }])}><Plus className="size-4" />Add step</Button>
    </section>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save draft"}</Button><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button></div>
  </form>;
}