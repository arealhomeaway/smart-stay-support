/**
 * V2 template configuration for the Onboarding Director: stages (create,
 * rename, drag to reorder, deactivate), each step's role / required /
 * handoff-blocking / active / module / due-date offset, Active Owner
 * Opportunity content, and publishing an immutable version.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { ReactNode } from "react";
import { PlanCsvButton } from "@/components/onboarding/PlanCsvButton";
import { StepReviewSection } from "@/components/onboarding/StepReviewSection";
import { arrangeTemplateStepsFn, deleteTemplateStepFn, saveTemplateStepFn } from "@/lib/onboarding-template-admin.functions";
import { moveStep, stepGroups } from "@/lib/template-step-order";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readTemplateFileSources, saveTemplateFileSources } from "@/lib/step-file-links.functions";
import { SWITCH_HELP, TemplateBulkEditDialog } from "@/components/onboarding/TemplateBulkEditDialog";
import {
  FUNCTIONAL_ROLES,
  publishTemplateVersion,
  readTemplateV2,
  reorderTemplateStages,
  roleLabel,
  saveTemplateStage,
  materializeTemplateStages,
  saveTemplateStepV2,
  type OpportunityContent,
} from "@/lib/v2-workflow.functions";
import { OWNER_DEPENDENCIES, type OwnerDependency } from "@/lib/owner-dependency";
import {
  CONDITION_OPTIONS,
  PLAN_ANCHORS,
  anchorLabel,
  clauseLabel,
  describeCondition,
  describeRule,
  readCondition,
  stepApplies,
  type ConditionClause,
  type OffsetUnit,
} from "@/lib/plan-rules";
import { HANDOFF_LOCK_NOTE, completeOpportunity, handoffLocked } from "@/lib/template-step-dialog";
import { StepKindFields, type StepKindValue } from "@/components/onboarding/StepKindFields";
import { effectiveTaskKind, isTaskKind, type KindSettings } from "@/lib/onboarding-task-kinds";
import { readStepKindsFn, saveStepKindFn } from "@/lib/onboarding-task-kinds.functions";

type Stage = { id: string; name: string; sort_order: number; active: boolean };
type Step = Awaited<ReturnType<typeof readTemplateV2>>["steps"][number];
type StepInput = {
  stepId: string;
  title: string;
  detail: string | null;
  breezewayTemplateId: string | null;
  functionalRole: string | null;
  isRequired: boolean;
  blocksHandoff: boolean;
  isActive: boolean;
  ownerDependency: OwnerDependency;
  module: string | null;
  offsetDays: number | null;
  scheduleAnchor: string | null;
  offsetUnit: OffsetUnit;
  description: string | null;
  doneWhen: string | null;
  videoUrl: string | null;
  condition: { all: ConditionClause[] } | null;
  opportunity: OpportunityContent | null;
};

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

const stepDragId = (id: string) => `step:${id}`;

function DraggableStepRow({ step, children }: { step: { id: string; title: string; stage: string }; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stepDragId(step.id),
    data: { type: "step", stepId: step.id, stage: step.stage },
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="flex items-center gap-2 bg-card px-3 py-2">
      <button type="button" aria-label={`Drag ${step.title}`} className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="size-4" />
      </button>
      {children}
    </li>
  );
}

function StepStageDrop({ stage, children }: { stage: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `stage:${stage}`, data: { type: "stage", stage } });
  return <div ref={setNodeRef} data-stage-drop={stage} className={isOver ? "rounded-md ring-2 ring-primary/40" : undefined}>{children}</div>;
}

const emptyOpp: OpportunityContent = { title: "", what: "", why: "", how: "", resources: [], ways_to_document: "", suggested_minutes: null };

type KindOptions = {
  ready: boolean;
  byStep: Record<string, { kind: string; settings: KindSettings }>;
  emailTemplates: { id: string; name: string }[];
  trades: string[];
};

type FileSourceOptions = { ready: boolean; selected: string[]; options: { id: string; title: string; stage: string }[] };

function StepDialog({ step, onClose, onSave, onRemove, saving, fileSources, stageNames, kinds }: { step: Step; onClose: () => void; onSave: (v: StepInput, showFilesFrom: string[] | null, kind: StepKindValue | null) => void; onRemove: () => void; saving: boolean; fileSources: FileSourceOptions; stageNames: string[]; kinds: KindOptions }) {
  const storedKind = kinds.byStep[step.id];
  const [kind, setKind] = useState<StepKindValue>({
    kind: storedKind && isTaskKind(storedKind.kind) ? storedKind.kind : effectiveTaskKind(step),
    settings: storedKind?.settings ?? {},
  });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [showFrom, setShowFrom] = useState<string[]>(fileSources.selected);
  const [title, setTitle] = useState(step.title);
  const [detail, setDetail] = useState(step.detail ?? "");
  const [useBreezeway, setUseBreezeway] = useState(Boolean(step.breezeway_template_id));
  const [bzTemplate, setBzTemplate] = useState(step.breezeway_template_id ?? "");
  const [role, setRole] = useState(step.functional_role ?? "none");
  const [required, setRequired] = useState(step.is_required);
  const lockHandoff = handoffLocked(step);
  const [blocking, setBlocking] = useState(lockHandoff ? false : step.blocks_handoff);
  const [active, setActive] = useState(step.is_active);
  // Module and video link are no longer edited here; stored values are saved back unchanged.
  const module = step.module ?? "";
  const [dependency, setDependency] = useState<OwnerDependency>((step.owner_dependency as OwnerDependency | null) ?? "none");
  const [offset, setOffset] = useState(step.offset_days == null ? "" : String(step.offset_days));
  const [anchor, setAnchor] = useState<string>(step.schedule_anchor ?? "actual_access");
  const [unit, setUnit] = useState<OffsetUnit>((step.offset_unit as OffsetUnit | null) ?? "calendar");
  const [description, setDescription] = useState(step.description ?? "");
  const [doneWhen, setDoneWhen] = useState(step.done_when ?? "");
  const videoUrl = step.video_url ?? "";
  const stored = readCondition(step.condition);
  const [clauses, setClauses] = useState<ConditionClause[]>(stored.condition?.all ?? []);
  const toggleClause = (c: ConditionClause) =>
    setClauses((cur) => (cur.some((x) => x.field === c.field && x.value === c.value) ? cur.filter((x) => !(x.field === c.field && x.value === c.value)) : [...cur, c]));
  const offsetNum = offset.trim() === "" || Number.isNaN(Number(offset)) ? null : Math.round(Number(offset));
  const [eligible, setEligible] = useState(Boolean(step.opportunity));
  const [opp, setOpp] = useState<OpportunityContent>(step.opportunity ? completeOpportunity(step.opportunity, step.title) : { ...emptyOpp, title: step.title });
  const set = (k: keyof OpportunityContent, v: string) => setOpp((o) => ({ ...o, [k]: v }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{step.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <div className="space-y-1"><Label htmlFor="ttl">Internal Task title</Label><Input id="ttl" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="desc">Description <span className="font-normal text-muted-foreground">· what the step is and why it matters</span></Label><Textarea id="desc" rows={3} className="resize-y" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="det">Instructions <span className="font-normal text-muted-foreground">· how to do it</span></Label><Textarea id="det" rows={6} className="resize-y" value={detail} onChange={(e) => setDetail(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="done">Done when <span className="font-normal text-muted-foreground">· what finished looks like (guidance, not an approval step)</span></Label><Textarea id="done" rows={2} className="resize-y" value={doneWhen} onChange={(e) => setDoneWhen(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">All three are optional and internal only. Homeowners never see them; their wording is set separately below.</p>
        </div>
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
          <div className="space-y-1 sm:col-span-2">
            <Label>Due date rule</Label>
            <div className="flex flex-wrap gap-2">
              <Input id="off" aria-label="Days" inputMode="numeric" className="w-24" value={offset} onChange={(e) => setOffset(e.target.value)} placeholder="Days" />
              <Select value={unit} onValueChange={(v) => setUnit(v as OffsetUnit)}>
                <SelectTrigger className="w-40" aria-label="Day type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="business">Business days</SelectItem><SelectItem value="calendar">Calendar days</SelectItem></SelectContent>
              </Select>
              <Select value={anchor} onValueChange={setAnchor}>
                <SelectTrigger className="w-52" aria-label="From"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLAN_ANCHORS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  {anchor === "actual_closing" ? <SelectItem value="actual_closing">{anchorLabel("actual_closing")}</SelectItem> : null}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {describeRule(offsetNum === null ? null : anchor, offsetNum, unit)}. Use a negative number for "before". Business days are Monday to Friday; no holidays are skipped. Leave days empty for no rule. A missing anchor date leaves the Task undated.
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2 rounded-md border border-border p-3">
            <Label>Include this step only when</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {CONDITION_OPTIONS.map((o) => {
                const on = clauses.some((c) => c.field === o.field && c.value === o.value);
                return (
                  <button type="button" key={o.field + o.value} aria-pressed={on} onClick={() => toggleClause({ field: o.field, value: o.value })}
                    className={"rounded-full border px-2.5 py-1 text-xs " + (on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground")}>
                    {o.label}
                  </button>
                );
              })}
            </div>
            {stored.unknown.length ? <p className="mt-1 text-xs text-destructive">Unrecognized stored condition: {stored.unknown.map(clauseLabel).join(", ")}. It stays until you remove it.</p> : null}
            <p className="mt-1 text-xs text-muted-foreground">{describeCondition(clauses.length ? { all: clauses } : null)}. Read from the home's project scope when its plan is created; existing plans are not changed.</p>
          </div>
          <div className="space-y-1">
            <Label>Needs from the homeowner</Label>
            <Select value={dependency} onValueChange={(v) => setDependency(v as OwnerDependency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OWNER_DEPENDENCIES.map((d) => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm">
            <label className="flex items-center gap-2"><Switch checked={required} onCheckedChange={setRequired} /> Required</label>
            <p className="text-xs text-muted-foreground">{SWITCH_HELP.required}</p>
            <label className="flex items-center gap-2"><Switch checked={blocking} disabled={lockHandoff} onCheckedChange={setBlocking} /> Blocks handoff</label>
            <p className="text-xs text-muted-foreground">{SWITCH_HELP.blocksHandoff}</p>
            {lockHandoff ? <p className="text-xs text-muted-foreground">{HANDOFF_LOCK_NOTE}</p> : null}
            <label className="flex items-center gap-2"><Switch checked={active} onCheckedChange={setActive} /> Active in this plan</label>
            <p className="text-xs text-muted-foreground">{SWITCH_HELP.active}</p>
          </div>
        </div>

        <div className="mt-2 space-y-2 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={useBreezeway} onCheckedChange={setUseBreezeway} /> Use Breezeway for this Task
          </label>
          {useBreezeway ? (
            <div className="space-y-1">
              <Label htmlFor="bz">Breezeway template ID</Label>
              <Input id="bz" value={bzTemplate} onChange={(e) => setBzTemplate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Saving never creates a Breezeway task. Staff still send it deliberately from the Task.</p>
            </div>
          ) : null}
        </div>

        {kinds.ready ? (
          <StepKindFields value={kind} onChange={setKind} emailTemplates={kinds.emailTemplates} trades={kinds.trades} />
        ) : null}

        {fileSources.ready ? (
          <div className="mt-2 space-y-2 rounded-md border border-border p-3">
            <Label>Show files from</Label>
            <p className="text-xs text-muted-foreground">Files uploaded on these steps appear on this step for the same home. Nothing is copied. Internal only: homeowners and vendors never see them.</p>
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {fileSources.options.filter((o) => o.id !== step.id).map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={showFrom.includes(o.id)} onCheckedChange={(v) => setShowFrom((cur) => (v ? [...cur, o.id] : cur.filter((x) => x !== o.id)))} />
                  <span className="truncate">{o.title}</span>
                  <span className="text-xs text-muted-foreground">{o.stage}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <StepReviewSection stepId={step.id} steps={fileSources.options} stages={stageNames} />

        <div className="mt-2 space-y-3 rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch checked={eligible} onCheckedChange={setEligible} /> Active Owner Opportunity
          </label>
          {eligible ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Homeowners see this wording as an Opportunity once staff publish it. Saving never publishes. Its completion or reopening never changes the internal Task or handoff.
              </p>
              <div className="space-y-1"><Label>Opportunity title</Label><Input value={opp.title} onChange={(e) => set("title", e.target.value)} /></div>
              <div className="space-y-1"><Label>What you'll do</Label><Textarea rows={5} className="resize-y" value={opp.what} onChange={(e) => set("what", e.target.value)} /></div>
              <div className="space-y-1"><Label>Why this Opportunity matters</Label><Textarea rows={5} className="resize-y" value={opp.why} onChange={(e) => set("why", e.target.value)} /></div>
              <div className="space-y-1"><Label>How to complete it</Label><Textarea rows={5} className="resize-y" value={opp.how} onChange={(e) => set("how", e.target.value)} /></div>
              <div className="space-y-1"><Label>Ways to Document Your Participation</Label><Textarea rows={5} className="resize-y" value={opp.ways_to_document} onChange={(e) => set("ways_to_document", e.target.value)} placeholder="Notes, screenshots, links, uploads…" /></div>
              <div className="space-y-1">
                <Label>Helpful links (one per line)</Label>
                <Textarea rows={2} value={opp.resources.join("\n")} onChange={(e) => setOpp((o) => ({ ...o, resources: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) }))} />
              </div>
            </div>
          ) : null}
        </div>

        {confirmRemove ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p>Remove "{step.title}" from this plan? Homes already started keep their Task. New homes stop getting it after you publish.</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="destructive" disabled={saving} onClick={onRemove}>Remove step</Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmRemove(false)}>Keep it</Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" className="mr-auto text-destructive" onClick={() => setConfirmRemove(true)}>Remove step</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={saving || title.trim().length < 3 || (eligible && opp.title.trim().length < 3) || (useBreezeway && !bzTemplate.trim())}
            onClick={() =>
              onSave({
                stepId: step.id,
                title: title.trim(),
                detail: detail.trim() || null,
                breezewayTemplateId: useBreezeway ? bzTemplate.trim() : null,
                functionalRole: role === "none" ? null : role,
                isRequired: required,
                blocksHandoff: blocking,
                isActive: active,
                ownerDependency: dependency,
                module: module.trim() || null,
                offsetDays: offsetNum,
                scheduleAnchor: offsetNum === null ? null : anchor,
                offsetUnit: unit,
                description: description.trim() || null,
                doneWhen: doneWhen.trim() || null,
                videoUrl: videoUrl.trim() || null,
                condition: clauses.length ? { all: clauses } : null,
                opportunity: eligible ? opp : null,
              }, fileSources.ready ? showFrom : null, kinds.ready ? kind : null)
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
  const materialize = useServerFn(materializeTemplateStages);
  const reorder = useServerFn(reorderTemplateStages);
  const saveStep = useServerFn(saveTemplateStepV2);
  const publish = useServerFn(publishTemplateVersion);
  const arrangeSteps = useServerFn(arrangeTemplateStepsFn);
  const addStepFn = useServerFn(saveTemplateStepFn);
  const removeStepFn = useServerFn(deleteTemplateStepFn);
  const [adding, setAdding] = useState<{ stage: string; title: string } | null>(null);
  const stepSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const key = ["template-v2", templateId];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { templateId } }) });
  const refresh = () => void qc.invalidateQueries({ queryKey: key });
  const [stages, setStages] = useState<Stage[]>([]);
  const [newStage, setNewStage] = useState("");
  const [editing, setEditing] = useState<Step | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pvFurnishing, setPvFurnishing] = useState("full_furnishing");
  const [pvModules, setPvModules] = useState<string[]>([]);
  useEffect(() => setStages(q.data?.stages ?? []), [q.data?.stages]);
  useEffect(() => {
    const available = new Set((q.data?.steps ?? []).map((step) => step.id));
    setSelectedIds((current) => current.filter((id) => available.has(id)));
  }, [q.data?.steps]);

  const stageM = useMutation({ mutationFn: (d: { stageId?: string; name: string; active: boolean }) => saveStage({ data: { templateId, ...d } }), onSuccess: refresh, onError: onErr });
  const reorderM = useMutation({ mutationFn: (ids: string[]) => reorder({ data: { templateId, stageIds: ids } }), onSuccess: refresh, onError: onErr });
  // Same save path the older editor used: the whole plan order with each step's stage.
  const arrangeM = useMutation({
    mutationFn: (order: { stepId: string; stage: string }[]) => arrangeSteps({ data: { templateId, order } }),
    onSuccess: () => { toast.success("Plan order saved."); refresh(); },
    onError: (e) => { onErr(e); refresh(); },
  });
  // Same server functions the older editor used for adding and removing steps.
  const addM = useMutation({
    mutationFn: (d: { stage: string; title: string }) => addStepFn({ data: { templateId, stage: d.stage, title: d.title } }),
    onSuccess: async (_r, d) => {
      toast.success("Step added. Set its details now.");
      setAdding(null);
      const fresh = await q.refetch();
      const made = (fresh.data?.steps ?? []).filter((x) => x.stage === d.stage && x.title === d.title).sort((x, y) => y.sort_order - x.sort_order)[0];
      if (made) setEditing(made);
    },
    onError: onErr,
  });
  const removeM = useMutation({
    mutationFn: (stepId: string) => removeStepFn({ data: { templateId, stepId } }),
    onSuccess: () => { toast.success("Step removed from the plan."); setEditing(null); refresh(); },
    onError: onErr,
  });
  const readKinds = useServerFn(readStepKindsFn);
  const saveKind = useServerFn(saveStepKindFn);
  const kindsQ = useQuery({ queryKey: ["template-step-kinds", templateId], queryFn: () => readKinds({ data: { templateId } }) });
  const readSources = useServerFn(readTemplateFileSources);
  const saveSources = useServerFn(saveTemplateFileSources);
  const sourcesQ = useQuery({ queryKey: ["template-file-sources", templateId], queryFn: () => readSources({ data: { templateId } }) });
  const stepM = useMutation({
    mutationFn: async ({ d, showFrom, kind }: { d: StepInput; showFrom: string[] | null; kind: StepKindValue | null }) => {
      await saveStep({ data: d });
      if (kind) await saveKind({ data: { stepId: d.stepId, kind: kind.kind, settings: kind.settings } });
      const before = sourcesQ.data?.byStep[d.stepId] ?? [];
      if (showFrom && (showFrom.length !== before.length || showFrom.some((x) => !before.includes(x))))
        await saveSources({ data: { stepId: d.stepId, sourceIds: showFrom } });
    },
    onSuccess: () => { toast.success("Step saved."); setEditing(null); refresh(); void sourcesQ.refetch(); void kindsQ.refetch(); },
    onError: onErr,
  });
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
  const groups = stepGroups(stageNames, steps);
  const onStepDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || arrangeM.isPending) return;
    const stepId = String(active.data.current?.["stepId"] ?? "");
    const targetStage = String(over.data.current?.["stage"] ?? "");
    if (!stepId || !targetStage) return;
    const beforeStepId = over.data.current?.["type"] === "step" ? String(over.data.current?.["stepId"] ?? "") : null;
    if (beforeStepId === stepId) return;
    arrangeM.mutate(moveStep(groups, stepId, targetStage, beforeStepId));
  };
  const selected = new Set(selectedIds);
  const toggleStep = (stepId: string, checked: boolean) =>
    setSelectedIds((current) => (checked ? [...new Set([...current, stepId])] : current.filter((id) => id !== stepId)));
  const toggleSteps = (ids: string[], checked: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) checked ? next.add(id) : next.delete(id);
      return [...next];
    });

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
        <div className="flex flex-wrap items-center gap-2">
          <PlanCsvButton templateId={templateId} />
          <Button size="sm" onClick={() => publishM.mutate()} disabled={publishM.isPending}>Publish new version</Button>
        </div>
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
        {!stages.length && stageNames.length ? (
          <div className="rounded-md border border-dashed border-border p-3 text-sm">
            <p className="text-muted-foreground">
              This plan's stages ({stageNames.join(", ")}) came from an older import and can't be renamed or reordered yet.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={stageM.isPending}
              onClick={async () => {
                // Creates one editable stage per existing stage name, in current order. Steps keep their stage.
                try {
                  await materialize({ data: { templateId, names: stageNames } });
                  toast.success("Stages are now editable.");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "The stages could not be converted. Nothing was changed.");
                }
                refresh();
              }}
            >
              Make these stages editable
            </Button>
          </div>
        ) : null}
        <div className="mt-2 flex gap-2">
          <Input value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="New stage name" className="h-8" />
          <Button size="sm" variant="outline" disabled={newStage.trim().length < 2} onClick={() => { stageM.mutate({ name: newStage.trim(), active: true }); setNewStage(""); }}>Add stage</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">To reorder a step, drag it by its handle below. Drop it on another stage to move it there. New homes get the change only after you publish.</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="outline" disabled={!groups.length} onClick={() => setAdding({ stage: groups[0]?.[0] ?? "", title: "" })}>Add step</Button>
        </div>
        {adding ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-3">
            <div className="space-y-1">
              <Label>Stage</Label>
              <Select value={adding.stage} onValueChange={(v) => setAdding({ ...adding, stage: v })}>
                <SelectTrigger className="w-56" aria-label="Stage for the new step"><SelectValue /></SelectTrigger>
                <SelectContent>{groups.map(([n]) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-60 flex-1 space-y-1">
              <Label htmlFor="new-step-title">Step title</Label>
              <Input id="new-step-title" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} />
            </div>
            <Button size="sm" disabled={addM.isPending || adding.title.trim().length < 3 || !adding.stage} onClick={() => addM.mutate({ stage: adding.stage, title: adding.title.trim() })}>Add</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
          </div>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            aria-label="Select all steps in this template"
            checked={steps.length > 0 && selectedIds.length === steps.length}
            onCheckedChange={(checked) => toggleSteps(steps.map((step) => step.id), checked === true)}
          />
          Select all
        </label>
        <DndContext sensors={stepSensors} collisionDetection={closestCenter} onDragEnd={onStepDragEnd}>
        {groups.map(([name, inStage]) => (
            <div key={name}>
              <div className="mb-1 flex items-center gap-2">
                <Checkbox
                  aria-label={`Select all in ${name}`}
                  disabled={!inStage.length}
                  checked={inStage.length > 0 && inStage.every((step) => selected.has(step.id))}
                  onCheckedChange={(checked) => toggleSteps(inStage.map((step) => step.id), checked === true)}
                />
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{name}</p>
              </div>
              <StepStageDrop stage={name}>
                <SortableContext items={inStage.map((s) => stepDragId(s.id))} strategy={verticalListSortingStrategy}>
                  {!inStage.length ? <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">No steps in this stage. Drop one here to move it.</p> : null}
                  <ul className="divide-y divide-border rounded-md border border-border empty:hidden">
                    {inStage.map((s) => (
                      <DraggableStepRow key={s.id} step={s}>
                        <Checkbox
                          aria-label={`Select ${s.title}`}
                          checked={selected.has(s.id)}
                          onCheckedChange={(checked) => toggleStep(s.id, checked === true)}
                        />
                        <button type="button" className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left text-sm hover:bg-muted/50" onClick={() => setEditing(s)}>
                          <span className={s.is_active ? "font-medium" : "text-muted-foreground line-through"}>{s.title}</span>
                          <span className="text-xs text-muted-foreground">{roleLabel(s.functional_role)}</span>
                          {!s.is_required ? <Badge variant="outline">Optional</Badge> : null}
                          {s.blocks_handoff ? <Badge variant="outline">Blocks handoff</Badge> : null}
                          {s.breezeway_template_id ? <Badge variant="outline">Breezeway</Badge> : null}{s.opportunity ? <Badge variant="secondary">Owner Opportunity</Badge> : null}
                          {readCondition(s.condition).condition ? <Badge variant="outline">{describeCondition(readCondition(s.condition).condition)}</Badge> : null}
                        </button>
                      </DraggableStepRow>
                    ))}
                  </ul>
                </SortableContext>
              </StepStageDrop>
            </div>
        ))}
        </DndContext>
      </div>

      {selectedIds.length ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
          <span className="text-sm font-medium">{selectedIds.length} steps selected</span>
          <Button size="sm" onClick={() => setBulkOpen(true)}>Edit selected</Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>Clear</Button>
        </div>
      ) : null}

      <details className="rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Preview which steps a home would get</summary>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select value={pvFurnishing} onValueChange={setPvFurnishing}>
            <SelectTrigger className="w-60" aria-label="Furnishing"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CONDITION_OPTIONS.filter((o) => o.field === "furnishing_scope").map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {CONDITION_OPTIONS.filter((o) => o.field === "module").map((o) => {
            const on = pvModules.includes(o.value);
            return (
              <button type="button" key={o.value} aria-pressed={on} onClick={() => setPvModules((m) => (on ? m.filter((x) => x !== o.value) : [...m, o.value]))}
                className={"rounded-full border px-2.5 py-1 text-xs " + (on ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}>{o.label}</button>
            );
          })}
        </div>
        {(() => {
          const live = steps.filter((s) => s.is_active);
          const out = live.filter((s) => !stepApplies(readCondition(s.condition).condition, { furnishing_scope: pvFurnishing, modules: pvModules }));
          return (
            <div className="mt-2 text-xs text-muted-foreground">
              <p>{live.length - out.length} of {live.length} active steps would be created.</p>
              {out.length ? <p className="mt-1">Left out: {out.map((s) => s.title).join("; ")}</p> : null}
              <p className="mt-1">Homes get the last published version, so publish after changing conditions. Plans already created are not changed.</p>
            </div>
          );
        })()}
      </details>

      {editing ? <StepDialog step={editing} saving={stepM.isPending || removeM.isPending} onClose={() => setEditing(null)} onSave={(v, showFrom) => stepM.mutate({ d: v, showFrom })} onRemove={() => removeM.mutate(editing.id)} fileSources={{ ready: Boolean(sourcesQ.data?.ready), selected: sourcesQ.data?.byStep[editing.id] ?? [], options: steps.map((s) => ({ id: s.id, title: s.title, stage: s.stage })) }} stageNames={stageNames} /> : null}
      {bulkOpen ? (
        <TemplateBulkEditDialog
          templateId={templateId}
          steps={steps}
          stages={stageNames}
          selectedIds={selectedIds}
          onClose={() => setBulkOpen(false)}
          onSaved={() => {
            setBulkOpen(false);
            setSelectedIds([]);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}
