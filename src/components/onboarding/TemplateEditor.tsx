/**
 * Edit one onboarding template: its steps, their stage, timing and rules.
 * Directors only — the page that renders this already gates on the capability.
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanCsvButton } from "@/components/onboarding/PlanCsvButton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ONBOARDING_STAGES, stageLabel } from "@/lib/onboarding";
import {
  arrangeTemplateStepsFn,
  deleteTemplateStepFn,
  readOnboardingTemplateFn,
  saveTemplateStepFn,
} from "@/lib/onboarding-template-admin.functions";

type Detail = Awaited<ReturnType<typeof readOnboardingTemplateFn>>;
type Step = Detail["steps"][number];

const ANCHORS = [
  { value: "none", label: "No automatic date" },
  { value: "actual_access", label: "Days after access (possession)" },
  { value: "actual_closing", label: "Days after closing" },
  { value: "planned_closing", label: "Days after planned closing" },
] as const;

type Draft = {
  stepId?: string;
  stage: string;
  title: string;
  role: string;
  detail: string;
  anchor: string;
  offsetDays: string;
  blocksHandoff: boolean;
  requiresOwnerApproval: boolean;
  ownerApprovalWhenActiveOwner: boolean;
  evidenceRequired: boolean;
  breezewayTemplateId: string;
  subtasks: string;
  tags: string;
};

/** The one reserved tag: this step is work the homeowner does. */
export const ACTIVE_OWNER_TAG = "active_owner";

