/**
 * V2 template configuration for the Onboarding Director: stages (create,
 * rename, drag to reorder, deactivate), each step's role / required /
 * handoff-blocking / active / module / due-date offset, Active Owner
 * Opportunity content, and publishing an immutable version.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FUNCTIONAL_ROLES,
  publishTemplateVersion,
  readTemplateV2,
  reorderTemplateStages,
  roleLabel,
  saveTemplateStage,
  saveTemplateStepV2,
  type OpportunityContent,
} from "@/lib/v2-workflow.functions";

type Stage = { id: string; name: string; sort_order: number; active: boolean };
type Step = Awaited<ReturnType<typeof readTemplateV2>>["steps"][number];

function onErr(e: unknown) {
  toast.error(e instanceof Error ? e.message : "Something went wrong.");
}

function SortableStage({ stage, onRename, onToggle }: { stage: Stage; onRename: (n: string) => void; onToggle: (a: boolean) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: stage.id });
  const [name, setName] = useState(stage.name);
  useEffect(() => setName(stage.name), [stage.name]);
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center gap-2 rounded-md border border-border bg-card p-2">
      <button type="button" aria-label={`Drag ${stage.name}`} className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() !== stage.name && name.trim().length >= 2 && onRename(name.trim())} className="h-8" />
      <label className="flex items-center gap-1 text-xs text-muted-foreground">
        <Switch checked={stage.active} onCheckedChange={onToggle} aria-label="Stage active" /> Active
      </label>
    </li>
  );
}

const emptyOpp: OpportunityContent = { title: "", what: "", why: "", how: "", resources: [], ways_to_document: "", suggested_minutes: null };

function StepDialog({ step, onClose, onSave, saving }: { step: Step; onClose: () => void; onSave: (v: Parameters<typeof saveTemplateStepV2>[0]["data"]) => void; saving: boolean }) {
  const [role, setRole] = useState(step.functional_role ?? "none");
  const [required, setRequired] = useState(step.is_required);
  const [blocking, setBlocking] = useState(step.blocks_handoff);
  const [active, setActive] = useState(step.is_active);
  const [module, setModule] = useState(step.module ?? "");
  const [offset, setOffset] = useState(step.offset_days == null ? "" : String(step.offset_days));
  const [eligible, setEligible] = useState(Boolean(step.opportunity));
  const [opp, setOpp] = useState<OpportunityContent>(step.opportunity ?? { ...emptyOpp, title: step.title });
  const set = (k: keyof OpportunityContent, v: string) => setOpp((o) => ({ ...o, [k]: v }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Assigned role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {FUNCTIONAL_ROLES.filter((r) => r.code !== "owner").map((r) => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="off">Due (business days from access date)</Label>
            <Input id="off" inputMode="numeric" value={offset} onChange={(e) => setOffset(e.target.value)} placeholder="No due date rule" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mod">Module (optional)</Label>
            <Input id="mod" value={module} onChange={(e) => setModule(e.target.value)} placeholder="e.g. furnishing, pool" />
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><Switch checked={required} onCheckedChange={setRequired} /> Required</label>
            <label className="flex items-center gap-2"><Switch checked={blocking} onCheckedChange={setBlocking} /> Blocks handoff</label>
            <label className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /> Active in this plan</label>
          </div>
        </div>

        <div className="mt-2 space-y-3 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={eligible} onCheckedChange={setEligible} /> Active Owner Opportunity
          </label>
          {eligible ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Homeowners see this as an Opportunity. It is separate from the internal Task and never blocks it.
              </p>
              <div className="space-y-1"><Label>Opportunity title</Label><Input value={opp.title} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="space-y-1"><Label>What you'll do</Label><Textarea rows={2} value={opp.what} onChange={(e) => set("what", e.target.value)} /></div>
              <div className="space-y-1"><Label>Why this Opportunity matters</Label><Textarea rows={2} value={opp.why} onChange={(e) => set("why", e.target.value)} /></div>
              <div className="space-y-1"><Label>How to complete it</Label><Textarea rows={2} value={opp.how} onChange={(e) => set("how", e.target.value)} /></div>
              <div className="space-y-1"><Label>Ways to Document Your Participation</Label><Textarea rows={2} value={opp.ways_to_document} onChange={(e) => set("ways_to_document", e.target.value)} placeholder="Notes, screenshots, links, uploads…" /></div>
              <div className="space-y-1">
                <Label>Helpful links (one per line)</Label>
                <Textarea rows={2} value={opp.resources.join("\n")} onChange={(e) => setOpp((o) => ({ ...o, resources: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }))} />
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving || (eligible && opp.title.trim().length < 3)}
            onClick={() =>
              onSave({
                stepId: step.id,
                functionalRole: role === "none" ? null : role,
                isRequired: required,
                blocksHandoff: blocking,
                isActive: active,
                module: module.trim() || null,
                offsetDays: offset.trim() === "" || Number.isNaN(Number(offset)) ? null : Math.round(Number(offset)),
                opportunity: eligible ? opp : null,
              })
            }
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TemplateV2Settings({ templateId }: { templateId: string }) {
  const qc = useQueryClient();
  const read = useServerFn(readTemplateV2);
  const saveStage = useServerFn(saveTemplateStage);
  const reorder = useServerFn(reorderTemplateStages);
  const saveStep = useServerFn(saveTemplateStepV2);
  const publish = useServerFn(publishTemplateVersion);
  const key = ["template-v2", templateId];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { templateId } }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const [stages, setStages] = useState<Stage[]>([]);
  const [newStage, setNewStage] = useState("");
  const [editing, setEditing] = useState<Step | null>(null);
  useEffect(() => setStages(q.data?.stages ?? []), [q.data?.stages]);

  const stageM = useMutation({ mutationFn: (d: { stageId?: string; name: string; active: boolean }) => saveStage({ data: { templateId, ...d } }), onSuccess: refresh, onError: onErr });
  const reorderM = useMutation({ mutationFn: (ids: string[]) => reorder({ data: { templateId, stageIds: ids } }), onSuccess: refresh, onError: onErr });
  const stepM = useMutation({ mutationFn: (d: Parameters<typeof saveStep>[0]["data"]) => saveStep({ data: d }), onSuccess: () => { toast.success("Step saved."); setEditing(null); refresh(); }, onError: onErr });
  const publishM = useMutation({ mutationFn: () => publish({ data: { templateId } }), onSuccess: () => { toast.success("New version published. Homes already started keep their version."); refresh(); }, onError: onErr });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading plan settings…</p>;
  if (!q.data) return null;
  const { steps, versions } = q.data;
  const latest = versions[0];

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = stages.findIndex((s) => s.id === e.active.id);
    const to = stages.findIndex((s) => s.id === e.over!.id);
    const next = arrayMove(stages, from, to);
    setStages(next);
    reorderM.mutate(next.map((s) => s.id));
  };

  const stageNames = stages.length ? stages.map((s) => s.name) : Array.from(new Set(steps.map((s) => s.stage)));

  return (
    <section className="surface space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">Plan settings</p>
          <p className="text-sm text-muted-foreground">
            Roles, required and handoff settings, due dates and Active Owner Opportunities.{" "}
            {latest ? `Published version ${latest.version} (${new Date(latest.published_at).toLocaleDateString()}).` : "Not published yet."}
          </p>
        </div>
        <Button size="sm" onClick={() => publishM.mutate()} disabled={publishM.isPending}>Publish new version</Button>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Stages</p>
        <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {stages.map((s) => (
                <SortableStage key={s.id} stage={s} onRename={(name) => stageM.mutate({ stageId: s.id, name, active: s.active })} onToggle={(active) => stageM.mutate({ stageId: s.id, name: s.name, active })} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="mt-2 flex gap-2">
          <Input value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="New stage name" className="h-8" />
          <Button size="sm" variant="outline" disabled={newStage.trim().length < 2} onClick={() => { stageM.mutate({ name: newStage.trim(), active: true }); setNewStage(""); }}>Add stage</Button>
        </div>
      </div>

      <div className="space-y-3">
        {stageNames.map((name) => {
          const inStage = steps.filter((s) => s.stage === name);
          if (!inStage.length) return null;
          return (
            <div key={name}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{name}</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {inStage.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50" onClick={() => setEditing(s)}>
                      <span className={s.is_active ? "font-medium" : "text-muted-foreground line-through"}>{s.title}</span>
                      <span className="text-xs text-muted-foreground">{roleLabel(s.functional_role)}</span>
                      {!s.is_required ? <Badge variant="outline">Optional</Badge> : null}
                      {s.blocks_handoff ? <Badge variant="outline">Blocks handoff</Badge> : null}
                      {s.opportunity ? <Badge variant="secondary">Owner Opportunity</Badge> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {editing ? <StepDialog step={editing} saving={stepM.isPending} onClose={() => setEditing(null)} onSave={(v) => stepM.mutate(v)} /> : null}
    </section>
  );
}
