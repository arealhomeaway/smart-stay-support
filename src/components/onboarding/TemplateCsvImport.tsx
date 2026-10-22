import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { importTemplateCsvFn } from "@/lib/onboarding-template-admin.functions";
import type { ImportPreview } from "@/lib/plan-csv-import";
import { describeCondition, describeRule } from "@/lib/plan-rules";

/** Upload an edited Resolve CSV to create a NEW template. Preview first; nothing existing changes. */
export function TemplateCsvImport({ onCreated }: { onCreated: (id: string) => void }) {
  const run = useServerFn(importTemplateCsvFn);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [csv, setCsv] = useState("");
  const [file, setFile] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const reset = () => { setName(""); setCsv(""); setFile(""); setPreview(null); };
  const check = useMutation({
    mutationFn: (text: string) => run({ data: { name: name.trim().length >= 3 ? name : "Preview", csv: text, save: false } }),
    onSuccess: (r) => setPreview(r.preview),
    onError: (e: Error) => toast.error(e.message),
  });
  const save = useMutation({
    mutationFn: () => run({ data: { name, csv, save: true } }),
    onSuccess: (r) => {
      if (!r.templateId) { setPreview(r.preview); return; }
      toast.success(`New template created with ${r.preview.stages.length} stages and ${r.preview.taskCount} Tasks.`);
      setOpen(false); reset(); onCreated(r.templateId);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Upload className="mr-1 h-4 w-4" /> Import CSV as new template</Button>
      <Dialog open={open} onOpenChange={(v) => { if (!save.isPending) { setOpen(v); if (!v) reset(); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import CSV as a new template</DialogTitle>
            <DialogDescription>
              Start from a Resolve “Download CSV” of any plan or template, edit it, and upload it here. This always
              creates a brand-new template; existing templates, home plans, owner Opportunities and Breezeway are never changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <details className="rounded-md border p-2 text-xs">
              <summary className="cursor-pointer font-medium">Which columns to keep and edit</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li><b>Required:</b> Stage, Task. Keep the export’s header row exactly; unknown columns are refused.</li>
                <li><b>Order:</b> Stage order (number) sets stage order; Task order (number) sets order inside a stage. Blank = file order.</li>
                <li><b>Edit freely:</b> Description, Internal instructions, Done when, Video link (https:// only), Module, Breezeway template.</li>
                <li><b>Assigned role:</b> Director of Onboarding, Onboarding Manager, Project Manager, Onboarding Utilities Coordinator, Lead Designer, Designer, Staging Team, or blank. Other names are refused.</li>
                <li><b>Due rule:</b> like “3 business day(s) before planned closing” or “2 day(s) after actual access”. Anchors: project created, planned closing, actual access, target handoff. Blank = no rule.</li>
                <li><b>Conditions:</b> leave blank to include the Task on every home. To limit it, name the setting and its value, for example only fully furnished homes that have a pool: <span className="font-mono">furnishing_scope=full_furnishing; module=pool</span>. Separate several with a semicolon; every one must be true. Settings or values Resolve does not recognize are refused.</li>
                <li><b>Yes/No:</b> Required, Blocks handoff, Evidence required, Owner approval, Owner Opportunity.</li>
                <li><b>Owner dependency:</b> none, information, feedback, acknowledge or business_decision.</li>
                <li><b>Owner Opportunity = Yes</b> needs an Owner-facing title (what/why/how optional). It is saved as template text only — nothing is sent.</li>
                <li><b>Ignored:</b> Plan, Assigned person, Status, Due date — completion and home-specific assignments never carry over.</li>
              </ul>
            </details>
            <div className="space-y-1"><Label htmlFor="tci-name">New template name</Label><Input id="tci-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1">
              <Label htmlFor="tci-file">CSV file</Label>
              <Input id="tci-file" type="file" accept=".csv,text/csv" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                const text = await f.text(); setCsv(text); setFile(f.name); setPreview(null); check.mutate(text);
              }} />
              {file ? <p className="text-xs text-muted-foreground">{file}</p> : null}
            </div>
            {check.isPending ? <p className="text-muted-foreground">Checking the file…</p> : null}
            {preview ? (
              <div className="space-y-2">
                {preview.errors.length ? (
                  <div role="alert" className="rounded-md border border-destructive p-2">
                    <p className="font-medium text-destructive">Fix these rows and upload again ({preview.errors.length})</p>
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {preview.errors.map((er, i) => <li key={i}>Row {er.row}: {er.message}</li>)}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {preview.stages.length} stages · {preview.taskCount} Tasks
                    {preview.ignoredColumns.length ? ` · ignored columns: ${preview.ignoredColumns.join(", ")}` : ""}
                  </p>
                )}
                {preview.warnings?.length ? (
                  <div className="rounded-md border border-border p-2 text-xs">
                    <p className="font-medium">Saved as written, but please check ({preview.warnings.length})</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {preview.warnings.map((w, i) => <li key={i}>Row {w.row}: {w.message}</li>)}
                    </ul>
                  </div>
                ) : null}
                <ol className="space-y-2" aria-label="Template preview">
                  {preview.stages.map((s) => (
                    <li key={s.name} className="rounded-md border p-2">
                      <p className="font-medium">{s.order}. {s.name}</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs">
                        {s.tasks.map((t) => (
                          <li key={t.row}>
                            {t.title}
                            <span className="text-muted-foreground">
                              {t.functionalRole || t.role ? ` · ${t.functionalRole ?? t.role}` : ""}
                              {t.scheduleAnchor ? ` · ${describeRule(t.scheduleAnchor, t.offsetDays, t.offsetUnit)}` : ""}
                              {t.condition ? ` · ${describeCondition(t.condition)}` : ""}
                              {t.description || t.doneWhen || t.videoUrl ? " · has guidance" : ""}
                              {t.blocksHandoff ? " · blocks handoff" : ""}{t.evidenceRequired ? " · evidence" : ""}
                              {t.opportunity ? " · owner Opportunity text" : ""}{t.breezewayTemplateId ? " · Breezeway template" : ""}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={save.isPending} onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
            <Button disabled={!preview || preview.errors.length > 0 || name.trim().length < 3 || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Creating…" : "Create new template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
