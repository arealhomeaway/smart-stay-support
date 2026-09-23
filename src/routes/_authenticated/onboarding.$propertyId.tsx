import { canReviewOnboardingGate } from "@/lib/onboarding-review-capabilities";
import { gateReviewAuthority } from "@/lib/handoff-gate-authority";
import { overrideOnboardingTaskDateFn } from "@/lib/onboarding.functions";
import {
  onboardingWorkspaceKey,
  canManageOnboardingProperty,
} from "@/lib/onboarding-workspace-view";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Plus, XCircle } from "lucide-react";
import {
  Chip,
  EmptyState,
  LoadingPage,
  PageHeader,
  ProgressRing,
} from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackControl, useRecordOrigin } from "@/components/nav/NavContext";
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
import { TwoStepHandoff } from "@/components/onboarding/TwoStepHandoff";
import { OnboardingNotes } from "@/components/onboarding/OnboardingNotes";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { HomeownerCard } from "@/components/property/HomeownerCard";

import { OperationsContextPanel } from "@/components/onboarding/OperationsContextPanel";
import { ProjectScopePanel } from "@/components/onboarding/ProjectScopePanel";
import { ProjectTeamPanel } from "@/components/onboarding/ProjectTeamPanel";
import { independentReadinessForTasks } from "@/lib/onboarding-independent-readiness";
import { FinancialPanel } from "@/components/onboarding/FinancialPanel";
import { BudgetPanel } from "@/components/onboarding/BudgetPanel";
import { AssessmentFindingsPanel } from "@/components/onboarding/AssessmentFindingsPanel";
import { VendorCoveragePanel } from "@/components/onboarding/VendorCoveragePanel";
import { OnboardingWorkOrdersPanel } from "@/components/onboarding/OnboardingWorkOrdersPanel";

