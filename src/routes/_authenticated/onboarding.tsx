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
import { BreezewayTaskPanel } from "@/components/BreezewayTaskPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequireCapability } from "@/components/RequireCapability";
import { SchedulePanel } from "@/components/SchedulePanel";
import { useRole } from "@/hooks/useRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFeatureFlags } from "@/lib/feature-flags";
import { HandoffGatePanel } from "@/components/onboarding/HandoffGatePanel";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { OnboardingNotes } from "@/components/onboarding/OnboardingNotes";
import { ExternalRecordsPanel } from "@/components/onboarding/ExternalRecordsPanel";
import { TemplatePanel } from "@/components/onboarding/TemplatePanel";
import { SEAT_LABELS, type SeatCode } from "@/lib/onboarding-ownership";
import { OperationsContextPanel } from "@/components/onboarding/OperationsContextPanel";
import {
  addOnboardingNoteFn,
  getOnboardingWorkspace,
  recordTaskExceptionFn,
  resolveExternalRecordFn,
  requestHandoffFn,
  reviewHandoffFn,
  saveOnboardingTaskFn,
  setPropertyLifecycleFn,
  submitOwnerApprovalFn,
  confirmApprovalRequirementFn,
} from "@/lib/onboarding.functions";
import {
  LIFECYCLE,
  ONBOARDING_STAGES,
  dependencyBlocked,
  gateLabel,
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
  const { can, readOnly, userId } = useRole();
  const { enabled } = useFeatureFlags();
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
    onSuccess: () => { toast.success("Handoff requested. The review gate starts with the Director of Onboarding."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reviewHandoff = useMutation({
    mutationFn: useServerFn(reviewHandoffFn),
    onSuccess: () => { toast.success("Decision recorded."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const addNote = useMutation({
    mutationFn: useServerFn(addOnboardingNoteFn),
    onSuccess: () => { toast.success("Note added."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const recordException = useMutation({
    mutationFn: useServerFn(recordTaskExceptionFn),
    onSuccess: () => { toast.success("Exception recorded."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const submitApproval = useMutation({
    mutationFn: useServerFn(submitOwnerApprovalFn),
    onSuccess: () => { toast.success("Sent to the homeowner for approval."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirmRequirement = useMutation({
    mutationFn: useServerFn(confirmApprovalRequirementFn),
    onSuccess: () => { toast.success("Requirement updated."); void refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolveRecord = useMutation({
    mutationFn: useServerFn(resolveExternalRecordFn),
    onSuccess: () => { toast.success("Record updated."); void refresh(); },
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
    ? data.handoffs.find((h) => h.property_id === current.id && (h.status === "requested" || h.status === "accepted_pending_live"))
    : undefined;
  const pendingReviews = data.handoffs.filter((h) => h.status === "requested" || h.status === "accepted_pending_live");
  const notes = current ? data.notes.filter((n) => n.property_id === current.id) : [];
  const docsEnabled = enabled("onboarding_sharepoint_docs");
  const activeOwnerIds = new Set((data.activeOwnerProperties ?? []).map((l) => l.propertyId));
  const activeOwner = current ? (data.activeOwnerProperties ?? []).find((l) => l.propertyId === current.id) : undefined;
  const mismatches = current
    ? (data.approvalMismatches ?? []).filter((m) => m.propertyId === current.id)
    : [];

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Onboarding</p>
        <h1 className="font-display text-3xl font-semibold">Onboarding workspace</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Homes stay on their existing Property ID from day one. Pre-handoff work lives here and never
          mixes with operational tickets. A home only becomes an active operation after the two documented
          reviews and an Operations acceptance.
        </p>
      </header>

      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="reviews">Handoff gate ({pendingReviews.length})</TabsTrigger>
          <TabsTrigger value="records">Source records</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-4">
          {pendingReviews.length === 0 && (
            <p className="text-sm text-muted-foreground">No handoff is waiting at a review gate.</p>
          )}
          {pendingReviews.map((h) => (
            <HandoffGatePanel
              key={h.id}
              handoff={h as never}
              reviews={data.reviews as never}
              people={data.people}
              propertyName={data.properties.find((p) => p.id === h.property_id)?.name ?? "Property"}
              canReview={
                can("handoff_review") ||
                // Mirrors the server rule: the assigned onboarding lead may
                // record only its own onboarding review, never a later gate.
                (Boolean(userId) &&
                  (h.gate_step ?? "kati_review") === "kati_review" &&
                  data.properties.find((p) => p.id === h.property_id)?.onboarding_owner === userId)
              }
              disabled={readOnly}
              onDecision={(input) => reviewHandoff.mutate({ data: { handoffId: h.id, ...input } })}
            />
          ))}
        </TabsContent>

        <TabsContent value="records">
          <ExternalRecordsPanel
            databases={data.externalDatabases as never}
            records={data.externalRecords as never}
            properties={data.properties}
            syncConfigured={enabled("onboarding_external_sync")}
            disabled={readOnly || !can("handoff_request")}
            onResolve={(input) => resolveRecord.mutate({ data: input })}
          />
        </TabsContent>

        <TabsContent value="pipeline">
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
                      {activeOwnerIds.has(p.id) && (
                        <Badge variant="outline" className="ml-1 mt-1 border-primary/40 text-primary">
                          Active Owner Program
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {current && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 font-display text-xl">
                      {current.name}
                      {activeOwner && (
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          Active Owner Program
                        </Badge>
                      )}
                    </CardTitle>
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
                      tasks={tasks}
                      disabled={readOnly || !can("handoff_request")}
                      onSave={(values) => saveTask.mutate({ data: values })}
                    />
                  </CardContent>
                </Card>

                <SchedulePanel
                  propertyId={current.id}
                  plannedClosingOn={(current as { planned_closing_on?: string | null }).planned_closing_on ?? null}
                  actualClosingOn={(current as { actual_closing_on?: string | null }).actual_closing_on ?? null}
                  actualAccessOn={(current as { actual_access_on?: string | null }).actual_access_on ?? null}
                  canEdit={!readOnly && can("handoff_request")}
                  onChange={() => void refresh()}
                />

                <TemplatePanel
                  propertyId={current.id}
                  propertyName={current.name}
                  readOnly={readOnly || !can("handoff_request")}
                />



                {mismatches.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Participation change — confirm affected steps</CardTitle>
                      <CardDescription>
                        This home&apos;s Active Owner Program enrollment changed after these steps were created.
                        Nothing is applied automatically; completed decisions and history are preserved.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {mismatches.map((m) => (
                        <div key={m.taskId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
                          <div>
                            <p className="font-medium">{m.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.shouldRequire
                                ? "Enrolled now — this step should require the homeowner's approval."
                                : "No longer enrolled — this step no longer needs a homeowner approval."}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={readOnly || !can("handoff_request")}
                            onClick={() =>
                              confirmRequirement.mutate({
                                data: {
                                  taskId: m.taskId,
                                  requiresOwnerApproval: m.shouldRequire,
                                  reason: "Confirmed after an Active Owner Program participation change",
                                },
                              })
                            }
                          >
                            {m.shouldRequire ? "Require owner approval" : "Remove approval requirement"}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <OwnerDecisionsCard
                  approvals={(data.ownerApprovals ?? []).filter((a) => a.property_id === current.id)}
                />

                {openHandoff && (
                  <HandoffGatePanel
                    handoff={openHandoff as never}
                    reviews={data.reviews as never}
                    people={data.people}
                    propertyName={current.name}
                    canReview={
                      can("handoff_review") ||
                      (Boolean(userId) &&
                        (openHandoff.gate_step ?? "kati_review") === "kati_review" &&
                        current.onboarding_owner === userId)
                    }
                    disabled={readOnly}
                    onDecision={(input) =>
                      reviewHandoff.mutate({ data: { handoffId: openHandoff.id, ...input } })
                    }
                  />
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Readiness checklist</CardTitle>
                    <CardDescription>
                      Blocking items must pass, or an authorised exception must be recorded, before handoff.
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
                          Handoff in review — {gateLabel(openHandoff.gate_step)}
                        </Badge>
                      ) : (
                        <RequestHandoffDialog
                          ready={Boolean(readiness?.ready)}
                          disabled={readOnly || !can("handoff_request")}
                          onRequest={(notes2, carryoverAccepted) =>
                            requestHandoff.mutate({ data: { propertyId: current.id, notes: notes2, carryoverAccepted } })
                          }
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Onboarding tasks</CardTitle>
                    <CardDescription>Pre-handoff work only — separate from operational tickets.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {tasks.length === 0 && (
                      <p className="text-sm text-muted-foreground">No onboarding tasks yet for this home.</p>
                    )}
                    {tasks.map((t) => {
                      const waiting = dependencyBlocked(t as never, tasks);
                      return (
                        <div key={t.id} className={`flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 ${t.parent_task_id ? "ml-6" : ""}`}>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {stageLabel(t.stage)}
                              {t.due_on ? ` · due ${t.due_on}` : ""}
                              {t.blocks_handoff ? " · blocks handoff" : ""}
                              {t.parent_task_id ? " · subtask" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Owner:{" "}
                              {t.assigned_to
                                ? (data.people.find((p) => p.id === t.assigned_to)?.full_name ??
                                   data.people.find((p) => p.id === t.assigned_to)?.email ??
                                   "Teammate")
                                : t.assigned_seat
                                  ? `Unstaffed — ${SEAT_LABELS[t.assigned_seat as SeatCode] ?? t.assigned_seat}`
                                  : "Unassigned"}
                              {t.assigned_to && t.assigned_seat
                                ? ` · ${SEAT_LABELS[t.assigned_seat as SeatCode] ?? t.assigned_seat}`
                                : ""}
                            </p>
                            {t.blocker && <p className="text-xs text-destructive">Blocker: {t.blocker}</p>}
                            {waiting.length > 0 && (
                              <p className="text-xs text-amber-700">
                                Waiting on {waiting.length} prerequisite task(s) — owner{" "}
                                {data.people.find((p) => p.id === t.assigned_to)?.full_name ?? "unassigned"}.
                              </p>
                            )}
                            {t.exception_reason && (
                              <p className="text-xs text-amber-700">Exception: {t.exception_reason}</p>
                            )}
                            {t.evidence_required && (
                              <p className="text-xs text-muted-foreground">
                                {t.evidence_note
                                  ? `Evidence: ${t.evidence_note}`
                                  : "Evidence required — none recorded yet."}
                              </p>
                            )}
                            {t.requires_owner_approval && (
                              <p className="text-xs text-muted-foreground">
                                {t.owner_approval_status === "approved"
                                  ? "Homeowner approved."
                                  : t.owner_approval_status === "awaiting_owner"
                                    ? "Awaiting owner approval — sending alone does not complete this step."
                                    : t.owner_approval_status === "changes_requested"
                                      ? "Homeowner requested changes — revise and resubmit."
                                      : "Homeowner approval required."}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isOverdue(t) && <Badge variant="outline" className="bg-destructive/10 text-destructive">Overdue</Badge>}
                            <Badge variant="outline">{t.status}</Badge>
                            {can("handoff_review") && !t.exception_reason && (
                              <ExceptionDialog
                                disabled={readOnly}
                                onRecord={(reason) => recordException.mutate({ data: { taskId: t.id, reason } })}
                              />
                            )}
                            {t.requires_owner_approval && t.owner_approval_status !== "approved" && (
                              <ApprovalSubmitDialog
                                disabled={readOnly || !can("handoff_request")}
                                resubmission={t.owner_approval_status === "changes_requested"}
                                onSubmit={(version, note) =>
                                  submitApproval.mutate({ data: { taskId: t.id, version, note } })
                                }
                              />
                            )}
                            {(
                               <EvidenceDialog
                                 disabled={readOnly}
                                 evidenceRequired={t.evidence_required}
                                 taskId={t.id}
                                 current={t.evidence_note ?? ""}
                                onSave={(note) =>
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
                                      evidenceNote: note,
                                      status: t.status as never,
                                      blocksHandoff: t.blocks_handoff,
                                      parentTaskId: t.parent_task_id,
                                      dependsOn: t.depends_on ?? [],
                                      linkedTicketId: t.linked_ticket_id,
                                    },
                                  })
                                }
                              />
                            )}
                            {t.status !== "complete" && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  readOnly ||
                                  waiting.length > 0 ||
                                  // Evidence-required work cannot be closed on a promise.
                                  (t.evidence_required && !(t.evidence_note ?? "").trim())
                                }
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
                                      parentTaskId: t.parent_task_id,
                                      dependsOn: t.depends_on ?? [],
                                      linkedTicketId: t.linked_ticket_id,
                                    },
                                  })
                                }
                              >
                                Mark complete
                              </Button>
                            )}
                          </div>
                          {/* Renders nothing unless this task's property is the approved Breezeway pilot home. */}
                          <div className="w-full">
                            <BreezewayTaskPanel
                              sourceType="onboarding_task"
                              sourceId={t.id}
                              defaultTitle={t.title}
                              defaultDescription={t.detail ?? null}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <OperationsContextPanel
                  property={current as never}
                  tasks={tasks as never}
                  records={data.externalRecords as never}
                  documents={data.documents as never}
                  documentsEnabled={docsEnabled}
                />

                <OnboardingNotes
                  notes={notes as never}
                  people={data.people}
                  disabled={readOnly || !can("handoff_request")}
                  onAdd={(body, mentions) =>
                    addNote.mutate({ data: { propertyId: current.id, taskId: null, body, mentions } })
                  }
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Records what proves an evidence-required onboarding task was actually done. */
/** Read-only view of homeowner decisions for staff. */
function OwnerDecisionsCard({
  approvals,
}: {
  approvals: {
    id: string;
    title: string;
    status: string;
    decision_note: string | null;
    decided_at: string | null;
    created_at: string;
  }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Homeowner decisions</CardTitle>
        <CardDescription>Approval requests sent to the homeowner and the decisions they recorded.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {approvals.length === 0 && (
          <p className="text-sm text-muted-foreground">No homeowner approval has been requested for this home.</p>
        )}
        {approvals.map((a) => (
          <div key={a.id} className="rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={a.status === "pending" ? "outline" : a.status === "approved" ? "default" : "secondary"}>
                {a.status === "pending" ? "Waiting on homeowner" : a.status === "approved" ? "Approved" : "Sent back"}
              </Badge>
              <span className="font-medium">{a.title}</span>
              <span className="text-xs text-muted-foreground">
                {a.decided_at ? new Date(a.decided_at).toLocaleString() : `Requested ${new Date(a.created_at).toLocaleDateString()}`}
              </span>
            </div>
            {a.decision_note && <p className="mt-1 text-muted-foreground">{a.decision_note}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ApprovalSubmitDialog({
  disabled,
  resubmission,
  onSubmit,
}: {
  disabled: boolean;
  resubmission: boolean;
  onSubmit: (version: string, note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [note, setNote] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) { setVersion(""); setNote(""); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={disabled}>
          {resubmission ? "Resubmit for approval" : "Send for owner approval"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{resubmission ? "Resubmit to the homeowner" : "Send to the homeowner"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Version being reviewed</Label>
            <Input
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Mood boards v2 — 12 Aug"
            />
          </div>
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What changed, or what the homeowner is being asked to approve."
          />
          <p className="text-xs text-muted-foreground">
            The homeowner&apos;s name, the time, their comments and this version are recorded with the decision.
            Sending alone does not complete the step.
          </p>
          <Button
            className="w-full"
            disabled={version.trim().length < 2}
            onClick={() => { onSubmit(version.trim(), note.trim()); setOpen(false); }}
          >
            {resubmission ? "Resubmit" : "Send for approval"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceDialog({
  disabled,
  current,
  taskId,
  onSave,
}: {
  disabled: boolean;
  current: string;
  taskId: string;
  onSave: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(current);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setNote(current);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={disabled}>
          {current ? "Update evidence" : "Add evidence"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Evidence for this task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What proves this is done — photo location, document name, meter reading, confirmation number."
          />
          <Button
            className="w-full"
            disabled={note.trim().length < 3}
            onClick={() => { onSave(note.trim()); setOpen(false); }}
          >
            Save evidence
          </Button>
          {open ? (
            <AttachmentsPanel entityType="onboarding_task" entityId={taskId} title="Photos & documents" />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ExceptionDialog({ disabled, onRecord }: { disabled: boolean; onRecord: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={disabled}>Record exception</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Authorised exception</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this requirement being waived, and who approved it?" />
          <Button className="w-full" disabled={reason.trim().length < 3} onClick={() => { onRecord(reason.trim()); setOpen(false); setReason(""); }}>
            Record exception
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({
  propertyId,
  people,
  tasks,
  disabled,
  onSave,
}: {
  propertyId: string;
  people: { id: string; full_name: string | null; email: string | null }[];
  tasks: { id: string; title: string }[];
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
    parentTaskId?: string | null;
    dependsOn?: string[];
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
  const [parentTaskId, setParentTaskId] = useState("none");
  const [dependsOn, setDependsOn] = useState("none");

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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Parent task (optional)</Label>
              <Select value={parentTaskId} onValueChange={setParentTaskId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Top-level task</SelectItem>
                  {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Depends on (optional)</Label>
              <Select value={dependsOn} onValueChange={setDependsOn}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No dependency</SelectItem>
                  {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
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
                parentTaskId: parentTaskId === "none" ? null : parentTaskId,
                dependsOn: dependsOn === "none" ? [] : [dependsOn],
              });
              setOpen(false);
              // Every field resets: a saved task must never leak its stage,
              // owner, dates, parent, dependency or flags into the next one.
              setStage("intake");
              setTitle("");
              setDetail("");
              setAssignedTo("unassigned");
              setDueOn("");
              setRequiresOwnerApproval(false);
              setEvidenceRequired(false);
              setBlocksHandoff(true);
              setParentTaskId("none");
              setDependsOn("none");
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