export function tagLabel(tag: string) {
  return tag === ACTIVE_OWNER_TAG
    ? "Active Owner"
    : tag.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

const stepDragId = (id: string) => `step:${id}`;
const stageDropId = (stage: string) => `stage:${stage}`;

function SortableStep({
  step,
  onEdit,
  onDelete,
}: {
  step: Step;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stepDragId(step.id),
    data: { type: "step", stepId: step.id, stage: step.stage },
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start justify-between gap-3 p-3 ${isDragging ? "z-10 opacity-50" : ""} ${
        (step.tags ?? []).includes(ACTIVE_OWNER_TAG)
          ? "bg-primary/5 border-primary border-l-4"
          : ""
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Drag ${step.title} to reorder`}
          className="text-muted-foreground -ml-2 h-7 w-7 shrink-0 cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{step.title}</p>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {step.role ? <Badge variant="outline">{step.role}</Badge> : null}
            {step.anchor ? (
              <Badge variant="secondary">
                {step.anchor === "actual_access"
                  ? "Access"
                  : step.anchor === "actual_closing"
                    ? "Closing"
                    : "Planned closing"}{" "}
                {(step.offsetDays ?? 0) >= 0 ? "+" : ""}
                {step.offsetDays}d
              </Badge>
            ) : (
              <Badge variant="outline">Paced automatically</Badge>
            )}
            {step.blocksHandoff ? <Badge variant="outline">Blocks handoff</Badge> : null}
            {step.requiresOwnerApproval ? <Badge variant="outline">Homeowner approval</Badge> : null}
            {step.ownerApprovalWhenActiveOwner ? (
              <Badge variant="outline">Approval for Active Owner homes</Badge>
            ) : null}
            {step.evidenceRequired ? <Badge variant="outline">Evidence required</Badge> : null}
            {(step.tags ?? []).map((tag) => (
              <Badge key={tag} variant={tag === ACTIVE_OWNER_TAG ? "default" : "secondary"}>
                {tagLabel(tag)}
              </Badge>
            ))}
            {step.subtasks?.length ? (
              <Badge variant="outline">{step.subtasks.length} subtasks</Badge>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon" aria-label="Edit step" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Remove step" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function StageDropZone({ stage, children }: { stage: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageDropId(stage),
    data: { type: "stage", stage },
  });
  return (
    <div ref={setNodeRef} className={isOver ? "rounded-md ring-2 ring-primary/40" : undefined}>
      {children}
    </div>
  );
}

function emptyDraft(): Draft {
  return {
    stage: ONBOARDING_STAGES[7].value,
    title: "",
    role: "",
    detail: "",
    anchor: "none",
    offsetDays: "",
    blocksHandoff: false,
    requiresOwnerApproval: false,
    ownerApprovalWhenActiveOwner: false,
    evidenceRequired: false,
    breezewayTemplateId: "",
    subtasks: "",
    tags: "",
  };
}

function draftFrom(step: Step): Draft {
  return {
    stepId: step.id,
    stage: step.stage,
    title: step.title,
    role: step.role ?? "",
    detail: step.detail ?? "",
    anchor: step.anchor ?? "none",
    offsetDays: step.offsetDays == null ? "" : String(step.offsetDays),
    blocksHandoff: Boolean(step.blocksHandoff),
    requiresOwnerApproval: Boolean(step.requiresOwnerApproval),
    ownerApprovalWhenActiveOwner: Boolean(step.ownerApprovalWhenActiveOwner),
    evidenceRequired: Boolean(step.evidenceRequired),
    breezewayTemplateId: step.breezewayTemplateId ?? "",
    subtasks: (step.subtasks ?? []).join("\n"),
    tags: (step.tags ?? []).join(", "),
  };
}

export function TemplateEditor({ templateId }: { templateId: string }) {
  const qc = useQueryClient();
  const read = useServerFn(readOnboardingTemplateFn);
  const saveStep = useServerFn(saveTemplateStepFn);
  const removeStep = useServerFn(deleteTemplateStepFn);
  const arrangeSteps = useServerFn(arrangeTemplateStepsFn);
  const [draft, setDraft] = useState<Draft | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const key = ["onboarding-template", templateId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => read({ data: { templateId } }),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: (d: Draft) =>
      saveStep({
        data: {
          templateId,
          ...(d.stepId ? { stepId: d.stepId } : {}),
          stage: d.stage,
          title: d.title,
          role: d.role,
          detail: d.detail,
          blocksHandoff: d.blocksHandoff,
          requiresOwnerApproval: d.requiresOwnerApproval,
          ownerApprovalWhenActiveOwner: d.ownerApprovalWhenActiveOwner,
          evidenceRequired: d.evidenceRequired,
          scheduleAnchor: d.anchor === "none" ? null : (d.anchor as never),
          offsetDays: d.anchor === "none" ? null : Number(d.offsetDays || 0),
          breezewayTemplateId: d.breezewayTemplateId,
          subtasks: d.subtasks
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          tags: d.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Step saved.");
      setDraft(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (stepId: string) => removeStep({ data: { templateId, stepId } }),
    onSuccess: () => {
      toast.success("Step removed from the template.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const arrange = useMutation({
    mutationFn: (order: { stepId: string; stage: string }[]) =>
      arrangeSteps({ data: { templateId, order } }),
    onSuccess: () => {
      toast.success("Plan order saved.");
      refresh();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });

  // Stages always read in the order a home actually moves through them, not in
  // whatever order steps happen to have been added.
  const grouped = useMemo(() => {
    const steps = [...(data?.steps ?? [])];
    const byStage = new Map<string, Step[]>(ONBOARDING_STAGES.map((s) => [s.value, []]));
    for (const step of steps) {
      const list = byStage.get(step.stage);
      if (list) list.push(step);
      else byStage.set(step.stage, [step]);
    }
    return [...byStage.entries()];
  }, [data]);

  /** The whole plan as the screen currently shows it, stage by stage. */
  const flatOrder = () =>
    grouped.flatMap(([stage, steps]) => steps.map((s) => ({ stepId: s.id, stage })));

  /** Save the plan with one step lifted out and dropped at a new spot. */
  const dropStep = (stepId: string, stage: string, beforeStepId: string | null) => {
    const order = flatOrder().filter((e) => e.stepId !== stepId);
    const moved = { stepId, stage };
    if (beforeStepId) {
      const at = order.findIndex((e) => e.stepId === beforeStepId);
      order.splice(at < 0 ? order.length : at, 0, moved);
    } else {
      // Dropped on the stage itself: put it at the end of that stage.
      let at = order.length;
      for (let i = order.length - 1; i >= 0; i -= 1) {
        if (order[i]!.stage === stage) {
          at = i + 1;
          break;
        }
      }
      order.splice(at, 0, moved);
    }
    arrange.mutate(order);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || arrange.isPending) return;
    const stepId = String(active.data.current?.["stepId"] ?? "");
    if (!stepId) return;
    const targetType = over.data.current?.["type"];
    const targetStage = String(over.data.current?.["stage"] ?? "");
    if (!targetStage) return;
    const beforeStepId =
      targetType === "step" ? String(over.data.current?.["stepId"] ?? "") : null;
    if (beforeStepId === stepId) return;
    dropStep(stepId, targetStage, beforeStepId);
  };

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading the template…</p>;
  if (!data) return <p className="text-muted-foreground text-sm">That template was not found.</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">{data.name} <PlanCsvButton templateId={templateId} /></CardTitle>
          <CardDescription>
            {data.steps.length} step{data.steps.length === 1 ? "" : "s"}. Every home this plan is
            applied to gets these steps, in this order, with these deadlines. Drag a step by its
            handle to reorder it, or drop it on another stage to move it there.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-1 h-4 w-4" /> Add step
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {grouped.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            This template is empty. Add its first step, or duplicate the built-in plan and edit that
            instead.
          </p>
        ) : null}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          {grouped.map(([stage, steps]) => (
          <div key={stage} className="space-y-2">
            <h3 className="text-sm font-medium">
              {stageLabel(stage)}{" "}
              <span className="text-muted-foreground font-normal">
                · {steps.length} step{steps.length === 1 ? "" : "s"}
              </span>
            </h3>
            <StageDropZone stage={stage}>
              <SortableContext
                items={steps.map((step) => stepDragId(step.id))}
                strategy={verticalListSortingStrategy}
              >
                {steps.length === 0 ? (
                  <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                    No steps in this stage. Drop one here to move it.
                  </p>
                ) : null}
                <ul className="divide-y rounded-md border empty:hidden">
                  {steps.map((step) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      onEdit={() => setDraft(draftFrom(step))}
                      onDelete={() => del.mutate(step.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </StageDropZone>
          </div>
          ))}
        </DndContext>
      </CardContent>

      <Dialog open={Boolean(draft)} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.stepId ? "Edit step" : "Add step"}</DialogTitle>
            <DialogDescription>
              What the team has to do, when it is due, and what has to be true before it counts as
              done.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Stage</Label>
                  <Select
                    value={draft.stage}
                    onValueChange={(v) => setDraft({ ...draft, stage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ONBOARDING_STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Who owns it</Label>
                  <Input
                    placeholder="Project Manager"
                    value={draft.role}
                    onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Deadline</Label>
                  <Select
                    value={draft.anchor}
                    onValueChange={(v) => setDraft({ ...draft, anchor: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANCHORS.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Days</Label>
                  <Input
                    type="number"
                    disabled={draft.anchor === "none"}
                    value={draft.offsetDays}
                    onChange={(e) => setDraft({ ...draft, offsetDays: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Instructions</Label>
                <Textarea
                  rows={8} className="min-h-40 resize-y"
                  value={draft.detail}
                  onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Subtasks (one per line)</Label>
                <Textarea
                  rows={3}
                  value={draft.subtasks}
                  onChange={(e) => setDraft({ ...draft, subtasks: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Tags (comma separated)</Label>
                <Input
                  placeholder="active_owner, design"
                  value={draft.tags}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                />
                <p className="text-muted-foreground text-xs">
                  Tag a step <span className="font-medium">active_owner</span> when the homeowner
                  does it. Those steps stand out on the home and can be sent straight to the
                  homeowner&rsquo;s portal.
                </p>
                <label className="flex items-center gap-2 pt-1 text-sm">
                  <Checkbox
                    checked={draft.tags
                      .split(",")
                      .map((t) => t.trim().toLowerCase())
                      .includes(ACTIVE_OWNER_TAG)}
                    onCheckedChange={(v) => {
                      const list = draft.tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .filter((t) => t.toLowerCase() !== ACTIVE_OWNER_TAG);
                      if (v === true) list.unshift(ACTIVE_OWNER_TAG);
                      setDraft({ ...draft, tags: list.join(", ") });
                    }}
                  />
                  Active Owner step
                </label>
              </div>
              <div className="space-y-1">
                <Label>Breezeway template ID (optional)</Label>
                <Input
                  value={draft.breezewayTemplateId}
                  onChange={(e) => setDraft({ ...draft, breezewayTemplateId: e.target.value })}
                />
              </div>
              <div className="space-y-2 rounded-md border p-3">
                {(
                  [
                    ["blocksHandoff", "Must be done before handoff"],
                    ["requiresOwnerApproval", "Needs homeowner approval"],
                    ["ownerApprovalWhenActiveOwner", "Needs approval on Active Owner homes only"],
                    ["evidenceRequired", "Needs a photo or document to close"],
                  ] as const
                ).map(([field, label]) => (
                  <label key={field} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft[field]}
                      onCheckedChange={(v) => setDraft({ ...draft, [field]: v === true })}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || !draft?.title.trim()}
              onClick={() => draft && save.mutate(draft)}
            >
              {save.isPending ? "Saving…" : "Save step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
