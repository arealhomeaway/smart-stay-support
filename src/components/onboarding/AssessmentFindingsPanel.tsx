import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usDate } from "@/lib/dates";
import {
  CONTEXT_LABEL,
  FINDING_CATEGORIES,
  FINDING_CATEGORY_LABEL,
  FINDING_CONTEXTS,
  FINDING_SEVERITIES,
  SEVERITY_DUE_DAYS,
  SEVERITY_LABEL,
  findingCounts,
  type AssessmentFinding,
  type FindingSeverity,
} from "@/lib/assessment-findings";
import {
  getAssessmentFindings,
  recordAssessmentFindingFn,
  setFindingStatusFn,
} from "@/lib/assessment-findings.functions";

type FindingInput = {
  propertyId: string;
  sourceTaskId: string | null;
  context: "new_house_setup" | "pre_work" | "standard_assessment";
  category:
    | "missing_item"
    | "damage"
    | "plumbing"
    | "electrical"
    | "appliance"
    | "hvac"
    | "maintenance"
    | "supplies"
    | "inventory"
    | "other";
  title: string;
  detail: string | null;
  location: string | null;
  severity: "urgent" | "normal" | "minor";
  photoUrl: string | null;
};

const EMPTY = {
  context: "standard_assessment",
  category: "missing_item",
  title: "",
  detail: "",
  location: "",
  severity: "normal",
  photoUrl: "",
};

/**
 * Assessment findings for one home. Recording a finding always opens a tracked
 * correction task with an owner, a due date and a photo requirement.
 */
export function AssessmentFindingsPanel({
  propertyId,
  canEdit,
  onOpenTask,
}: {
  propertyId: string;
  canEdit: boolean;
  onOpenTask?: (taskId: string) => void;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getAssessmentFindings);
  const record = useServerFn(recordAssessmentFindingFn);
  const setStatus = useServerFn(setFindingStatusFn);

  const { data, isLoading } = useQuery({
    queryKey: ["assessment-findings", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["assessment-findings", propertyId] }),
      qc.invalidateQueries({ queryKey: ["onboarding-workspace"] }),
    ]);

  const recordMutation = useMutation({
    mutationFn: (input: FindingInput) => record({ data: input }),
    onSuccess: (result) => {
      toast.success(
        result.duplicate
          ? "That finding is already recorded — its correction task stays as it is."
          : "Finding recorded and a correction task was created.",
      );
      setOpen(false);
      setForm(EMPTY);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { findingId: string; status: "open" | "corrected" | "dismissed" }) =>
      setStatus({ data: input }),
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading findings…</p>;

  const findings = (data?.findings ?? []) as AssessmentFinding[];
  const tasks = new Map((data?.tasks ?? []).map((t) => [t.id, t]));
  const counts = findingCounts(findings);
  const dueDays = SEVERITY_DUE_DAYS[form.severity as FindingSeverity] ?? 7;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Assessment findings</CardTitle>
          <CardDescription>
            {counts.open} open · {counts.urgent} urgent · {counts.corrected} corrected. Each finding
            opens a correction task that needs a photo before it can be closed.
          </CardDescription>
        </div>
        {canEdit && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Record a finding</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Record an assessment finding</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Assessment</Label>
                    <Select
                      value={form.context}
                      onValueChange={(v) => setForm({ ...form, context: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINDING_CONTEXTS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINDING_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="finding-title">What is wrong or missing</Label>
                  <Input
                    id="finding-title"
                    placeholder="Missing bedroom TV remote"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="finding-location">Where</Label>
                    <Input
                      id="finding-location"
                      placeholder="Primary bedroom"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>How urgent</Label>
                    <Select
                      value={form.severity}
                      onValueChange={(v) => setForm({ ...form, severity: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINDING_SEVERITIES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="finding-detail">Detail</Label>
                  <Textarea
                    id="finding-detail"
                    value={form.detail}
                    onChange={(e) => setForm({ ...form, detail: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="finding-photo">Photo link (optional)</Label>
                  <Input
                    id="finding-photo"
                    placeholder="https://…"
                    value={form.photoUrl}
                    onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A correction task will be created and due in {dueDays} days, with a photo required
                  before it can be closed.
                </p>
                <Button
                  disabled={form.title.trim().length < 3 || recordMutation.isPending}
                  onClick={() =>
                    recordMutation.mutate({
                      propertyId,
                      sourceTaskId: null,
                      context: form.context as FindingInput["context"],
                      category: form.category as FindingInput["category"],
                      title: form.title.trim(),
                      detail: form.detail.trim() || null,
                      location: form.location.trim() || null,
                      severity: form.severity as FindingInput["severity"],
                      photoUrl: form.photoUrl.trim() || null,
                    })
                  }
                >
                  Record finding
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {findings.length === 0 ? (
          <p className="text-muted-foreground">
            Nothing has been flagged at this home during an assessment.
          </p>
        ) : (
          findings.map((f) => {
            const task = f.correction_task_id ? tasks.get(f.correction_task_id) : null;
            return (
              <div key={f.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{f.title}</span>
                  <Chip>{SEVERITY_LABEL[f.severity] ?? f.severity}</Chip>
                  <Chip>{FINDING_CATEGORY_LABEL[f.category] ?? f.category}</Chip>
                  <Chip>{CONTEXT_LABEL[f.context] ?? f.context}</Chip>
                  {f.status !== "open" && <Chip>{f.status === "corrected" ? "Corrected" : "Dismissed"}</Chip>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {f.location ? `${f.location} · ` : ""}recorded {usDate(f.created_at)}
                </p>
                {f.detail && <p className="text-muted-foreground">{f.detail}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {task && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenTask?.(task.id)}
                      disabled={!onOpenTask}
                    >
                      Correction task{task.due_on ? ` · due ${usDate(task.due_on)}` : ""}
                    </Button>
                  )}
                  {canEdit && f.status === "open" && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          statusMutation.mutate({ findingId: f.id, status: "corrected" })
                        }
                      >
                        Mark corrected
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          statusMutation.mutate({ findingId: f.id, status: "dismissed" })
                        }
                      >
                        Dismiss
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