import { PropertyFactsPanel } from "@/components/onboarding/PropertyFactsPanel";
import { projectScope, scopeSummary, splitByScope } from "@/lib/onboarding-scope";
import {
  type PropertyQueueFilter,
  matchesPropertyQueueFilter,
  orderPropertyWorkQueue,
  validateWorkspaceSearch,
} from "@/lib/onboarding-work-views";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { PropertyWorkQueue } from "@/components/onboarding/PropertyWorkQueue";
import { PhotoStrip } from "@/components/onboarding/PhotoStrip";
import { ProjectHistory } from "@/components/onboarding/ProjectHistory";
import {
  buildReleaseContext,
  deriveLifecycle,
  handoffReadiness,
} from "@/lib/onboarding-state";
import {
  targetHandoff,
  type OpenHandoff,
  type ProjectProperty,
} from "@/lib/onboarding-lifecycle";
import { TaskDrawer, type SaveTaskInput } from "@/components/onboarding/TaskDrawer";
import { useRole } from "@/hooks/useRole";
import { useFeatureFlags } from "@/lib/feature-flags";
import { stateChip } from "@/lib/semantic";
import { usDate, usDateTime } from "@/lib/dates";
import { assignablePeople } from "@/lib/assignable-people";
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
  archiveOnboardingTaskFn,
  reviewHandoffFn,
  saveOnboardingTaskFn,
  setPropertyLifecycleFn,
  submitOwnerApprovalFn,
  recordOwnerTaskDecisionFn,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/$propertyId")({
  validateSearch: validateWorkspaceSearch,
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
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const { can, readOnly, userId, roles } = useRole();
  const { enabled } = useFeatureFlags();
  const directorQuery = useQuery({
    queryKey: ["is-onboarding-director", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.rpc("is_onboarding_director", { _user_id: userId! });
      return data === true;
    },
  });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [queueFilter, setQueueFilter] = useState<PropertyQueueFilter>(() =>
    search.workFilter === "blocked" ? "waiting" : "attention",
  );
  // Where the Director hub was left — filters, search and lens intact — so
  // Back restores that exact view rather than a bare "/onboarding".
  const { origin } = useRecordOrigin("onboarding");

  const { data, isLoading } = useQuery({
    queryKey: onboardingWorkspaceKey(userId),
    queryFn: () => load(),
    enabled: Boolean(userId),
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

  const saveDate = mut(useServerFn(overrideOnboardingTaskDateFn), "Date override recorded.");
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
  const voidTask = mut(useServerFn(archiveOnboardingTaskFn), "Step voided.");
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
  if (
    data.workspaceMode === "assigned" ||
    data.assignedWorkContexts.some((context) => context.propertyId === propertyId)
  )
    return <Navigate to="/onboarding/my-work" search={{ who: "me" }} replace />;
  if (!current)
    return (
      <EmptyState title="Home not found" hint="This property is not in the onboarding workspace." />
    );

  const openHandoff = data.handoffs.find(
    (h) =>
      h.property_id === current.id &&
      (h.status === "requested" || h.status === "accepted_pending_live"),
  );
  const projectRow =
    (data.projects ?? []).find((x) => x.property_id === propertyId && x.status !== "cancelled") ??
    null;
  const notes = data.notes.filter((n) => n.property_id === current.id);
  const approvals = (data.ownerApprovals ?? []).filter((a) => a.property_id === current.id);
  const mismatches = (data.approvalMismatches ?? []).filter((m) => m.propertyId === current.id);
  const activeOwner = (data.activeOwnerProperties ?? []).find((l) => l.propertyId === current.id);
  const docsEnabled = enabled("onboarding_sharepoint_docs");
  // The project record is the authority on who runs this home. The property's
  // legacy onboarding_owner is only a fallback for a home with no project yet,
  // otherwise a reassignment in the scope panel would never show up here.
  const pmId = projectRow?.project_manager ?? current.onboarding_owner;
  const pm = data.people.find((p) => p.id === pmId);
  const utilityManager = data.people.find((p) => p.id === projectRow?.utility_manager);
  const openTask = tasks.find((t) => t.id === openTaskId) ?? null;
  const isOnboardingDirector = directorQuery.data === true;
  const canEdit = !readOnly && can("handoff_request");
  const canExecuteProject =
    !readOnly && (data.reviewCapabilities.is_admin || projectRow?.project_manager === userId);

  // The four-gate sequence: the PM who submitted the handoff never approves it,
  // and each review role signs for itself. Mirrors the database rule exactly.
  const gateAuthority = openHandoff
    ? !readOnly && canReviewOnboardingGate(data.reviewCapabilities, openHandoff.gate_step)
      ? gateReviewAuthority({
          gateStep: openHandoff.gate_step,
          viewerId: userId,
          holdsSeat: true,
          requestedBy: openHandoff.requested_by ?? null,
          projectManagerId: projectRow?.project_manager ?? null,
          priorReviews: (data.reviews ?? []).map((r) => ({
            step: r.step as string,
            decision: r.decision as string,
            reviewerId: (r.reviewer_id as string | null) ?? null,
          })),
        })
      : ({ ok: false, reason: "This review gate belongs to another role." } as const)
    : ({ ok: false, reason: "" } as const);

  const project = {
    property: current as unknown as ProjectProperty,
    tasks,
    handoff: (openHandoff ?? null) as OpenHandoff,
    project: projectRow as never,
    stageCaptures: data.stageCaptures.filter((c) => c.propertyId === current.id),
    excludedTaskIds: outOfScope.map((x) => x.task.id),
    independentReadiness:
      data.independentReadiness.find((row) => row.propertyId === current.id) ?? null,
  };
  // One authoritative read, shared by every surface on this page.
  const life = deriveLifecycle({
    property: current as never,
    project: projectRow as never,
    tasks,
    handoff: (openHandoff ?? null) as never,
  });
  const release = buildReleaseContext({
    property: current as never,
    project: projectRow as never,
    tasks,
    handoff: (openHandoff ?? null) as never,
    stageCaptures: data.stageCaptures.filter((c) => c.propertyId === current.id),
    excludedTaskIds: outOfScope.map((x) => x.task.id),
  });
  const roll = rollupProperty(tasks, release);
  const sections = buildSections(tasks, release);
  const independent = independentReadinessForTasks(
    data.independentReadiness.find((row) => row.propertyId === current.id),
    tasks,
  );
  const readiness = handoffReadiness(
    {
      property: current as never,
      project: projectRow as never,
      tasks,
      handoff: (openHandoff ?? null) as never,
      stageCaptures: data.stageCaptures.filter((c) => c.propertyId === current.id),
    },
    validateHandoff(current, tasks as never, {
      includeQuarterlyReview: enabled("quarterly_reviews"),
    }).checks,
    independent.extras,
  );
  // Work recorded after Operations accepted the home is never part of that
  // finished plan: it is a correction or an Operations ticket.
  const postAcceptance = life.lockedAt
    ? tasks.filter(
        (t) =>
          (t.created_at ?? "") > life.lockedAt! &&
          t.status !== "complete" &&
          t.status !== "carryover",
      )
    : [];

  // Before onboarding is actually started there is no plan to act on. Showing
  // scope pickers, Add task or template actions here would imply a project
  // exists, so this home gets a pre-start screen instead.
  if (life.notStarted) {
    return (
      <div className="space-y-5">
        <BackControl origin={origin} />
        <PageHeader
          eyebrow="Onboarding"
          title={current.name}
          description="Onboarding has not been started for this home yet."
        />
        <section className="surface p-4">
          <p className="font-medium">What Resolve knows about this home</p>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Address">
              {[current.address_line1, current.city, current.state].filter(Boolean).join(", ") ||
                "Not recorded"}
            </Summary>
            <Summary label="Lifecycle">{lifecycleMeta(current.lifecycle_status).label}</Summary>
            <Summary label="Planned closing">{current.planned_closing_on ?? "Not set"}</Summary>
            <Summary label="Access confirmed">{current.actual_access_on ?? "Not yet"}</Summary>
            <Summary label="Project manager">{pm?.full_name ?? pm?.email ?? "Unassigned"}</Summary>
            <Summary label="Program">
              {activeOwner ? "Active Owner Program" : "Standard owner"}
            </Summary>
          </dl>
        </section>

        <HomeownerCard propertyId={current.id} canManage={canEdit} />

        <ProjectScopePanel
          propertyId={current.id}
          propertyName={current.name}
          people={data.people}
          canEdit={canEdit}
          hints={{ planned_closing_on: current.planned_closing_on ?? null }}
        />

        <p className="text-sm text-muted-foreground">
          Templates, tasks and handoff become available once an Onboarding Project is started. Until
          then nothing here is actionable.
        </p>
      </div>
    );
  }

  const target = targetHandoff(project);
  const views = orderPropertyWorkQueue(tasks.map((t) => viewTask(t, tasks, release)));
  const attention = views.filter((v) => matchesPropertyQueueFilter(v, "attention", userId));
  const nextUp = views.filter((v) => matchesPropertyQueueFilter(v, "ready", userId)).slice(0, 3);
  const blocked = views.filter((v) => matchesPropertyQueueFilter(v, "waiting", userId));
  const handoffLeft = tasks.filter(
    (t) =>
      (t as { blocks_handoff?: boolean }).blocks_handoff &&
      (t as { is_required?: boolean }).is_required !== false &&
      t.status !== "complete",
  ).length;
  const overdue = views.filter((v) => v.overdue && v.status !== "complete").length;
  const onTrack = life.accepted
    ? "Accepted by Operations"
    : handoffLeft === 0
      ? "Ready to mark Ready for Operations"
      : overdue > 0
        ? `At risk — ${overdue} overdue, ${handoffLeft} handoff Tasks left`
        : `On track — ${handoffLeft} handoff Tasks left`;
  const taskRow = (v: (typeof views)[number]) => (
    <li key={v.task.id}>
      <button
        type="button"
        onClick={() => setOpenTaskId(v.task.id)}
        className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50"
      >
        <span className="min-w-0 flex-1 truncate font-medium">{v.task.title}</span>
        {v.overdue && <Chip className={stateChip("blocked")}>Overdue</Chip>}
        <span className="text-xs text-muted-foreground">
          {assigneeLabel(v.task, data.people)}
          {v.task.due_on ? ` · ${usDate(v.task.due_on)}` : ""}
        </span>
      </button>
    </li>
  );

  return (
    <div className="space-y-5">
      <BackControl origin={origin} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-sunken">
          <PropertyPhoto
            url={current.primary_photo_url ?? null}
            name={current.nickname ?? current.name}
            rounded="rounded-none"
            className="size-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <PageHeader
            eyebrow="Onboarding"
            title={current.name}
            description={
              [current.address_line1, current.city, current.state].filter(Boolean).join(", ") ||
              undefined
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip className={stateChip(life.accepted ? "done" : "info")}>{life.label}</Chip>
        <Chip className={stateChip("info")}>{stageLabel(current.onboarding_stage)}</Chip>
        {activeOwner && <Chip className={stateChip("waiting")}>Active Owner</Chip>}
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <Link
            to="/tickets/new"
            search={{ property: current.id, project: current.id, from: "onboarding" }}
          >
            Report an issue
          </Link>
        </Button>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Closing</dt>
          <dd className="numeric font-medium">{current.planned_closing_on ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Access / possession</dt>
          <dd className="numeric font-medium">{current.actual_access_on ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Target handoff</dt>
          <dd className="numeric font-medium">{target ?? "Not set"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Project manager</dt>
          <dd className="font-medium">{pm?.full_name ?? pm?.email ?? "Unassigned"}</dd>
        </div>
      </dl>

      <Tabs
        value={search.tab}
        onValueChange={(tab) => void navigate({ search: { ...search, tab }, replace: true })}
        className="space-y-5"
      >
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="work">Tasks</TabsTrigger>
          <TabsTrigger value="property">Property Details</TabsTrigger>
          <TabsTrigger value="files">Files &amp; History</TabsTrigger>
          <TabsTrigger value="handoff">Handoff</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <section className="surface grid gap-4 p-4 sm:grid-cols-3">
            <div className="flex items-center gap-3">
              <ProgressRing value={roll.progress} />
              <div>
                <p className="text-xs text-muted-foreground">Progress</p>
                <p className="numeric text-sm font-medium">
                  {roll.done} of {roll.total} Tasks done
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Handoff</p>
              <p className="text-sm font-medium">{onTrack}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Blocked or waiting</p>
              <p className="numeric text-sm font-medium">
                {blocked.length === 0 ? "Nothing blocked" : `${blocked.length} Tasks`}
              </p>
            </div>
          </section>

          <section className="surface space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Needs attention</h2>
              {attention.length > 5 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setQueueFilter("attention");
                    void navigate({ search: { ...search, tab: "work" }, replace: true });
                  }}
                >
                  See all {attention.length}
                </Button>
              )}
            </div>
            {attention.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing needs attention right now.</p>
            ) : (
              <ul className="space-y-2">{attention.slice(0, 5).map(taskRow)}</ul>
            )}
          </section>

          <section className="surface space-y-3 p-4">
            <h2 className="font-semibold">What&apos;s next</h2>
            {nextUp.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Tasks are ready to start.</p>
            ) : (
              <ul className="space-y-2">{nextUp.map(taskRow)}</ul>
            )}
          </section>

          <ProjectTeamPanel propertyId={current.id} />
        </TabsContent>

        <TabsContent value="work" className="space-y-5">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <NewTaskDialog
              propertyId={current.id}
              people={data.people}
              tasks={tasks}
              // Only directors add work to a plan; project managers work the plan.
              disabled={!canEdit || !can("handoff_review")}
              onSave={(values) => saveTask.mutate({ data: values } as never)}
            />
          </div>
          {life.locked && (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              This onboarding plan is locked
              {life.lockedAt ? ` (${life.lockedAt.slice(0, 10)})` : ""}. Record a correction or
              report an issue instead.
            </p>
          )}
          {postAcceptance.length > 0 && (
            <section className="surface p-4">
              <p className="font-medium">Found after acceptance ({postAcceptance.length})</p>
              <p className="text-sm text-muted-foreground">
                These were created after Operations accepted the home. Handle each as a correction
                or an Operations ticket.
              </p>
            </section>
          )}
          <PropertyWorkQueue
            tasks={tasks}
            people={data.people}
            viewerId={userId}
            filter={queueFilter}
            onFilterChange={setQueueFilter}
            onSelect={(task) => setOpenTaskId(task.id)}
            release={release}
          />
        </TabsContent>

        <TabsContent value="property" className="space-y-4">
          <PropertyFactsPanel propertyId={current.id} canEdit={canEdit} />
          <HomeownerCard propertyId={current.id} canManage={canEdit} />
          <section className="surface space-y-4 p-4">
            <p className="font-medium">Key dates</p>
            <SchedulePanel
              propertyId={current.id}
              plannedClosingOn={current.planned_closing_on ?? null}
              actualClosingOn={
                (current as { actual_closing_on?: string | null }).actual_closing_on ?? null
              }
              actualAccessOn={current.actual_access_on ?? null}
              canEdit={canEdit}
              onChange={() => void refresh()}
            />
          </section>
          <ProjectScopePanel
            propertyId={current.id}
            propertyName={current.name}
            people={data.people}
            canEdit={canEdit}
            hints={{ planned_closing_on: current.planned_closing_on ?? null }}
          />
          <section className="surface flex flex-wrap items-end gap-3 p-4">
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
                disabled={
                  readOnly ||
                  Boolean(current.handoff_accepted_at) ||
                  !["onboarding", "paused"].includes(current.lifecycle_status ?? "")
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE.filter((l) =>
                    ["onboarding", "paused", "offboarded", current.lifecycle_status].includes(
                      l.value,
                    ),
                  ).map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Scope · {scopeSummary(scope)}</p>
          </section>
          <OperationsContextPanel
            property={current as never}
            tasks={tasks as never}
            records={data.externalRecords as never}
            documents={data.documents as never}
            documentsEnabled={docsEnabled}
          />
          <VendorCoveragePanel propertyId={current.id} />
          <OnboardingWorkOrdersPanel propertyId={current.id} />
          <BudgetPanel propertyId={current.id} canEdit={canEdit} />
          <FinancialPanel
            propertyId={current.id}
            canEdit={canEdit}
            isAdmin={roles.includes("admin")}
          />
          <AssessmentFindingsPanel
            propertyId={current.id}
            canEdit={canEdit}
            onOpenTask={setOpenTaskId}
          />
        </TabsContent>

        <TabsContent value="handoff" className="space-y-5">
          <TwoStepHandoff propertyId={current.id} readOnly={readOnly} onOpenTask={(id) => setOpenTaskId(id)} />
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <PhotoStrip entityType="property" entityId={current.id} title="Visual evidence" limit={16} />
          <AttachmentsPanel
            entityType="property"
            entityId={current.id}
            title="Shared documents & media"
          />
          <ProjectHistory
            propertyId={current.id}
            tasks={tasks}
            approvals={approvals as never}
            reviews={
              data.reviews.filter((r) =>
                data.handoffs.some((h) => h.id === r.handoff_id && h.property_id === current.id),
              ) as never
            }
            people={data.people}
          />
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
        release={release}
        approvals={approvals as never}
        canRecordException={can("handoff_review")}
        canManageTask={canManageOnboardingProperty(
          userId,
          can("handoff_review") || isOnboardingDirector,
          openTask?.property_id,
          data.projects,
        )}
        onVoid={(taskId: string, reason: string) => {
          voidTask.mutate({ data: { taskId, reason } } as never);
          setOpenTaskId(null);
        }}
        onClose={() => setOpenTaskId(null)}
        onSave={(input: SaveTaskInput) => saveTask.mutate({ data: input } as never)}
        onSaveDate={(taskId, expectedUpdatedAt, dueOn, reason) =>
          saveDate.mutate({ data: { taskId, expectedUpdatedAt, dueOn, reason } } as never)
        }
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
        onAdvance={setOpenTaskId}
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
            {assignablePeople(people).map((p) => (
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
                  {assignablePeople(people).map((p) => (
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
  blockedReasons,
  disabled,
  carryoverCount,
  onRequest,
}: {
  ready: boolean;
  blockedReasons: { key: string; label: string }[];
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
          {blockedReasons.length > 0 && (
            <p className="text-sm text-destructive">
              Handoff cannot be requested while these stand:{" "}
              {blockedReasons.map((r) => r.label).join("; ")}.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {ready
              ? "All blocking checks pass. The Director of Onboarding reviews first, then the Director of Operations."
              : `Required checks pass. The ${carryoverCount} remaining item(s) must be accepted as carryover work with an owner, a due date and a reason — carryover moves to Operations and no longer belongs to Onboarding.`}
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
            disabled={blockedReasons.length > 0 || (!ready && !carryover)}
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
