import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Plus, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";
import {
  getOnboardingWorkspace,
  requestHandoffFn,
  reviewHandoffFn,
  saveOnboardingTaskFn,
  setPropertyLifecycleFn,
} from "@/lib/onboarding.functions";
import {
  LIFECYCLE,
  ONBOARDING_STAGES,
  isOverdue,
  lifecycleMeta,
  stageLabel,
  validateHandoff,
} from "@/lib/onboarding";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Onboarding workspace — Resolve" },
      {
        name: "description",
        content:
          "Track every home from intake to accepted handoff: stage tasks, blockers, owner approvals and the readiness checklist that gates active operations.",
      },
      { property: "og:title", content: "Onboarding workspace — Resolve" },
      {
        property: "og:description",
        content: "Pre-handoff work, readiness gates and supervisor review for new homes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="onboarding_workspace" title="Onboarding workspace">
      <OnboardingWorkspace />
    </RequireCapability>
  ),
  errorComponent: () => <p className="text-muted-foreground">The workspace could not be loaded.</p>,
});

function OnboardingWorkspace() {
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const { can, readOnly } = useRole();
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-workspace"],
    queryFn: () => load(),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });

  const saveTask = useMutation({
    mutationFn: useServerFn(saveOnboardingTaskFn),
    onSuccess: () => { toast.success("Task saved."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const setLifecycle = useMutation({
    mutationFn: useServerFn(setPropertyLifecycleFn),
    onSuccess: () => { toast.success("Lifecycle updated."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const requestHandoff = useMutation({
    mutationFn: useServerFn(requestHandoffFn),
    onSuccess: () => { toast.success("Handoff requested. A supervisor will review it."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reviewHandoff = useMutation({
    mutationFn: useServerFn(reviewHandoffFn),
    onSuccess: () => { toast.success("Review recorded."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const pipeline = useMemo(() => {
    if (!data) return [];
    return data.properties.filter((p) => data.pipeline.includes(p.id));
  }, [data]);

  const current = useMemo(() => {
    if (!data) return null;
    const id = selected ?? pipeline[0]?.id ?? data.properties[0]?.id ?? null;
    return data.properties.find((p) => p.id === id) ?? null;
  }, [data, selected, pipeline]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const tasks = current ? data.tasks.filter((t) => t.property_id === current.id) : [];
  const readiness = current ? validateHandoff(current, tasks) : null;
  const openHandoff = current
    ? data.handoffs.find((h) => h.property_id === current.id && h.status === "requested")
    : undefined;
  const pendingReviews = data.handoffs.filter((h) => h.status === "requested");

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Onboarding</p>
        <h1 className="font-display text-3xl font-semibold">Onboarding workspace</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Homes stay on their existing Property ID from day one. Pre-handoff work lives here and never
          mixes with operational matters. A home only becomes an active operation when a supervisor
          accepts the handoff.
        </p>
      </header>

      {can("handoff_review") && pendingReviews.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-base">Handoffs waiting on your review</CardTitle>
            <CardDescription>{pendingReviews.length} request(s) pending.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingReviews.map((h) => {
              const prop = data.properties.find((p) => p.id === h.property_id);
              return (
                <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3">
                  <div>
                    <p className="font-medium">{prop?.name ?? "Property"}</p>
                    <p className="text-xs text-muted-foreground">
                      Requested {new Date(h.requested_at as string).toLocaleString()}
                      {h.carryover_accepted ? " · carryover accepted" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={readOnly}
                      onClick={() => reviewHandoff.mutate({ data: { handoffId: h.id, decision: "accepted", corrections: "" } })}>
                      Accept
                    </Button>
                    <ReturnHandoffDialog
                      disabled={readOnly}
                      onReturn={(corrections) =>
                        reviewHandoff.mutate({ data: { handoffId: h.id, decision: "returned", corrections } })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Pipeline</CardTitle>
            <CardDescription>{pipeline.length} home(s) pre-handoff</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.properties.map((p) => {
              const meta = lifecycleMeta(p.lifecycle_status);
              return (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${current?.id === p.id ? "bg-muted" : ""}`}
                >
                  <span className="block font-medium">{p.name}</span>
                  <Badge variant="outline" className={`mt-1 ${meta.tone}`}>{meta.label}</Badge>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {current && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-xl">{current.name}</CardTitle>
                <CardDescription>
                  Property ID {current.id.slice(0, 8)} · stage {stageLabel(current.onboarding_stage)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Lifecycle</Label>
                  <Select
                    value={current.lifecycle_status ?? "active_operations"}
                    onValueChange={(v) =>
                      setLifecycle.mutate({
                        data: { propertyId: current.id, status: v as never, reason: "Changed from the onboarding workspace" },
                      })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LIFECYCLE.map((l) => (
                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Stage</Label>
                  <Select
                    value={current.onboarding_stage ?? "intake"}
                    onValueChange={(v) =>
                      setLifecycle.mutate({
                        data: {
                          propertyId: current.id,
                          status: (current.lifecycle_status ?? "onboarding") as never,
                          stage: v,
                          reason: "Stage advanced in the onboarding workspace",
                        },
                      })
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ONBOARDING_STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <TaskDialog
                  propertyId={current.id}
                  people={data.people}
                  disabled={readOnly || !can("handoff_request")}
                  onSave={(values) => saveTask.mutate({ data: values })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Readiness checklist</CardTitle>
                <CardDescription>
                  Blocking items must pass before a handoff can be requested.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {readiness?.checks.map((c) => (
                  <div key={c.key} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                    {c.passed ? (
                      <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                    ) : c.blocking ? (
                      <XCircle className="mt-0.5 size-4 text-destructive" />
                    ) : (
                      <CircleAlert className="mt-0.5 size-4 text-amber-600" />
                    )}
                    <div>
                      <p className="font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  {openHandoff ? (
                    <Badge variant="outline" className="bg-amber-100 text-amber-900">
                      Handoff requested — awaiting supervisor review
                    </Badge>
                  ) : (
                    <RequestHandoffDialog
                      ready={Boolean(readiness?.ready)}
                      disabled={readOnly || !can("handoff_request")}
                      onRequest={(notes, carryoverAccepted) =>
                        requestHandoff.mutate({ data: { propertyId: current.id, notes, carryoverAccepted } })
                      }
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Onboarding tasks</CardTitle>
                <CardDescription>Pre-handoff work only — separate from operational matters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.length === 0 && (
                  <p className="text-sm text-muted-foreground">No onboarding tasks yet for this home.</p>
                )}
                {tasks.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {stageLabel(t.stage)}
                        {t.due_on ? ` · due ${t.due_on}` : ""}
                        {t.blocks_handoff ? " · blocks handoff" : ""}
                      </p>
                      {t.blocker && <p className="text-xs text-destructive">Blocker: {t.blocker}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverdue(t) && <Badge variant="outline" className="bg-destructive/10 text-destructive">Overdue</Badge>}
                      <Badge variant="outline">{t.status}</Badge>
                      {t.status !== "complete" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={readOnly}
                          onClick={() =>
                            saveTask.mutate({
                              data: {
                                id: t.id,
                                propertyId: t.property_id,
                                stage: t.stage,
                                title: t.title,
                                detail: t.detail ?? "",
                                assignedTo: t.assigned_to,
                                dueOn: t.due_on,
                                blocker: "",
                                requiresOwnerApproval: t.requires_owner_approval,
                                ownerApprovalStatus: (t.owner_approval_status ?? "pending") as never,
                                evidenceRequired: t.evidence_required,
                                evidenceNote: t.evidence_note ?? "",
                                status: "complete",
                                blocksHandoff: t.blocks_handoff,
                              },
                            })
                          }
                        >
                          Mark complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDialog({
  propertyId,
  people,
  disabled,
  onSave,
}: {
  propertyId: string;
  people: { id: string; full_name: string | null; email: string | null }[];
  disabled: boolean;
  onSave: (values: {
    propertyId: string;
    stage: string;
    title: string;
    detail: string;
    assignedTo: string | null;
    dueOn: string | null;
    blocker: string;
    requiresOwnerApproval: boolean;
    ownerApprovalStatus: "not_required" | "pending" | "approved" | "declined";
    evidenceRequired: boolean;
    evidenceNote: string;
    status: "open" | "blocked" | "complete" | "carryover";
    blocksHandoff: boolean;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<string>("intake");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("unassigned");
  const [dueOn, setDueOn] = useState("");
  const [requiresOwnerApproval, setRequiresOwnerApproval] = useState(false);
  const [evidenceRequired, setEvidenceRequired] = useState(false);
  const [blocksHandoff, setBlocksHandoff] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}><Plus className="size-4" /> Add task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New onboarding task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ONBOARDING_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Task</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Collect gate codes and lockbox details" />
          </div>
          <div className="space-y-1">
            <Label>Detail</Label>
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Owner</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || "Teammate"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Due date</Label>
              <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={requiresOwnerApproval} onCheckedChange={(v) => setRequiresOwnerApproval(Boolean(v))} />
            Requires a homeowner approval
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={evidenceRequired} onCheckedChange={(v) => setEvidenceRequired(Boolean(v))} />
            Requires evidence before it counts as complete
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={blocksHandoff} onCheckedChange={(v) => setBlocksHandoff(Boolean(v))} />
            Blocks handoff while open
          </label>
          <Button
            className="w-full"
            disabled={title.trim().length < 3}
            onClick={() => {
              onSave({
                propertyId,
                stage,
                title: title.trim(),
                detail: detail.trim(),
                assignedTo: assignedTo === "unassigned" ? null : assignedTo,
                dueOn: dueOn || null,
                blocker: "",
                requiresOwnerApproval,
                ownerApprovalStatus: requiresOwnerApproval ? "pending" : "not_required",
                evidenceRequired,
                evidenceNote: "",
                status: "open",
                blocksHandoff,
              });
              setOpen(false);
              setTitle("");
              setDetail("");
            }}
          >
            Save task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestHandoffDialog({
  ready,
  disabled,
  onRequest,
}: {
  ready: boolean;
  disabled: boolean;
  onRequest: (notes: string, carryoverAccepted: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [carryover, setCarryover] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>Request handoff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request handoff to operations</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {ready
              ? "All blocking checks pass. Operations will review and accept or return this home."
              : "Blocking checks are failing. You can still request the handoff if every open item is accepted as carryover work with an owner, a due date and a reason."}
          </p>
          <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything operations should know before accepting." />
          {!ready && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={carryover} onCheckedChange={(v) => setCarryover(Boolean(v))} />
              Accept open items as carryover work
            </label>
          )}
          <Button className="w-full" onClick={() => { onRequest(notes.trim(), carryover); setOpen(false); }}>
            Send request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReturnHandoffDialog({ disabled, onReturn }: { disabled: boolean; onReturn: (corrections: string) => void }) {
  const [open, setOpen] = useState(false);
  const [corrections, setCorrections] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>Return</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Return with corrections</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Textarea rows={4} value={corrections} onChange={(e) => setCorrections(e.target.value)} placeholder="What must be corrected before this home can be accepted?" />
          <Button className="w-full" disabled={corrections.trim().length < 3} onClick={() => { onReturn(corrections.trim()); setOpen(false); }}>
            Return to onboarding
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
