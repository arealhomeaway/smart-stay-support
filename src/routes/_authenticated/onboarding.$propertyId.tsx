import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ChevronLeft, CircleAlert, Plus, XCircle } from "lucide-react";
import {
  Chip,
  EmptyState,
  LoadingPage,
  PageHeader,
  ProgressRing,
  StageRail,
} from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SchedulePanel } from "@/components/SchedulePanel";
import { TemplatePanel } from "@/components/onboarding/TemplatePanel";
import { HandoffGatePanel } from "@/components/onboarding/HandoffGatePanel";
import { OnboardingNotes } from "@/components/onboarding/OnboardingNotes";
import { OperationsContextPanel } from "@/components/onboarding/OperationsContextPanel";
import { ProjectScopePanel } from "@/components/onboarding/ProjectScopePanel";
import { FinancialPanel } from "@/components/onboarding/FinancialPanel";
import { PropertyFactsPanel } from "@/components/onboarding/PropertyFactsPanel";
import { projectScope, scopeSummary, splitByScope } from "@/lib/onboarding-scope";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { WorkflowTable } from "@/components/onboarding/WorkflowTable";
import { CurrentWork } from "@/components/onboarding/CurrentWork";
import {
  deriveBlockers,
  deriveNextAction,
  deriveRisk,
  deriveStage,
  lifecycleStageMeta,
  targetHandoff,
  type OpenHandoff,
  type ProjectProperty,
} from "@/lib/onboarding-lifecycle";
import { TaskDrawer, type SaveTaskInput } from "@/components/onboarding/TaskDrawer";
import { useRole } from "@/hooks/useRole";
import { useFeatureFlags } from "@/lib/feature-flags";
import { stateChip } from "@/lib/semantic";
import {
  LIFECYCLE,
  ONBOARDING_STAGES,
  gateLabel,
  lifecycleMeta,
  stageLabel,
  validateHandoff,
} from "@/lib/onboarding";
import {
  STATUS_LABEL,
  STATUS_STATE,
  assigneeLabel,
  buildSections,
  rollupProperty,
  viewTask,
  type WorkflowTask,
} from "@/lib/onboarding-workflow";
import {
  addOnboardingNoteFn,
  confirmApprovalRequirementFn,
  getOnboardingWorkspace,
  recordTaskExceptionFn,
  reopenOnboardingTaskFn,
  requestHandoffFn,
  reviewHandoffFn,
  saveOnboardingTaskFn,
  setPropertyLifecycleFn,
  submitOwnerApprovalFn,
  recordOwnerTaskDecisionFn,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/$propertyId")({
  head: () => ({
    meta: [
      { title: "Property onboarding workflow — Resolve" },
      {
        name: "description",
        content:
          "One home's onboarding workflow: sectioned tasks with assignee, due date and status, plus the automation behind every release, date and evidence gate.",
      },
      { property: "og:title", content: "Property onboarding workflow — Resolve" },
      {
        property: "og:description",
        content: "Sectioned onboarding tasks, task detail and the handoff gate for a single home.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropertyWorkspace,
  errorComponent: () => <p className="text-muted-foreground">This home could not be loaded.</p>,
});

function PropertyWorkspace() {
  const { propertyId } = Route.useParams();
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const { can, readOnly, userId, roles } = useRole();
  const { enabled } = useFeatureFlags();
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-workspace"],
    queryFn: () => load(),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });

  const mut = <T,>(fn: T, message: string) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({
      mutationFn: fn as never,
      onSuccess: () => {
        toast.success(message);
        void refresh();
      },
      onError: (e: Error) => toast.error(e.message),
    });

  const saveTask = mut(useServerFn(saveOnboardingTaskFn), "Task saved.");
  const setLifecycle = mut(useServerFn(setPropertyLifecycleFn), "Lifecycle updated.");
  const requestHandoff = mut(useServerFn(requestHandoffFn), "Handoff requested.");
  const reviewHandoff = mut(useServerFn(reviewHandoffFn), "Decision recorded.");
  const addNote = mut(useServerFn(addOnboardingNoteFn), "Note added.");
  const recordException = mut(useServerFn(recordTaskExceptionFn), "Exception recorded.");
  const reopenTask = mut(useServerFn(reopenOnboardingTaskFn), "Task reopened.");
  const submitApproval = mut(
    useServerFn(submitOwnerApprovalFn),
    "Sent to the homeowner for approval.",
  );
  const recordOwnerDecision = mut(
    useServerFn(recordOwnerTaskDecisionFn),
    "Homeowner's answer recorded.",
  );
  const confirmRequirement = mut(useServerFn(confirmApprovalRequirementFn), "Requirement updated.");


  const current = data?.properties.find((p) => p.id === propertyId) ?? null;
  const allTasks = useMemo(
    () =>
      (data?.tasks ?? []).filter((t) => t.property_id === propertyId) as unknown as WorkflowTask[],
    [data, propertyId],
  );
  const scope = useMemo(
    () =>
      projectScope(
        (data?.projects ?? []).find(
          (p) => p.property_id === propertyId && p.status !== "cancelled",
        ) ?? null,
      ),
    [data, propertyId],
  );
  // Scope decides what this home is asked for. Out-of-scope work is listed
  // separately and never counts as missing.
  const { inScope: tasks, outOfScope } = useMemo(
    () => splitByScope(allTasks, scope),
    [allTasks, scope],
  );

  if (isLoading || !data) return <LoadingPage />;
  if (!current)
    return (
      <EmptyState title="Home not found" hint="This property is not in the onboarding workspace." />
    );

  const roll = rollupProperty(tasks);
  const sections = buildSections(tasks);
  const readiness = validateHandoff(current, tasks as never, {
    includeQuarterlyReview: enabled("quarterly_reviews"),
  });
  const openHandoff = data.handoffs.find(
    (h) =>
      h.property_id === current.id &&
      (h.status === "requested" || h.status === "accepted_pending_live"),
  );
  const notes = data.notes.filter((n) => n.property_id === current.id);
  const approvals = (data.ownerApprovals ?? []).filter((a) => a.property_id === current.id);
  const mismatches = (data.approvalMismatches ?? []).filter((m) => m.propertyId === current.id);
  const activeOwner = (data.activeOwnerProperties ?? []).find((l) => l.propertyId === current.id);
  const docsEnabled = enabled("onboarding_sharepoint_docs");
  const pm = data.people.find((p) => p.id === current.onboarding_owner);
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const canEdit = !readOnly && can("handoff_request");

  const project = {
    property: current as unknown as ProjectProperty,
    tasks,
    handoff: (openHandoff ?? null) as OpenHandoff,
  };
  const stage = deriveStage(project);
  const nextAction = deriveNextAction(project);
  const risk = deriveRisk(project);
  const blockers = deriveBlockers(project);
  const target = targetHandoff(project);

  return (
    <div className="space-y-5">
      <Link
        to="/onboarding"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> Director hub
      </Link>

      <PageHeader
        eyebrow="Onboarding"
        title={current.name}
        description={`${lifecycleStageMeta(stage).label} · ${roll.done}/${roll.total} standard workflow steps complete`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Chip className={stateChip("info")}>{lifecycleMeta(current.lifecycle_status).label}</Chip>
        {activeOwner && <Chip className={stateChip("waiting")}>Active Owner Program</Chip>}
        {pm && <Chip className={stateChip("info")}>{pm.full_name ?? pm.email}</Chip>}
        {openHandoff && (
          <Chip className={stateChip("waiting")}>Handoff — {gateLabel(openHandoff.gate_step)}</Chip>
        )}
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link
            to="/tickets/new"
            search={{ property: current.id, project: current.id, from: "onboarding" }}
          >
            Report an issue
          </Link>
        </Button>
      </div>

      <CurrentWork
        stage={stage}
        next={nextAction}
        risk={risk}
        blockers={blockers}
        tasks={tasks}
        handoff={(openHandoff ?? null) as OpenHandoff}
        accepted={Boolean(current.handoff_accepted_at)}
        target={target}
        onOpenTask={setOpenTaskId}
      />

      <Tabs defaultValue="workflow" className="space-y-5">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workflow">Work</TabsTrigger>
          <TabsTrigger value="property">Property</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="handoff">Handoff</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="activity">History</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------- Overview */}
        <TabsContent value="overview" className="space-y-5">
          <ProjectScopePanel
            propertyId={current.id}
            propertyName={current.name}
            people={data.people}
            canEdit={canEdit}
            hints={{ planned_closing_on: current.planned_closing_on ?? null }}
          />

          <div className="surface p-4">
            <StageRail
              tone="onboarding"
              stages={ONBOARDING_STAGES.map((s) => {
                const inStage = tasks.filter((t) => t.stage === s.value);
                return {
                  key: s.value,
                  label: s.label,
                  ...(inStage.length > 0
                    ? {
                        hint: `${inStage.filter((t) => t.status === "complete").length}/${inStage.length} done`,
                      }
                    : {}),
                };
              })}
              currentIndex={Math.max(
                0,
                ONBOARDING_STAGES.findIndex(
                  (s) => s.value === (current.onboarding_stage ?? "post_contract"),
                ),
              )}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Summary label="Overall progress">
              <div className="flex items-center gap-3">
                <ProgressRing value={roll.progress} />
                <span className="text-sm text-muted-foreground">
                  {roll.done} of {roll.total} tasks
                </span>
              </div>
            </Summary>
            <Summary label="Project manager">{pm?.full_name ?? pm?.email ?? "Unassigned"}</Summary>
            <Summary label="Next milestone">{roll.nextMilestone ?? "—"}</Summary>
            <Summary label="Primary blocker">{roll.primaryBlocker ?? "None"}</Summary>
            <Summary label="Program">{activeOwner ? "Active Owner Program" : "Standard"}</Summary>
            <Summary label="Open owner decisions">
              {String(approvals.filter((a) => a.status === "pending").length)}
            </Summary>
            <Summary label="Carryover items">{String(roll.carryover)}</Summary>
            <Summary label="Handoff accepted">
              {current.handoff_accepted_at?.slice(0, 10) ?? "Not yet"}
            </Summary>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="eyebrow">Lifecycle</Label>
              <Select
                value={current.lifecycle_status ?? "onboarding"}
                onValueChange={(v) =>
                  setLifecycle.mutate({
                    data: {
                      propertyId: current.id,
                      status: v as never,
                      reason: "Changed from the onboarding workspace",
                    },
                  } as never)
                }
                disabled={readOnly}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="eyebrow">Stage</Label>
              <Select
                value={current.onboarding_stage ?? "post_contract"}
                onValueChange={(v) =>
                  setLifecycle.mutate({
                    data: {
                      propertyId: current.id,
                      status: (current.lifecycle_status ?? "onboarding") as never,
                      stage: v,
                      reason: "Stage advanced in the onboarding workspace",
                    },
                  } as never)
                }
                disabled={readOnly}
              >
                <SelectTrigger className="w-56">
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
          </div>

          {mismatches.length > 0 && (
            <section className="surface p-4">
              <p className="font-medium">Participation change — confirm affected steps</p>
              <p className="text-sm text-muted-foreground">
                This home&apos;s Active Owner Program enrollment changed after these steps were
                created. Nothing is applied automatically.
              </p>
              <div className="mt-3 space-y-2">
                {mismatches.map((m) => (
                  <div
                    key={m.taskId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  >
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
                      disabled={!canEdit}
                      onClick={() =>
                        confirmRequirement.mutate({
                          data: {
                            taskId: m.taskId,
                            requiresOwnerApproval: m.shouldRequire,
                            reason: "Confirmed after an Active Owner Program participation change",
                          },
                        } as never)
                      }
                    >
                      {m.shouldRequire ? "Require owner approval" : "Remove approval requirement"}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="surface p-4">
            <p className="font-medium">Homeowner decisions</p>
            {approvals.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No homeowner approval has been requested for this home.
              </p>
            )}
            <div className="mt-2 space-y-2">
              {approvals.map((a) => (
                <div key={a.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip
                      className={stateChip(
                        a.status === "approved"
                          ? "done"
                          : a.status === "pending"
                            ? "waiting"
                            : "info",
                      )}
                    >
                      {a.status === "pending"
                        ? "Waiting on homeowner"
                        : a.status === "approved"
                          ? "Approved"
                          : "Sent back"}
                    </Chip>
                    <span className="font-medium">{a.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.decided_at
                        ? new Date(a.decided_at).toLocaleString()
                        : `Requested ${new Date(a.created_at).toLocaleDateString()}`}
                    </span>
                  </div>
                  {a.decision_note && (
                    <p className="mt-1 text-muted-foreground">{a.decision_note}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

        </TabsContent>

        {/* ------------------------------------------------------- Workflow */}
        <TabsContent value="workflow" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Standard ARHA onboarding workflow. Sections, release conditions and dates are managed
              by Resolve — open a task to see why.
            </p>
            <NewTaskDialog
              propertyId={current.id}
              people={data.people}
              tasks={tasks}
              disabled={!canEdit}
              onSave={(values) => saveTask.mutate({ data: values } as never)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Scope · {scopeSummary(scope)}</p>
          <WorkflowTable
            tasks={tasks}
            outOfScope={outOfScope}
            people={data.people}
            selectedId={openTaskId}
            onSelect={(t) => setOpenTaskId(t.id)}
          />
          <TemplatePanel propertyId={current.id} propertyName={current.name} readOnly={!canEdit} />
        </TabsContent>

        {/* ------------------------------------------------------- Property */}
        <TabsContent value="property" className="space-y-4">
          <PropertyFactsPanel propertyId={current.id} canEdit={canEdit} />
        </TabsContent>

        {/* ------------------------------------------------------ Financial */}
        <TabsContent value="financial" className="space-y-4">
          <FinancialPanel propertyId={current.id} canEdit={canEdit} isAdmin={roles.includes("admin")} />
        </TabsContent>

        {/* -------------------------------------------------------- Handoff */}
        <TabsContent value="handoff" className="space-y-5">
          {/* Handoff gate */}
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
                reviewHandoff.mutate({ data: { handoffId: openHandoff.id, ...input } } as never)
              }
            />
          )}

          <section className="surface p-4">
            <p className="font-medium">Readiness checklist</p>
            <p className="text-sm text-muted-foreground">
              Blocking items must pass, or an authorised exception must be recorded, before handoff.
            </p>
            <div className="mt-3 space-y-2">
              {readiness.checks.map((c) => (
                <div key={c.key} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  {c.passed ? (
                    <CheckCircle2 className="mt-0.5 size-4 text-state-done" />
                  ) : c.blocking ? (
                    <XCircle className="mt-0.5 size-4 text-state-blocked" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 text-state-waiting" />
                  )}
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p className="text-xs text-muted-foreground">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              {openHandoff ? (
                <Chip className={stateChip("waiting")}>
                  Handoff in review — {gateLabel(openHandoff.gate_step)}
                </Chip>
              ) : (
                <RequestHandoffDialog
                  ready={readiness.ready}
                  disabled={!canEdit}
                  carryoverCount={
                    tasks.filter((t) => t.status !== "complete" && t.status !== "carryover").length
                  }
                  onRequest={(notes2, carryoverAccepted) =>
                    requestHandoff.mutate({
                      data: { propertyId: current.id, notes: notes2, carryoverAccepted },
                    } as never)
                  }
                />
              )}
            </div>
          </section>
        </TabsContent>

        {/* ------------------------------------------------------- Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          <SchedulePanel
            propertyId={current.id}
            plannedClosingOn={
              (current as { planned_closing_on?: string | null }).planned_closing_on ?? null
            }
            actualClosingOn={
              (current as { actual_closing_on?: string | null }).actual_closing_on ?? null
            }
            actualAccessOn={
              (current as { actual_access_on?: string | null }).actual_access_on ?? null
            }
            canEdit={canEdit}
            onChange={() => void refresh()}
          />
          <section className="surface p-4">
            <p className="font-medium">Section timeline</p>
            <p className="text-sm text-muted-foreground">
              Where each workflow section should land, from the dates Resolve calculated. Only
              milestone-level dates are shown — individual task dates live in the Workflow tab.
            </p>
            <div className="mt-3 space-y-2">
              {sections.map((s) => {
                const dates = s.tasks
                  .map((v) => v.task.due_on)
                  .filter((d): d is string => Boolean(d))
                  .sort();
                const late = s.tasks.filter((v) => v.overdue).length;
                return (
                  <div
                    key={s.key}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                    <span className="numeric text-xs text-muted-foreground">
                      {dates.length > 0 ? `${dates[0]} → ${dates.at(-1)}` : "No dates set"}
                    </span>
                    <Chip
                      className={stateChip(
                        s.state === "complete"
                          ? "done"
                          : s.state === "blocked"
                            ? "blocked"
                            : "active",
                      )}
                    >
                      {s.done}/{s.total}
                    </Chip>
                    {late > 0 && <Chip className={stateChip("blocked")}>{late} late</Chip>}
                  </div>
                );
              })}
            </div>
          </section>
        </TabsContent>

        {/* ------------------------------------------------------- Calendar */}
        <TabsContent value="calendar">
          <TaskCalendar tasks={tasks} people={data.people} onSelect={(t) => setOpenTaskId(t.id)} />
        </TabsContent>

        {/* ---------------------------------------------------------- Files */}
        <TabsContent value="files" className="space-y-4">
          <AttachmentsPanel
            entityType="property"
            entityId={current.id}
            title="Property documents & media"
          />
          <OperationsContextPanel
            property={current as never}
            tasks={tasks as never}
            records={data.externalRecords as never}
            documents={data.documents as never}
            documentsEnabled={docsEnabled}
          />
        </TabsContent>

        {/* ------------------------------------------------------- Activity */}
        <TabsContent value="activity">
          <OnboardingNotes
            notes={notes as never}
            people={data.people}
            disabled={!canEdit}
            onAdd={(body, mentions) =>
              addNote.mutate({
                data: { propertyId: current.id, taskId: null, body, mentions },
              } as never)
            }
          />
        </TabsContent>
      </Tabs>

      <TaskDrawer
        task={openTask}
        tasks={tasks}
        people={data.people}
        propertyName={current.name}
        disabled={!canEdit}
        canRecordException={can("handoff_review")}
        onClose={() => setOpenTaskId(null)}
        onSave={(input: SaveTaskInput) => saveTask.mutate({ data: input } as never)}
        onSubmitApproval={(taskId, version, note) =>
          submitApproval.mutate({ data: { taskId, version, note } } as never)
        }
        onRecordOwnerDecision={(taskId, approved, note, evidenceUrl) =>
          recordOwnerDecision.mutate({
            data: { taskId, approved, note, ...(evidenceUrl ? { evidenceUrl } : {}) },
          } as never)
        }

        onReopen={(taskId, reason) => reopenTask.mutate({ data: { taskId, reason } } as never)}
        onAddObservation={(taskId, body) =>
          addNote.mutate({ data: { propertyId: current.id, taskId, body, mentions: [] } } as never)
        }
        onRecordException={(taskId, reason) =>
          recordException.mutate({ data: { taskId, reason } } as never)
        }
      />
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="surface p-3">
      <p className="eyebrow">{label}</p>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

/** Tasks and milestones by due date, month at a time. */
function TaskCalendar({
  tasks,
  people,
  onSelect,
}: {
  tasks: WorkflowTask[];
  people: { id: string; full_name: string | null; email: string | null }[];
  onSelect: (t: WorkflowTask) => void;
}) {
  const [assignee, setAssignee] = useState("all");
  const [section, setSection] = useState("all");

  const rows = tasks
    .filter((t) => t.due_on)
    .filter((t) =>
      assignee === "all"
        ? true
        : assignee === "unassigned"
          ? !t.assigned_to
          : t.assigned_to === assignee,
    )
    .filter((t) => (section === "all" ? true : t.stage === section))
    .sort((a, b) => (a.due_on ?? "").localeCompare(b.due_on ?? ""));

  const byMonth = new Map<string, WorkflowTask[]>();
  for (const t of rows) {
    const key = (t.due_on ?? "").slice(0, 7);
    byMonth.set(key, [...(byMonth.get(key) ?? []), t]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every assignee</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name || p.email || "Teammate"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={section} onValueChange={setSection}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every workflow section</SelectItem>
            {ONBOARDING_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No dated task matches this view.</p>
      )}

      {[...byMonth.entries()].map(([month, list]) => (
        <section key={month} className="surface overflow-hidden">
          <p className="border-b border-border bg-muted/40 px-3 py-1.5 text-sm font-semibold">
            {new Date(`${month}-01T00:00:00`).toLocaleString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </p>
          {list.map((t) => {
            const v = viewTask(t, tasks);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className="flex w-full items-center gap-3 border-b border-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/50"
              >
                <span className="numeric w-24 shrink-0 text-xs text-muted-foreground">
                  {t.due_on}
                </span>
                <span className="min-w-0 flex-1 truncate">{t.title}</span>
                <span className="hidden w-40 truncate text-xs text-muted-foreground sm:block">
                  {assigneeLabel(t, people)}
                </span>
                <Chip className={stateChip(STATUS_STATE[v.status])}>{STATUS_LABEL[v.status]}</Chip>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function NewTaskDialog({
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
  onSave: (values: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<string>(ONBOARDING_STAGES[0].value);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [assignedTo, setAssignedTo] = useState("unassigned");
  const [dueOn, setDueOn] = useState("");
  const [requiresOwnerApproval, setRequiresOwnerApproval] = useState(false);
  const [evidenceRequired, setEvidenceRequired] = useState(false);
  const [blocksHandoff, setBlocksHandoff] = useState(true);
  const [dependsOn, setDependsOn] = useState("none");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="size-4" /> Add task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New onboarding task</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          The standard workflow comes from the ARHA template. Add a task only for work this home
          genuinely needs beyond the standard process.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Workflow section</Label>
            <Select value={stage} onValueChange={setStage}>
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
            <Label>Task</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Collect gate codes and lockbox details"
            />
          </div>
          <div className="space-y-1">
            <Label>Detail</Label>
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Assignee</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email || "Teammate"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Due date</Label>
              <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Depends on (optional)</Label>
            <Select value={dependsOn} onValueChange={setDependsOn}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No dependency</SelectItem>
                {tasks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={requiresOwnerApproval}
              onCheckedChange={(v) => setRequiresOwnerApproval(Boolean(v))}
            />
            Requires a homeowner approval
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={evidenceRequired}
              onCheckedChange={(v) => setEvidenceRequired(Boolean(v))}
            />
            Requires evidence before it counts as complete
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={blocksHandoff}
              onCheckedChange={(v) => setBlocksHandoff(Boolean(v))}
            />
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
                parentTaskId: null,
                dependsOn: dependsOn === "none" ? [] : [dependsOn],
              });
              setOpen(false);
              setStage(ONBOARDING_STAGES[0].value);
              setTitle("");
              setDetail("");
              setAssignedTo("unassigned");
              setDueOn("");
              setRequiresOwnerApproval(false);
              setEvidenceRequired(false);
              setBlocksHandoff(true);
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
  carryoverCount,
  onRequest,
}: {
  ready: boolean;
  disabled: boolean;
  carryoverCount: number;
  onRequest: (notes: string, carryoverAccepted: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [carryover, setCarryover] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>Ready for handoff</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request handoff to operations</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {ready
              ? "All blocking checks pass. The Director of Onboarding reviews first, then the Director of Operations."
              : `Blocking checks are failing. You can still request the handoff if the ${carryoverCount} open item(s) are accepted as carryover work with an owner, a due date and a reason — carryover moves to Operations and no longer belongs to Onboarding.`}
          </p>
          <Textarea
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything operations should know before accepting."
          />
          {!ready && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={carryover} onCheckedChange={(v) => setCarryover(Boolean(v))} />
              Accept open items as carryover work
            </label>
          )}
          <Button
            className="w-full"
            onClick={() => {
              onRequest(notes.trim(), carryover);
              setOpen(false);
            }}
          >
            Send request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
