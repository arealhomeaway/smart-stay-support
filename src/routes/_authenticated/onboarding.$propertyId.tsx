import { formatPropertyLabel } from "@/lib/property-label";
import { canReviewOnboardingGate } from "@/lib/onboarding-review-capabilities";
import { gateReviewAuthority } from "@/lib/handoff-gate-authority";
import { overrideOnboardingTaskDateFn } from "@/lib/onboarding.functions";
import {
  onboardingWorkspaceKey,
  canManageOnboardingProperty,
} from "@/lib/onboarding-workspace-view";
import { createFileRoute, Link, Navigate, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, Plus, XCircle } from "lucide-react";
import { Chip, EmptyState, LoadingPage, PageHeader, ProgressRing } from "@/components/ui/page";
import { PropertyOwnerCompletions } from "@/components/onboarding/PropertyOwnerCompletions";
import { HomeContextHeader } from "@/components/property/HomeContextHeader";
import { CarryoverSummary } from "@/components/onboarding/CarryoverSummary";
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
import { HomeAutomation } from "@/components/ao/HomeAutomation";

import { ProjectScopePanel } from "@/components/onboarding/ProjectScopePanel";
import { ProjectTeamPanel } from "@/components/onboarding/ProjectTeamPanel";
import { PropertyOpportunitiesPanel } from "@/components/onboarding/PropertyOpportunitiesPanel";
import { PlanCsvButton } from "@/components/onboarding/PlanCsvButton";
import { independentReadinessForTasks } from "@/lib/onboarding-independent-readiness";
import { FinancialPanel } from "@/components/onboarding/FinancialPanel";
import { BudgetPanel } from "@/components/onboarding/BudgetPanel";
import { FillInEditors } from "@/components/onboarding/FillInEditors";
import { AssessmentFindingsPanel } from "@/components/onboarding/AssessmentFindingsPanel";
import { AssessmentsFormsPanel } from "@/components/onboarding/AssessmentsFormsPanel";
import { FollowHomeButton } from "@/components/onboarding/OnboardingActivityFeed";
import { OwnerViewPreview } from "@/components/onboarding/OwnerViewPreview";
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
import { PlanCatchUpBar, usePlanCatchUp } from "@/components/onboarding/PlanCatchUp";
import { planCatchUpViewerFn } from "@/lib/plan-catch-up.functions";
import { canUseCatchUp, type CatchUpTask, type CatchUpViewer } from "@/lib/plan-catch-up";
import { PhotoStrip } from "@/components/onboarding/PhotoStrip";
import { ProjectHistory } from "@/components/onboarding/ProjectHistory";
import { buildReleaseContext, deriveLifecycle, handoffReadiness } from "@/lib/onboarding-state";
import {
  summarizeProject,
  targetHandoff,
  type OpenHandoff,
  type ProjectProperty,
} from "@/lib/onboarding-lifecycle";
import {
  centralToday,
  handoffDate,
  isFinished,
  shortDate,
  stepperFor,
  type BoardTask,
  type ProjectDetails,
} from "@/lib/onboarding-board";
import {
  AgreementsTab,
  BudgetFigures,
  DesignTab,
  GeneralInfoFields,
  ProjectDetailsSection,
  notNeededLabel,
} from "@/components/onboarding/board/HomeBoard";
import { OnboardingHomeHeader } from "@/components/onboarding/home-page/OnboardingHomeHeader";
import { TasksTab } from "@/components/onboarding/home-page/TasksTab";
import {
  NeedsAttentionStrip,
  NoPlanCard,
  OverviewCards,
  StatusStageMapEditor,
  useStatusStageMap,
} from "@/components/onboarding/home-page/OverviewParts";
import { usePropertyOwnerSummary } from "@/components/onboarding/PropertyOpportunitiesPanel";
import { loadHomePlan } from "@/lib/ao-data";
import { FURNISHING_SCOPES } from "@/lib/onboarding-scope";
import {
  DEFAULT_STATUS_STAGE_MAP,
  PAGE_TABS,
  committedHandoffMissing,
  computedStage,
  effectiveOwner,
  factsLine,
  mayAddAny,
  moreTags,
  needsAttention,
  ownerDecisionsDue,
  pageTabFor,
  scheduleHealth,
  stageMismatch,
  yoursLate,
  type AddViewer,
  type AttentionChip,
  type OwnerTag,
  type PageTask,
} from "@/lib/onboarding-home-page";
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { documentCategoryLabel } from "@/lib/attachments";
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
  taskRoleLabel,
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
  updateOnboardingProjectFn,
} from "@/lib/onboarding.functions";

