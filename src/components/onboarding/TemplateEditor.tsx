/**
 * Edit one onboarding template: its steps, their stage, timing and rules.
 * Directors only — the page that renders this already gates on the capability.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  reorderTemplateStepFn,
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
};

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
  };
}

export function TemplateEditor({ templateId }: { templateId: string }) {
  const qc = useQueryClient();
  const read = useServerFn(readOnboardingTemplateFn);
  const saveStep = useServerFn(saveTemplateStepFn);
  const removeStep = useServerFn(deleteTemplateStepFn);
  const reorder = useServerFn(reorderTemplateStepFn);
  const arrangeSteps = useServerFn(arrangeTemplateStepsFn);
  const [dragging, setDragging] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

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

  const move = useMutation({
    mutationFn: (v: { stepId: string; direction: "up" | "down" }) =>
      reorder({ data: { templateId, ...v } }),
    onSuccess: refresh,
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

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading the template…</p>;
  if (!data) return <p className="text-muted-foreground text-sm">That template was not found.</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">{data.name}</CardTitle>
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

        {grouped.map(([stage, steps]) => (
          <div
            key={stage}
            className="space-y-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging) dropStep(dragging, stage, null);
              setDragging(null);
            }}
          >
            <h3 className="text-sm font-medium">
              {stageLabel(stage)}{" "}
              <span className="text-muted-foreground font-normal">
                · {steps.length} step{steps.length === 1 ? "" : "s"}
              </span>
            </h3>
            {steps.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
                No steps in this stage. Drop one here to move it.
              </p>
            ) : null}
            <ul className="divide-y rounded-md border empty:hidden">
              {steps.map((s) => (
                <li
                  key={s.id}
                  draggable
                  onDragStart={() => setDragging(s.id)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragging && dragging !== s.id) dropStep(dragging, stage, s.id);
                    setDragging(null);
                  }}
                  className={`flex items-start justify-between gap-3 p-3 ${
                    dragging === s.id ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <GripVertical
                      aria-label="Drag to reorder"
                      className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 cursor-grab"
                    />
                    <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">{s.title}</p>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {s.role ? <Badge variant="outline">{s.role}</Badge> : null}
                      {s.anchor ? (
                        <Badge variant="secondary">
                          {s.anchor === "actual_access"
                            ? "Access"
                            : s.anchor === "actual_closing"
                              ? "Closing"
                              : "Planned closing"}{" "}
                          {(s.offsetDays ?? 0) >= 0 ? "+" : ""}
                          {s.offsetDays}d
                        </Badge>
                      ) : (
                        <Badge variant="outline">Paced automatically</Badge>
                      )}
                      {s.blocksHandoff ? <Badge variant="outline">Blocks handoff</Badge> : null}
                      {s.requiresOwnerApproval ? (
                        <Badge variant="outline">Homeowner approval</Badge>
                      ) : null}
                      {s.ownerApprovalWhenActiveOwner ? (
                        <Badge variant="outline">Approval for Active Owner homes</Badge>
                      ) : null}
                      {s.evidenceRequired ? <Badge variant="outline">Evidence required</Badge> : null}
                      {s.subtasks?.length ? (
                        <Badge variant="outline">{s.subtasks.length} subtasks</Badge>
                      ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move up"
                      onClick={() => move.mutate({ stepId: s.id, direction: "up" })}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Move down"
                      onClick={() => move.mutate({ stepId: s.id, direction: "down" })}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit step"
                      onClick={() => setDraft(draftFrom(s))}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove step"
                      onClick={() => del.mutate(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
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
                  rows={3}
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