const PROPERTY_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function InvalidPropertyRoute() {
  return (
    <div className="space-y-3 py-10 text-center">
      <p className="text-muted-foreground">This home could not be found.</p>
      <div className="flex justify-center gap-4 text-sm">
        <Link to="/onboarding" search={{ lens: "all" } as never} className="underline">
          Back to Properties
        </Link>
        <Link to="/onboarding" className="underline">
          Onboarding Dashboard
        </Link>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/onboarding/$propertyId")({
  // Part 1 tabs (Overview, Tasks, Owner, Home details, Vendors and work, Files, Budget, Activity, More);
  // older tab links open the tab that now holds their content.
  validateSearch: (raw: Parameters<typeof validateWorkspaceSearch>[0]) => {
    const parsed = validateWorkspaceSearch(raw);
    const rawTab = typeof raw.tab === "string" ? raw.tab : undefined;
    const tab =
      rawTab ?? (typeof raw.opp === "string" && typeof raw.task !== "string" ? "owner" : "tasks");
    // Fixes 11, 12: Owner Completions opens the Task drawer at its owner conversation.
    return { ...parsed, tab, ...((raw as { at?: unknown }).at === "conversation" ? { at: "conversation" as const } : {}) };
  },
  // Only a real property id may open a workspace; anything else never
  // reaches the server.
  beforeLoad: ({ params }) => {
    if (!PROPERTY_ID_RE.test(params.propertyId)) throw notFound();
  },
  notFoundComponent: InvalidPropertyRoute,
  head: () => ({
    meta: [
      { title: "Home onboarding: Resolve" },
      {
        name: "description",
        content:
          "One home's onboarding: stage, health, team, key dates, the plan, design files, budget and invoices, agreements, general info, files and activity.",
      },
      { property: "og:title", content: "Home onboarding: Resolve" },
      {
        property: "og:description",
        content: "A home's six onboarding stages, its plan and everything on file.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PropertyWorkspace,
  errorComponent: InvalidPropertyRoute,
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
  // Build 18 item 6b: Edit selected shows only to the people the bulk save itself allows
  // (database can_bulk_edit_home_tasks mirrors bulk_update_onboarding_home_tasks).
  const bulkEditQuery = useQuery({
    queryKey: ["can-bulk-edit-home-tasks", propertyId, userId],
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.rpc("can_bulk_edit_home_tasks", { _property_id: propertyId });
      return !error && data === true;
    },
  });
  const linkedTask = "task" in search && typeof search.task === "string" ? search.task : null;
  const linkedOpp = "opp" in search && typeof search.opp === "string" ? search.opp : null;
  const [openTaskId, setOpenTaskId] = useState<string | null>(linkedTask);
  // A notification opened while already on this page changes only the link;
  // follow it so the Task it points at actually opens.
  useEffect(() => {
    if (linkedTask) setOpenTaskId(linkedTask);
  }, [linkedTask, propertyId]);
  // Where the Director hub was left — filters, search and lens intact — so
  // Back restores that exact view rather than a bare "/onboarding".
  const { origin } = useRecordOrigin("onboarding");

  const { data, isLoading } = useQuery({
    // Only this Project's rows — never every home's Tasks, files and notes.
    queryKey: [...onboardingWorkspaceKey(userId), "property", propertyId],
    queryFn: () => load({ data: { propertyId } }),
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
  const saveRefs = mut(useServerFn(updateOnboardingProjectFn), "Saved.");
  // The home's files, shared with the Design and Files tabs (same cache key).
  const listFiles = useServerFn(listAttachmentsFn);
  const homeFiles = useQuery({
    queryKey: ["attachments", "property", propertyId],
    queryFn: () => listFiles({ data: { entityType: "property", entityId: propertyId } }),
    enabled: Boolean(userId) && PROPERTY_ID_RE.test(propertyId),
  });

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

  // Plan catch-up (Admin approval Nov 12): one selection across the stage lists.
  const catchUpViewerFn = useServerFn(planCatchUpViewerFn);
  const catchUpViewerQuery = useQuery({
    queryKey: ["plan-catch-up-viewer", propertyId, userId],
    enabled: Boolean(userId) && PROPERTY_ID_RE.test(propertyId),
    staleTime: 60 * 1000,
    queryFn: () => catchUpViewerFn({ data: { propertyId } }),
  });
  const catchUpViewer = useMemo<CatchUpViewer | null>(
    () => (catchUpViewerQuery.data && userId ? { ...catchUpViewerQuery.data, userId } : null),
    [catchUpViewerQuery.data, userId],
  );
  const catchUp = usePlanCatchUp(tasks as unknown as CatchUpTask[], catchUpViewer);
  // Property page Part 1: the Tasks tab's stage and whose-Task filter (Needs attention jumps set them),
  // Ask the owner, the Status to stage map, the owner counts, the homeowner plan switch and labels.
  const [stageSel, setStageSel] = useState<number | null | undefined>(undefined);
  const [tagSel, setTagSel] = useState<OwnerTag | null>(null);
  const [compose, setCompose] = useState(0);
  const statusMap = useStatusStageMap();
  const ownerSummary = usePropertyOwnerSummary(propertyId);
  const homePlan = useQuery({ queryKey: ["ao-home-plan", propertyId], queryFn: () => loadHomePlan(propertyId), retry: false, enabled: Boolean(userId) });
  const homeLabels = useQuery({
    queryKey: ["home-labels", propertyId],
    enabled: Boolean(userId) && PROPERTY_ID_RE.test(propertyId),
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: rows, error } = await supabase
        .from("property_label_assignments")
        .select("property_labels(name)")
        .eq("property_id", propertyId);
      if (error) return [] as string[];
      return (rows ?? [])
        .map((r) => (r.property_labels as unknown as { name?: string } | null)?.name ?? "")
        .filter(Boolean);
    },
  });

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

  const target = targetHandoff(project);
  const boardTasks = tasks as unknown as BoardTask[];
  const stepper = stepperFor(boardTasks);
  const today = centralToday();
  const details = (projectRow ?? {}) as ProjectDetails & {
    id?: string;
    role_assignments?: Record<string, string> | null;
    staging_provider?: string | null;
    external_refs?: Record<string, string> | null;
  };
  const personName = (id: string | null | undefined) => {
    if (!id) return null;
    const x = data.people.find((q) => q.id === id);
    return x?.full_name || x?.email || null;
  };
  const place = [
    [current.city, current.state].filter(Boolean).join(", "),
    (current as { market?: string | null }).market ?? null,
  ]
    .filter(Boolean)
    .join(" · ");
  const isAdminViewer = roles.includes("admin");
  const canSetStatus = projectRow?.project_manager === userId || isOnboardingDirector || isAdminViewer;
  const canCorrect = !readOnly && (isAdminViewer || roles.includes("manager"));
  // The board fields (register A16): the Director of Onboarding, Admin and this home's
  // Project Manager edit; everyone else who can open the page reads them.
  const canEditBoard =
    canEdit && (isAdminViewer || isOnboardingDirector || projectRow?.project_manager === userId);
  const planTasks = tasks.map((t) => ({ ...(t as unknown as BoardTask), roleLabel: taskRoleLabel(t) })) as unknown as PageTask[];
  // Item 7: Director of Onboarding and Admin on every home, the home's Project Manager, Utilities
  // and Design on their own Tasks; never Operations. The database enforces the same rule.
  const catchUpOn = !readOnly && !life.locked && Boolean(catchUpViewer && canUseCatchUp(catchUpViewer));
  const catchUpStages = [...new Set(tasks.map((t) => t.stage))];
  const refs = (details.external_refs ?? {}) as Record<string, string>;
  const actualClosing = (current as { actual_closing_on?: string | null }).actual_closing_on ?? null;
  const homeName = formatPropertyLabel(current).primary;
  const designerId =
    details.role_assignments?.["design_staging"] ?? details.role_assignments?.["lead_designer"] ?? details.role_assignments?.["designer"] ?? null;
  const isActiveOwnerHome = Boolean(activeOwner) || details.owner_type === "Active Owner";

  // 1.4: the stage comes from the Tasks; Status stays the PM's choice.
  const stage = computedStage(planTasks);
  const health = scheduleHealth({ tasks: planTasks, today, estimateOn: target, committedOn: details.committed_handoff_on });
  const mismatch = stageMismatch(details.project_status, stage, statusMap.data?.map ?? DEFAULT_STATUS_STAGE_MAP);
  const handoffOn = handoffDate(details.committed_handoff_on, target);
  const missingRoles = [
    !pmId ? "Project Manager" : null,
    !designerId ? "Designer" : null,
    !projectRow?.utility_manager ? "Utilities" : null,
  ].filter((x): x is string => Boolean(x));
  const chips = needsAttention({
    ownerWaitingOnUs: ownerSummary.waitingOnUs,
    ownerDecisionsDue: ownerDecisionsDue(planTasks, today).length,
    yoursLate: yoursLate(planTasks, userId, pmId, today).length,
    mismatch,
    missingRoles,
    committedMissing: committedHandoffMissing({
      committedOn: details.committed_handoff_on,
      actualClosingOn: actualClosing,
      plannedClosingOn: current.planned_closing_on ?? null,
      today,
    }),
  });
  const tab = pageTabFor(search.tab, Boolean(linkedOpp && !linkedTask));
  const goTab = (next: string) => void navigate({ search: { ...search, tab: next } as never, replace: true });
  const scrollToId = (id: string) => {
    let tries = 0;
    const go = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      else if (tries++ < 10) window.setTimeout(go, 60);
    };
    window.setTimeout(go, 0);
  };
  const onJump = (c: AttentionChip) => {
    if (c.jump.tab === "tasks") {
      setStageSel(c.jump.stage);
      setTagSel(c.jump.tag);
    }
    goTab(c.jump.tab);
    if (c.jump.tab === "details") scrollToId(`home-details-${c.jump.section}`);
  };
  const selectedStage = stageSel === undefined ? stage - 1 : stageSel;
  const scope2 = FURNISHING_SCOPES.find((f) => f.value === projectRow?.furnishing_scope)?.label ?? null;
  const more = moreTags({
    market: (current as { market?: string | null }).market ?? null,
    scope: scope2,
    utilityOption: scope.modules.includes("utilities") ? "Utility setup" : null,
    hoa: Boolean((current as { hoa?: { present?: unknown } | null }).hoa?.present === true || (current as { hoa?: { present?: unknown } | null }).hoa?.present === "Yes"),
    breezeway: Boolean((current as { breezeway_property_id?: string | null }).breezeway_property_id),
    labels: homeLabels.data ?? [],
  });
  const facts = factsLine({
    actualClosingOn: actualClosing,
    plannedClosingOn: current.planned_closing_on ?? null,
    committedOn: details.committed_handoff_on,
    estimateOn: target,
    stage,
    pmName: personName(pmId),
    today,
  });
  const addViewer: AddViewer | null =
    !readOnly && !life.locked && catchUpViewer && mayAddAny(catchUpViewer) ? catchUpViewer : null;
  const nextThree = planTasks
    .filter((t) => !isFinished(t) && !t.parent_task_id && effectiveOwner(t, pmId) === userId)
    .sort((x, y) => (x.due_on ?? "9999").localeCompare(y.due_on ?? "9999"))
    .slice(0, 3);
  const teamTag = (id: string | null | undefined, fallback: OwnerTag): OwnerTag => (id && id === userId ? "you" : fallback);
  const canStartPlan = !readOnly && (isAdminViewer || isOnboardingDirector);
  const noPlan = life.notStarted || tasks.length === 0;

  const header = (
    <OnboardingHomeHeader
      propertyId={current.id}
      name={homeName}
      place={place}
      photo={current.primary_photo_url ?? null}
      status={details.project_status ?? null}
      activeOwner={isActiveOwnerHome}
      health={health}
      more={more}
      facts={facts}
      canAddOwner={!readOnly && (isAdminViewer || isOnboardingDirector)}
      onAskOwner={() => {
        goTab("owner");
        setCompose((n) => n + 1);
      }}
      attention={<NeedsAttentionStrip chips={chips} onJump={onJump} />}
    />
  );

  // 1.9: a home with no onboarding project or no Tasks shows the header and one card.
  if (noPlan) {
    return (
      <div className="space-y-5">
        {header}
        <NoPlanCard
          canStart={canStartPlan}
          start={
            <ProjectScopePanel
              propertyId={current.id}
              propertyName={homeName}
              people={data.people}
              canEdit={canStartPlan}
              hints={{ planned_closing_on: current.planned_closing_on ?? null }}
            />
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <Tabs value={tab} onValueChange={goTab} className="space-y-5">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto">
          {PAGE_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="min-h-11 shrink-0 gap-1.5">
              {t.label}
              {t.value === "owner" && ownerSummary.waitingOnUs > 0 ? (
                <span className="numeric inline-flex min-w-5 items-center justify-center rounded-full bg-state-blocked px-1.5 text-xs font-semibold text-stage-selected-fg" aria-label={`${ownerSummary.waitingOnUs} waiting on us`}>
                  {ownerSummary.waitingOnUs}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <OverviewCards
            stepper={stepper}
            stage={stage}
            handoffOn={handoffOn}
            nextThree={nextThree}
            today={today}
            team={[
              { role: "Project Manager", tag: teamTag(pmId, "director"), name: personName(pmId) },
              { role: "Designer", tag: teamTag(designerId, "designer"), name: personName(designerId) },
              { role: "Utilities", tag: teamTag(projectRow?.utility_manager, "utilities"), name: personName(projectRow?.utility_manager) },
              { role: "Staging Team", tag: "director", name: details.staging_provider ?? null, outside: true },
            ]}
            owner={{
              waitingOnUs: ownerSummary.waitingOnUs,
              waitingOnThem: ownerSummary.waitingOnThem,
              hours: ownerSummary.program ? ownerSummary.program.reportedHours : null,
              plan: homePlan.data && homePlan.data.available ? homePlan.data.automated : null,
              activeOwner: isActiveOwnerHome,
            }}
            onOpenTasks={() => goTab("tasks")}
            onOpenTask={setOpenTaskId}
            onOpenDetails={() => {
              goTab("details");
              scrollToId("home-details-team");
            }}
            onOpenOwner={() => goTab("owner")}
            shortDate={shortDate}
          />
        </TabsContent>

        <TabsContent value="tasks" className="space-y-5">
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
          <TasksTab
            propertyId={current.id}
            tasks={planTasks}
            people={data.people}
            viewerId={userId}
            pmId={pmId ?? null}
            today={today}
            stage={selectedStage}
            onStage={setStageSel}
            tag={tagSel}
            onTag={setTagSel}
            catchUp={catchUpOn ? catchUp : undefined}
            onOpen={setOpenTaskId}
            addViewer={addViewer}
            handoff={<TwoStepHandoff propertyId={current.id} readOnly={readOnly} onOpenTask={(id) => setOpenTaskId(id)} variant="checklist" />}
            notNeeded={(data.retiredTasks ?? []).filter((t) => (t.exception_reason ?? "").startsWith("Voided"))}
            notNeededLabel={notNeededLabel}
          />
          {catchUpOn ? (
            <>
              {catchUp.selected.size > 0 ? <div className="h-28" aria-hidden="true" /> : null}
              <PlanCatchUpBar
                propertyId={current.id}
                homeName={homeName}
                tasks={tasks as never}
                people={data.people}
                selection={catchUp}
                canEditSelected={bulkEditQuery.data === true}
                stages={catchUpStages}
                onChanged={() => void qc.invalidateQueries()}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="owner" className="space-y-4">
          {isActiveOwnerHome ? (
            <section className="space-y-4" aria-label="Active Owner">
              <HomeAutomation propertyId={current.id} />
              <PropertyOpportunitiesPanel propertyId={current.id} openId={linkedOpp} compose={compose} />
            </section>
          ) : null}
          <PropertyOwnerCompletions propertyId={current.id} isDemo={Boolean((current as { is_demo?: boolean }).is_demo)} />
          <HomeownerCard propertyId={current.id} canManage={canEdit} />
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div id="home-details-dates" className="scroll-mt-4 space-y-4">
            <ProjectDetailsSection
              projectId={projectRow?.id ?? null}
              details={details}
              canEdit={canEditBoard}
              canSetStatus={canSetStatus}
              canCorrect={canCorrect}
            />
            <section className="surface space-y-3 p-4" aria-label="Project dates">
              <h2 className="font-semibold">Dates</h2>
              <SchedulePanel
                propertyId={current.id}
                plannedClosingOn={current.planned_closing_on ?? null}
                actualClosingOn={actualClosing}
                actualAccessOn={current.actual_access_on ?? null}
                canEdit={canEdit}
                onChange={() => void refresh()}
              />
            </section>
            <StatusStageMapEditor isAdmin={isAdminViewer && !readOnly} />
          </div>
          <div id="home-details-team" className="scroll-mt-4 space-y-4">
            <ProjectTeamPanel propertyId={current.id} />
            <ProjectScopePanel
              propertyId={current.id}
              propertyName={homeName}
              people={data.people}
              canEdit={canEdit}
              hints={{ planned_closing_on: current.planned_closing_on ?? null }}
            />
          </div>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <VendorCoveragePanel propertyId={current.id} />
          <OnboardingWorkOrdersPanel propertyId={current.id} />
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          {refs["property_folder"] && /^https?:\/\//i.test(refs["property_folder"]) ? (
            <a
              href={refs["property_folder"]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the home folder in SharePoint
            </a>
          ) : null}
          <AttachmentsPanel
            entityType="property"
            entityId={current.id}
            title="Files"
            description="Grouped by type."
            groupByCategory
          />
          <PhotoStrip
            entityType="property"
            entityId={current.id}
            title="Photos"
            limit={16}
          />
          {(data.retiredTasks ?? []).length > 0 && (
            <details className="surface p-4">
              <summary className="cursor-pointer text-sm font-medium">
                Retired and voided Tasks ({data.retiredTasks.length})
              </summary>
              <ul className="mt-3 space-y-1.5">
                {data.retiredTasks.map((t) => (
                  <li key={t.id} className="text-sm">
                    <span className="text-muted-foreground line-through">{t.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t.exception_reason} · {usDate(t.archived_at.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </TabsContent>

        <TabsContent value="budget" className="space-y-4">
          <BudgetFigures
            projectId={projectRow?.id ?? null}
            invoiceStatus={details.invoice_status ?? null}
            canEdit={canEditBoard}
          />
          <BudgetPanel propertyId={current.id} canEdit={canEdit} />
          <FinancialPanel
            propertyId={current.id}
            canEdit={canEdit}
            isAdmin={roles.includes("admin")}
          />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
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
            notes={notes as never}
            uploads={((homeFiles.data?.files ?? []) as {
              id: string;
              title: string;
              original_filename?: string | null;
              created_at?: string;
              uploaded_at?: string;
              uploaded_by_name?: string | null;
              category?: string | null;
              upload_status?: string;
            }[])
              .filter((f) => f.upload_status === "stored")
              .map((f) => ({
                id: f.id,
                title: f.original_filename ?? f.title,
                created_at: f.uploaded_at ?? f.created_at ?? "",
                uploaded_by_name: f.uploaded_by_name ?? null,
                category_label: documentCategoryLabel(f.category ?? null),
              }))}
            title="Activity"
            description="Every task completed, comment, upload and status change for this home, newest first."
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

        {/* Temporary (Part 1): General Info, Design, Agreements and the rest stay reachable until Parts 2 and 3. */}
        <TabsContent value="more" className="space-y-6">
          <section className="space-y-3" aria-label="General Info">
            <h2 className="font-display text-xl">General Info</h2>
            <GeneralInfoFields
              refs={refs}
              ownerRezId={(current as { ownerrez_property_id?: string | number | null }).ownerrez_property_id != null
                ? String((current as { ownerrez_property_id?: string | number | null }).ownerrez_property_id)
                : null}
              owner={
                <Button variant="link" className="h-11 px-0" onClick={() => goTab("owner")}>
                  Open Owner
                </Button>
              }
              canEdit={canEditBoard}
              pending={saveRefs.isPending}
              onSaveRef={(key, value) => {
                if (!projectRow) return;
                const next = { ...refs };
                if (value) next[key] = value;
                else delete next[key];
                saveRefs.mutate({ data: { projectId: projectRow.id, externalRefs: next } } as never);
              }}
            />
            {/* Item 1 (Nov 12): the same fields a Fill in Resolve Task edits in place. */}
            <section className="surface space-y-3 p-4" aria-label="Inspection and cleaner">
              <h3 className="font-semibold">Inspection and cleaner</h3>
              <FillInEditors propertyId={current.id} fields={["inspection_date", "default_cleaner"]} canEdit={canEdit} />
            </section>
            <PropertyFactsPanel propertyId={current.id} canEdit={canEdit} />
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
                  <SelectTrigger className="h-11 w-56">
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
            <AssessmentsFormsPanel
              tasks={tasks as never}
              people={data.people}
              onOpenTask={setOpenTaskId}
            />
            <OwnerViewPreview propertyId={current.id} />
            <AssessmentFindingsPanel
              propertyId={current.id}
              canEdit={canEdit}
              onOpenTask={setOpenTaskId}
            />
          </section>
          <section className="space-y-3" aria-label="Design">
            <h2 className="font-display text-xl">Design</h2>
            <DesignTab propertyId={current.id} />
          </section>
          <section className="space-y-3" aria-label="Agreements">
            <h2 className="font-display text-xl">Agreements</h2>
            <AgreementsTab
              projectId={projectRow?.id ?? null}
              pmaStatus={details.pma_status ?? null}
              canEdit={canEditBoard}
            />
          </section>
          <details className="surface overflow-hidden" open={search.tab === "handoff"} id="handoff">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2 font-semibold">
              Handoff details
            </summary>
            <div className="space-y-4 border-t border-border p-4">
              <CarryoverSummary propertyId={current.id} />
              <TwoStepHandoff
                propertyId={current.id}
                readOnly={readOnly}
                onOpenTask={(id) => setOpenTaskId(id)}
              />
            </div>
          </details>
          <section className="surface flex flex-wrap items-center gap-3 p-4" aria-label="Plan tools">
            <h2 className="min-w-0 flex-1 font-semibold">Plan tools</h2>
            <PlanCsvButton propertyId={current.id} />
            <NewTaskDialog
              propertyId={current.id}
              people={data.people}
              tasks={tasks}
              // Only directors add work to a plan; project managers work the plan.
              disabled={!canEdit || !can("handoff_review")}
              onSave={(values) => saveTask.mutate({ data: values } as never)}
            />
          </section>
        </TabsContent>
      </Tabs>

      <TaskDrawer
        task={openTask}
        tasks={tasks}
        people={data.people}
        propertyName={homeName}
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

/** Roles a new step can go to; the person is whoever holds the role on this home. */
const NEW_TASK_ROLES = [
  { code: "onboarding_director", label: "Director of Onboarding" },
  { code: "onboarding_manager", label: "Onboarding Manager" },
  { code: "onboarding_project_manager", label: "Project Manager" },
  { code: "utilities", label: "Utilities" },
  { code: "lead_designer", label: "Lead Designer" },
  { code: "designer", label: "Designer" },
  { code: "staging_team", label: "Staging Team" },
] as const;

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
  const [role, setRole] = useState("none");
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
          <div className="space-y-1">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No role</SelectItem>
                {NEW_TASK_ROLES.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            Needs the homeowner&apos;s approval (sent only when you press Send for approval)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={evidenceRequired}
              onCheckedChange={(v) => setEvidenceRequired(Boolean(v))}
            />
            Needs evidence (a file or a note on where the proof is)
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
                assignedSeat: role === "none" ? null : role,
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
              setRole("none");
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
              : `Required checks pass. The ${carryoverCount} remaining item(s) must be accepted as carryover work with an owner, a due date and a reason. Carryover moves to Operations and no longer belongs to Onboarding.`}
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
