/**
 * Task drawer: the same top and bottom on every onboarding Task; only the middle
 * changes with the kind of Task (ordinary, work order, goes to the homeowner).
 * Everything else folds under Details.
 *
 * Presentation only. Every effect routes through the same server functions the
 * previous drawer used, so the release, evidence, approval, Breezeway and owner
 * item rules stay the single authority.
 */
import { OpenPhotosFolderButton } from "@/components/property/MarketingPhotosButtons";
import { isPhotoStep } from "@/lib/marketing-photos";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { takeOnboardingTask } from "@/lib/onboarding-team.functions";
import { TaskWorkspace } from "@/components/ui/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/page";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OwnerParticipationOffer } from "@/components/OwnerParticipationOffer";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { LinkedStepFiles } from "@/components/onboarding/LinkedStepFiles";
import { TaskStageTrail } from "@/components/onboarding/TaskStageTrail";
import { TaskTeamComments } from "@/components/onboarding/TaskTeamComments";
import { BreezewayTaskPanel } from "@/components/BreezewayTaskPanel";
import { BreezewayHomeLink, OnboardingBreezewaySection } from "@/components/onboarding/OnboardingBreezewaySection";
import { showsBreezewayHomeLink } from "@/lib/onboarding-breezeway";
import { evidenceSatisfied } from "@/lib/onboarding-evidence";
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { bulkUpdateHomeTasksFn, markTaskStartedFn } from "@/lib/onboarding.functions";
import { SendToHomeownerSection, sendFormId } from "@/components/onboarding/SendToHomeownerDialog";
import { OpenFormButton, TaskKindMiddle, missingFillFields, outsideEvidence, useFillIn, type OutsideDraft } from "@/components/onboarding/TaskKindMiddle";
import { EmailComposer } from "@/components/EmailComposer";
import { readTaskKindFn } from "@/lib/onboarding-task-kinds.functions";
import {
  completionBlock,
  drawerMiddle,
  effectiveTaskKind,
  firstLink,
  isOutsideForm,
  isTaskKind,
  mainButtonLabel,
  type TaskKindCode,
} from "@/lib/onboarding-task-kinds";
import { loadHomeProgramStatus } from "@/lib/ao-data";
import { canSendToActiveOwner } from "@/lib/ao-engine";
import { stripPlanRoleLine } from "@/lib/task-drawer";
import { FollowUpTask } from "@/components/onboarding/FollowUpTask";
import { loadTaskOwnerSend, loadTaskPlanCard } from "@/lib/ao-data";
import { TaskVerifyBadge } from "@/components/ao/TaskPlanLink";
import { TaskGallery } from "@/components/onboarding/TaskGallery";
import { ReviewAwareComplete, TaskReviewPanel } from "@/components/onboarding/TaskReviewPanel";
import { trackForTask } from "@/lib/onboarding-workstreams";
import { showsBreezeway, taskKind, uploadHint } from "@/lib/onboarding-task-kind";
import { FUNCTIONAL_ROLES, roleLabel } from "@/lib/v2-workflow.functions";
import { completeHint, drawerKind, dueChip, firstLines, startedLabel, stepsDone } from "@/lib/task-drawer";
import { stateChip } from "@/lib/semantic";
import { repairApprovalGuidance } from "@/lib/onboarding-scope";
import type { ReleaseContext } from "@/lib/onboarding-state";
import { stageLabel } from "@/lib/onboarding";
import { STATUS_LABEL, STATUS_STATE, assigneeLabel, viewTask, type WorkflowTask } from "@/lib/onboarding-workflow";
import { usDate, usDateTime } from "@/lib/dates";

/** Assign to me: the Director (or leadership) takes any onboarding Task. */
function TakeTaskButton({ taskId, assignedTo }: { taskId: string; assignedTo: string | null }) {
  const { userId } = useRole();
  const take = useServerFn(takeOnboardingTask);
  const router = useRouter();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => take({ data: { taskId } }),
    onSuccess: () => {
      toast.success("This Task is now yours.");
      void qc.invalidateQueries();
      void router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "The Task could not be assigned to you."),
  });
  if (!userId || assignedTo === userId) return null;
  return (
    <Button variant="secondary" size="sm" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate()}>
      Assign to me
    </Button>
  );
}

export type SaveTaskInput = {
  id: string;
  propertyId: string;
  stage: string;
  title: string;
  detail: string;
  assignedTo: string | null;
  dueOn: string | null;
  sortOrder: number;
  blocker: string;
  requiresOwnerApproval: boolean;
  ownerApprovalStatus:
    "not_required" | "pending" | "awaiting_owner" | "changes_requested" | "approved" | "declined";
  evidenceRequired: boolean;
  evidenceNote: string;
  status: "open" | "blocked" | "complete" | "carryover";
  blocksHandoff: boolean;
  parentTaskId: string | null;
  dependsOn: string[];
  linkedTicketId: string | null;
};

/** Full row payload the save function expects, with one field changed. */
export function taskPayload(t: WorkflowTask, patch: Partial<SaveTaskInput> = {}): SaveTaskInput {
  return {
    id: t.id,
    propertyId: t.property_id,
    stage: t.stage,
    title: t.title,
    detail: t.detail ?? "",
    assignedTo: t.assigned_to,
    dueOn: t.due_on,
    sortOrder: t.sort_order,
    blocker: t.blocker ?? "",
    requiresOwnerApproval: t.requires_owner_approval,
    ownerApprovalStatus: (t.owner_approval_status ??
      "pending") as SaveTaskInput["ownerApprovalStatus"],
    evidenceRequired: t.evidence_required,
    evidenceNote: t.evidence_note ?? "",
    status: (t.status ?? "open") as SaveTaskInput["status"],
    blocksHandoff: t.blocks_handoff,
    parentTaskId: t.parent_task_id,
    dependsOn: t.depends_on ?? [],
    linkedTicketId: t.linked_ticket_id,
    ...patch,
  };
}

export function TaskDrawer({
  task,
  tasks,
  people,
  propertyName,
  disabled,
  canRecordException,
  canManageTask,
  onClose,
  onSave,
  onSaveDate,
  onRecordOwnerDecision,

  onRecordException,
  onReopen,
  onAddObservation,
  onAdvance,
  onVoid,
  release,
  approvals = [],
}: {
  task: WorkflowTask | null;
  tasks: WorkflowTask[];
  people: { id: string; full_name: string | null; email: string | null }[];
  propertyName: string;
  disabled: boolean;
  canRecordException: boolean;
  canManageTask: boolean;
  onClose: () => void;
  onSave: (input: SaveTaskInput) => void;
  onSaveDate: (
    taskId: string,
    expectedUpdatedAt: string,
    dueOn: string | null,
    reason: string,
  ) => void;
  onSubmitApproval: (taskId: string, version: string, note: string) => void;
  onRecordOwnerDecision: (
    taskId: string,
    approved: boolean,
    note: string,
    evidenceUrl: string,
  ) => void;
  onRecordException: (taskId: string, reason: string) => void;
  onReopen: (taskId: string, reason: string) => void;
  onAddObservation: (taskId: string, body: string) => void;
  /** Open the next step in this home's plan, straight after this one is finished. */
  onAdvance?: (taskId: string) => void;
  /** Mark a step not needed for this home (supervisors only). */
  onVoid?: (taskId: string, reason: string) => void;
  /** Authoritative release context; without it nothing may be completed early. */
  release?: ReleaseContext;
  /** Canonical owner approval records already raised for this task. */
  approvals?: {
    id: string;
    entity_id: string | null;
    status: string;
    created_at: string;
    decided_at: string | null;
    decision_note: string | null;
    detail?: string | null;
  }[];
}) {  const [evidence, setEvidence] = useState("");
  const [due, setDue] = useState("");
  const [dueOpen, setDueOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionEvidence, setDecisionEvidence] = useState("");
  const [exception, setException] = useState("");
  const [observation, setObservation] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [fullOpen, setFullOpen] = useState(false);
  const [outside, setOutside] = useState<OutsideDraft>({ where: null, proof: "", note: "" });
  const [ownerReady, setOwnerReady] = useState(false);
  const [topReopen, setTopReopen] = useState(false);
  const { userId, isAdmin, isOnboardingDirector } = useRole();
  const qc = useQueryClient();
  const router = useRouter();
  // Same list (and cache key) the Task's file panel reads: a stored file is proof.
  const listFiles = useServerFn(listAttachmentsFn);
  const stepFiles = useQuery({
    queryKey: ["attachments", "onboarding_task", task?.id ?? "none"],
    queryFn: () => listFiles({ data: { entityType: "onboarding_task", entityId: task!.id } }),
    enabled: Boolean(task?.id),
  });
  const fileCount = (stepFiles.data?.files ?? []).filter(
    (f) => f.upload_status === "stored" && !f.archived_at,
  ).length;
  const ownerSend = useQuery({
    queryKey: ["task-owner-send", task?.id ?? "none"],
    queryFn: () => loadTaskOwnerSend(task!.id),
    enabled: Boolean(task?.id),
    retry: false,
  });
  const planCard = useQuery({
    queryKey: ["ao-task-plan", task?.id ?? "none"],
    queryFn: () => loadTaskPlanCard(task!.id),
    enabled: Boolean(task?.id),
    retry: false,
  });
  // Nov 12 kinds: the stored kind once staged file 01 is applied, else the approved rule.
  const readKind = useServerFn(readTaskKindFn);
  const kindQ = useQuery({
    queryKey: ["task-kind", task?.id ?? "none"],
    queryFn: () => readKind({ data: { taskId: task!.id } }),
    enabled: Boolean(task?.id),
    retry: false,
  });
  const programQ = useQuery({
    queryKey: ["ao-program-status", task?.property_id ?? "none"],
    queryFn: () => loadHomeProgramStatus(task!.property_id),
    enabled: Boolean(task?.property_id),
  });
  const storedKind = kindQ.data?.ready && isTaskKind(kindQ.data.kind) ? (kindQ.data.kind as TaskKindCode) : null;
  const settings = kindQ.data?.ready ? kindQ.data.settings : {};
  const fillQ = useFillIn(task?.property_id ?? "", settings.fields ?? [], storedKind === "fill_in" && Boolean(task?.property_id));
  // Role changes use the same people rule and transaction as Edit selected.
  const canAssignRole = useQuery({
    queryKey: ["can-bulk-edit-home-tasks", task?.property_id ?? "none"],
    enabled: Boolean(task?.property_id) && !disabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_bulk_edit_home_tasks", { _property_id: task!.property_id });
      if (error) return false;
      return data === true;
    },
  });
  const bulk = useServerFn(bulkUpdateHomeTasksFn);
  const setRole = useMutation({
    mutationFn: (role: string | null) =>
      bulk({ data: { propertyId: task!.property_id, taskIds: [task!.id], patch: { role } } }),
    onSuccess: () => {
      toast.success("Role changed.");
      void qc.invalidateQueries();
      void router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "The role could not be changed."),
  });
  const markStarted = useServerFn(markTaskStartedFn);
  const started = useMutation({
    mutationFn: () => markStarted({ data: { taskId: task!.id } }),
    onSuccess: () => {
      void qc.invalidateQueries();
      void router.invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "This Task could not be marked started."),
  });

  useEffect(() => {
    setEvidence(task?.evidence_note ?? "");
    setDue(task?.due_on ?? "");
    setDueOpen(false);
    setOverrideReason("");
    setDecisionNote("");
    setDecisionEvidence("");
    setException("");
    setObservation("");
    setReopenReason("");
    setVoidOpen(false);
    setVoidReason("");
    setFullOpen(false);
    setTopReopen(false);
  }, [task?.id, task?.evidence_note, task?.due_on]);
  useEffect(() => {
    setOutside({ where: (settings.where as OutsideDraft["where"]) ?? null, proof: "", note: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, settings.where]);
  // Fix 11/12: a link from Owner Completions opens the drawer at the owner conversation.
  useEffect(() => {
    if (!task?.id || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("at") !== "conversation") return;
    const t = setTimeout(() => document.getElementById(`owner-conversation-${task.id}`)?.scrollIntoView({ block: "start" }), 400);
    return () => clearTimeout(t);
  }, [task?.id]);

  if (!task) return null;

  const view = viewTask({ ...task, evidence_file_count: fileCount }, tasks, release);
  const lastApproval =
    approvals
      .filter((a) => a.entity_id === task.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
  const subtasks = tasks.filter((t) => t.parent_task_id === task.id);
  const deps = (task.depends_on ?? [])
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is WorkflowTask => Boolean(t));
  const downstream = tasks.filter((t) => (t.depends_on ?? []).includes(task.id));
  const evidenceMissing =
    task.evidence_required && !evidenceSatisfied({ note: task.evidence_note, fileCount });
  const proofOk = evidenceSatisfied({ note: evidence, fileCount });
  const awaitingOwner = task.requires_owner_approval && task.owner_approval_status !== "approved";
  const dueChanged = (due || null) !== (task.due_on ?? null);
  const track = trackForTask({ title: task.title, stage: task.stage });
  const visualTrack = track === "furnishing_staging" || track === "media_listing";
  const tags = (task.tags ?? []) as string[];
  const ownerItem = ownerSend.data?.available ? ownerSend.data.data : null;
  const linkedCard = planCard.data?.available ? planCard.data.data : null;
  const kind = drawerKind({
    title: task.title,
    requires_owner_approval: task.requires_owner_approval,
    owner_dependency: task.owner_dependency,
    tags,
    hasOwnerItem: Boolean(ownerItem),
    hasPlanCard: Boolean(linkedCard),
  });
  // The kind decides the middle, the main button and the completion rule.
  const code: TaskKindCode =
    ownerItem ? "send_to_owner" : storedKind ?? (kind === "homeowner" ? "send_to_owner" : effectiveTaskKind(task));
  const hasPortal = canSendToActiveOwner(programQ.data);
  const middle = drawerMiddle(code, settings, hasPortal);
  const dispatchable = showsBreezeway({ title: task.title, detail: task.detail });
  const finished = task.status === "complete" || task.status === "carryover";
  const sentToOwner = middle === "send_to_owner" && (Boolean(ownerItem) || task.owner_approval_status === "awaiting_owner");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const dueText = dueChip(task.due_on, task.status, today);
  const hasStartedColumn = "started_at" in task;
  const startedAt = (task as WorkflowTask & { started_at?: string | null }).started_at ?? null;
  const detailText = stripPlanRoleLine(task.detail);
  const instructions = firstLines(detailText);
  const formLink = isOutsideForm(task.title) ? firstLink(task.detail) : null;
  const fullExtra = Boolean(
    instructions.more || task.description || task.done_when || repairApprovalGuidance(task.title) ||
      (task.video_url && /^https:\/\//.test(task.video_url)),
  );
  const fullInstructions = (
    <div className="space-y-3 text-sm">
      {detailText && <p className="whitespace-pre-wrap text-muted-foreground">{detailText}</p>}
      {task.description && <p className="whitespace-pre-wrap text-muted-foreground">{task.description}</p>}
      {task.done_when && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          <span className="font-medium text-foreground">Done when: </span>
          {task.done_when}
        </p>
      )}
      {repairApprovalGuidance(task.title) && (
        <p className="text-xs text-muted-foreground">{repairApprovalGuidance(task.title)}</p>
      )}
      {task.video_url && /^https:\/\//.test(task.video_url) && (
        <a href={task.video_url} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
          Watch the how-to video
        </a>
      )}
    </div>
  );
  const kindBlock = completionBlock(middle, {
    proofNote: evidence,
    fileCount,
    evidenceRequired: task.evidence_required,
    missingFields: middle === "fill_in" ? missingFillFields(settings.fields ?? [], fillQ.data?.filled) : [],
    where: outside.where,
    outsideProof: outside.proof,
    sent: false,
    approved: true,
  });
  const releaseHint = !view.canComplete && !evidenceMissing && !awaitingOwner ? view.reason ?? "Not workable yet." : null;
  const hint = finished
    ? null
    : middle === "do_it" || middle === "work_order" || middle === "send_to_owner"
      ? middle === "send_to_owner"
        ? ownerReady ? null : releaseHint ?? "Write what you're asking (20 characters or more)."
        : middle === "work_order"
          ? kindBlock
          : kindBlock ?? completeHint({
              kind: "ordinary",
              releaseBlocked: !evidenceMissing && !view.canComplete && !awaitingOwner,
              reason: view.reason,
              evidenceMissing: false,
              proofOk: true,
              awaitingOwner,
            })
      : middle === "email" || middle === "approval"
        ? releaseHint
        : kindBlock ?? releaseHint;
  const complete = (note?: string) =>
    onSave(
      taskPayload(task, {
        status: "complete",
        blocker: "",
        ...(note ? { evidenceNote: note } : evidence.trim() ? { evidenceNote: evidence.trim() } : {}),
      }),
    );
  const completerId = (task as WorkflowTask & { completed_by?: string | null }).completed_by ?? null;
  const completedBy = completerId ? people.find((p) => p.id === completerId) : null;
  const canReopenTop = Boolean(isAdmin || isOnboardingDirector || (userId && completerId === userId));
  const scrollToFiles = () =>
    document.getElementById(`task-files-${task.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <TaskWorkspace
      open
      placement="center"
      onOpenChange={(v) => !v && onClose()}
      title={task.title}
      headerExtra={
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {propertyName} · {stageLabel(task.stage)}
          </p>
          {finished && (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p>
                Completed by {completedBy?.full_name || completedBy?.email || "a teammate"}
                {task.completed_at ? ` on ${usDate(task.completed_at)}` : ""}
              </p>
              {canReopenTop && !disabled && (
                topReopen ? (
                  <div className="flex flex-wrap gap-2">
                    <Input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Why is this being reopened?" className="h-11 w-full sm:w-72" aria-label="Reason for reopening" />
                    <Button className="min-h-11" size="sm" disabled={reopenReason.trim().length < 3} onClick={() => onReopen(task.id, reopenReason.trim())}>Reopen</Button>
                    <Button className="min-h-11" size="sm" variant="ghost" onClick={() => setTopReopen(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button className="min-h-11" size="sm" variant="secondary" onClick={() => setTopReopen(true)}>Reopen</Button>
                )
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className={stateChip(STATUS_STATE[view.status])}>
              {startedAt && view.status !== "complete" && !view.overdue ? "Started" : STATUS_LABEL[view.status]}
            </Chip>
            {dueText && (
              <Chip className={stateChip(dueText.startsWith("Overdue") ? "blocked" : "waiting")}>{dueText}</Chip>
            )}
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <p className="eyebrow">Assigned to</p>
              {canAssignRole.data && !finished ? (
                <Select
                  value={task.assigned_seat ?? "none"}
                  onValueChange={(v) => setRole.mutate(v === "none" ? null : v)}
                  disabled={setRole.isPending}
                >
                  <SelectTrigger className="h-11 w-full" aria-label="Assigned to">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {DRAWER_ROLES.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                    ))}
                    {task.assigned_seat && !DRAWER_ROLES.some((r) => r.code === task.assigned_seat) && (
                      <SelectItem value={task.assigned_seat}>{roleLabel(task.assigned_seat)}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <p>{assigneeLabel(task, people)}</p>
              )}
              {canManageTask && !disabled && !finished && (
                <TakeTaskButton taskId={task.id} assignedTo={task.assigned_to} />
              )}
            </div>
            <div className="space-y-1">
              <p className="eyebrow">Due</p>
              {canManageTask && !disabled && !finished ? (
                dueOpen ? (
                  <div className="space-y-2">
                    <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-11 w-48" aria-label="Due date" />
                    <Input
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Reason for the new date (required)"
                      aria-label="Reason for changing the due date"
                      className="h-11"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="min-h-11"
                        size="sm"
                        disabled={!dueChanged || !task.updated_at || overrideReason.trim().length < 3}
                        onClick={() => {
                          if (task.updated_at) onSaveDate(task.id, task.updated_at, due || null, overrideReason.trim());
                          setDueOpen(false);
                        }}
                      >
                        Save date
                      </Button>
                      <Button className="min-h-11" size="sm" variant="ghost" onClick={() => setDueOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" className="min-h-11" onClick={() => setDueOpen(true)} aria-label="Change the due date">
                    {task.due_on ? usDate(task.due_on) : "Set a date"}
                  </Button>
                )
              ) : (
                <p>{task.due_on ? usDate(task.due_on) : "Not set"}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasStartedColumn && !finished && (
              startedAt ? (
                <span className="text-sm text-muted-foreground">{startedLabel(startedAt, usDate)}</span>
              ) : (
                <Button
                  variant="secondary"
                  className="min-h-11"
                  disabled={disabled || started.isPending}
                  onClick={() => started.mutate()}
                >
                  Mark as started
                </Button>
              )
            )}
            <Link
              to="/onboarding/$propertyId"
              params={{ propertyId: task.property_id }}
              search={{ tab: "info" } as never}
              className="inline-flex min-h-11 items-center text-sm text-primary underline-offset-4 hover:underline"
            >
              Home info
            </Link>
          </div>
        </div>
      }
      footer={
        finished || (middle === "send_to_owner" && sentToOwner) ? undefined : (
          <div className="flex flex-1 flex-col gap-1">
            {middle === "work_order" ? null : middle === "send_to_owner" ? (
              <Button type="submit" form={sendFormId(task.id)} className="min-h-11 w-full" disabled={disabled || !ownerReady}>
                Send to the homeowner
              </Button>
            ) : middle === "email" ? (
              <EmailComposer
                context="onboarding_task"
                recordId={task.id}
                label="Send email"
                variant="primary"
                presetTemplateId={settings.emailTemplateId ?? null}
                bracketFillIns
                disabled={disabled || Boolean(releaseHint)}
                onSent={(info) => complete(`Email sent to ${info.to}: ${info.subject}`.slice(0, 1000))}
              />
            ) : (
              <ReviewAwareComplete taskId={task.id} disabled={disabled || Boolean(hint)}>
                <Button
                  className="min-h-11 w-full"
                  disabled={disabled || Boolean(hint)}
                  onClick={() => complete(middle === "outside_resolve" ? outsideEvidence(outside) : undefined)}
                >
                  {mainButtonLabel(middle)}
                </Button>
              </ReviewAwareComplete>
            )}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
        )
      }
    >
      <div className="space-y-5">
        {/* What to do: the first lines, the rest on request. Logins stay exactly as written. */}
        {(detailText || fullExtra || formLink) && (
          <section className="space-y-1">
            <p className="eyebrow">What to do</p>
            {/* Fix 16: the short version, or the full text in its place, never both. */}
            {fullOpen ? fullInstructions : instructions.head && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{instructions.head}</p>}
            {fullExtra && middle !== "send_to_owner" && (
              <Button variant="link" className="h-auto min-h-11 px-0" aria-expanded={fullOpen} onClick={() => setFullOpen((v) => !v)}>
                {fullOpen ? "Show less" : "Show full instructions"}
              </Button>
            )}
            {formLink && <OpenFormButton href={formLink} />}
          </section>
        )}

        {subtasks.length > 0 && (
          <section className="space-y-1">
            <p className="eyebrow">Steps · {stepsDone(subtasks)}</p>
            <ul className="space-y-1">
              {subtasks.map((s) => {
                const done = s.status === "complete";
                return (
                  <li key={s.id} className="flex min-h-11 items-center gap-2">
                    <Checkbox
                      id={`step-${s.id}`}
                      checked={done}
                      disabled={disabled || done}
                      onCheckedChange={() => {
                        // A step that needs proof opens so the proof can be added there.
                        if (s.evidence_required && !s.evidence_note) onAdvance?.(s.id);
                        else onSave(taskPayload(s, { status: "complete", blocker: "" }));
                      }}
                    />
                    <Label htmlFor={`step-${s.id}`} className="text-sm font-normal">{s.title}</Label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section id={`task-files-${task.id}`} className="space-y-2">
          <AttachmentsPanel
            entityType="onboarding_task"
            entityId={task.id}
            title="Files"
            description={middle === "upload_files" && task.done_when ? task.done_when : uploadHint(taskKind({ title: task.title, detail: task.detail }))}
          />
          <LinkedStepFiles taskId={task.id} canManage={canManageTask && !disabled} />
          {isPhotoStep(task.title) && <OpenPhotosFolderButton propertyId={task.property_id} />}
        </section>

        {/* The middle changes with the kind of Task. */}
        {middle === "do_it" && !finished && (
          <section className="space-y-2 rounded-lg border border-border p-4" aria-label="Proof it's done">
            <p className="font-medium">Proof it&apos;s done</p>
            <Label htmlFor={`proof-${task.id}`} className="text-sm">Where is the proof?</Label>
            <Textarea
              id={`proof-${task.id}`}
              rows={2}
              value={evidence}
              disabled={disabled}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="For example: the signed copy is in the home folder."
            />
            <Button variant="link" className="h-auto min-h-11 px-0" onClick={scrollToFiles}>
              Or attach a file
            </Button>
          </section>
        )}

        {!finished && !["do_it", "work_order", "send_to_owner"].includes(middle) && (
          <TaskKindMiddle
            kind={middle}
            settings={settings}
            taskId={task.id}
            propertyId={task.property_id}
            disabled={disabled}
            canEdit={canManageTask}
            plannedClosingOn={null}
            outside={outside}
            onOutside={setOutside}
            onEmailSent={(info) => complete(`Email sent to ${info.to}: ${info.subject}`.slice(0, 1000))}
            onVendorRequested={(vendor, info) => onAddObservation(task.id, `Requested ${vendor} by email: ${info.subject}`.slice(0, 1000))}
          />
        )}

        {middle === "work_order" && (
          <section className="space-y-2" aria-label="Breezeway work order">
            <OnboardingBreezewaySection taskId={task.id} propertyId={task.property_id} disabled={disabled} defaultTitle={task.title} defaultDescription={task.detail ?? null} />
          </section>
        )}

        {middle === "send_to_owner" && (
          <div id={`owner-conversation-${task.id}`}>
          <SendToHomeownerSection
            footerSend
            onReady={setOwnerReady}
            taskId={task.id}
            taskTitle={task.title}
            propertyId={task.property_id}
            disabled={disabled || task.owner_approval_status === "approved"}
            alreadyWaiting={task.owner_approval_status === "awaiting_owner"}
            badge={<TaskVerifyBadge taskId={task.id} />}
          >
            {/* A standard owner answers by email or phone: staff record it on the same approval record. */}
            {!ownerItem && task.requires_owner_approval && task.owner_approval_status === "awaiting_owner" && !disabled && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="eyebrow">Record the homeowner&apos;s answer</p>
                <Textarea
                  rows={2}
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="What they said, and where the answer came from."
                />
                <Input
                  value={decisionEvidence}
                  onChange={(e) => setDecisionEvidence(e.target.value)}
                  placeholder="Link to the reply email or saved document (optional)"
                  className="h-11"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="min-h-11"
                    size="sm"
                    disabled={decisionNote.trim().length < 3}
                    onClick={() => onRecordOwnerDecision(task.id, true, decisionNote.trim(), decisionEvidence.trim())}
                  >
                    Homeowner approved
                  </Button>
                  <Button
                    className="min-h-11"
                    size="sm"
                    variant="outline"
                    disabled={decisionNote.trim().length < 3}
                    onClick={() => onRecordOwnerDecision(task.id, false, decisionNote.trim(), decisionEvidence.trim())}
                  >
                    Changes requested
                  </Button>
                </div>
              </div>
            )}
          </SendToHomeownerSection>
          </div>
        )}

        {!finished && canManageTask && !disabled && (
          <FollowUpTask task={task} people={people} roles={DRAWER_ROLES} />
        )}

        <TaskTeamComments taskId={task.id} propertyId={task.property_id} people={people} disabled={disabled} />

        <Separator />

        {/* Everything else folds under Details. */}
        <details className="space-y-4 text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-muted-foreground">Details</summary>
          <div className="mt-3 space-y-5">
            {middle === "work_order" && !finished && (
              <section className="space-y-2">
                <p className="eyebrow">Proof</p>
                <Label htmlFor={`wo-proof-${task.id}`} className="text-sm">Where is the proof?</Label>
                <Textarea
                  id={`wo-proof-${task.id}`}
                  rows={2}
                  value={evidence}
                  disabled={disabled}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Only when finishing by hand: where the proof is."
                />
                <Button variant="link" className="h-auto min-h-11 px-0" onClick={scrollToFiles}>
                  Or attach a file
                </Button>
              </section>
            )}
            {middle === "send_to_owner" && fullExtra && (
              <section className="space-y-1">
                <p className="eyebrow">Full instructions</p>
                {fullInstructions}
              </section>
            )}

            <section className="space-y-2">
              <p className="eyebrow">What did you find?</p>
              <Textarea
                rows={2}
                value={observation}
                disabled={disabled}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Condition, measurement, missing item, something the next person needs to know."
              />
              <Button
                size="sm"
                variant="secondary"
                className="min-h-11"
                disabled={disabled || observation.trim().length < 3}
                onClick={() => {
                  onAddObservation(task.id, observation.trim());
                  setObservation("");
                }}
              >
                Record observation
              </Button>
            </section>

            {canRecordException && !task.exception_reason && (
              <section className="space-y-2">
                <p className="eyebrow">Exception</p>
                <Textarea
                  rows={2}
                  value={exception}
                  onChange={(e) => setException(e.target.value)}
                  placeholder="Why is this requirement being waived, and who approved it?"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  disabled={disabled || exception.trim().length < 3}
                  onClick={() => onRecordException(task.id, exception.trim())}
                >
                  Record exception
                </Button>
              </section>
            )}

            {middle !== "approval" && <TaskReviewPanel taskId={task.id} />}
            {visualTrack && <TaskGallery taskId={task.id} />}
            {showsBreezewayHomeLink(task.title) && <BreezewayHomeLink propertyId={task.property_id} />}
            {middle !== "work_order" && dispatchable && (
              <section className="space-y-2">
                <p className="eyebrow">Dispatch to a vendor</p>
                <BreezewayTaskPanel
                  sourceType="onboarding_task"
                  sourceId={task.id}
                  defaultTitle={task.title}
                  defaultDescription={task.detail ?? null}
                />
              </section>
            )}
            {tags.includes("active_owner") && (
              <section className="space-y-2">
                <p className="eyebrow">Active Owner participation</p>
                <OwnerParticipationOffer source="onboarding" sourceId={task.id} />
              </section>
            )}

            <section className="space-y-2">
              <p className="eyebrow">History</p>
              {(deps.length > 0 || downstream.length > 0) && (
                <div className="space-y-1">
                  {deps.map((d) => (
                    <p key={d.id}>
                      <span className="text-muted-foreground">Waits for </span>
                      {d.title}
                      <span className="text-muted-foreground"> · {d.status === "complete" ? "complete" : "not complete"}</span>
                    </p>
                  ))}
                  {downstream.map((d) => (
                    <p key={d.id} className="text-muted-foreground">Releases {d.title}</p>
                  ))}
                </div>
              )}
              {lastApproval && (
                <p className="text-muted-foreground">
                  Homeowner request sent {usDate(lastApproval.created_at)}
                  {lastApproval.decided_at ? ` · answered ${usDateTime(lastApproval.decided_at)}` : ""}
                  {lastApproval.decision_note ? ` · ${lastApproval.decision_note}` : ""}
                </p>
              )}
              <TaskStageTrail taskId={task.id} />
            </section>

            {finished && (
              <section className="space-y-2">
                <p className="eyebrow">Reopen</p>
                <Input
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Why is this being reopened?"
                  className="h-11"
                />
                <Button
                  variant="secondary"
                  className="min-h-11"
                  disabled={disabled || reopenReason.trim().length < 3}
                  onClick={() => onReopen(task.id, reopenReason.trim())}
                >
                  Reopen with reason
                </Button>
              </section>
            )}

            {onVoid && canManageTask && !finished && (
              <section className="space-y-2">
                {voidOpen ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="h-11 w-64"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Why is this step not needed?"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="min-h-11"
                      disabled={disabled || voidReason.trim().length < 3}
                      onClick={() => onVoid(task.id, voidReason.trim())}
                    >
                      Void step
                    </Button>
                    <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setVoidOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="min-h-11" disabled={disabled} onClick={() => setVoidOpen(true)}>
                    Void / Not needed
                  </Button>
                )}
              </section>
            )}
          </div>
        </details>
      </div>
    </TaskWorkspace>
  );
}

/** The onboarding roles a Task can be assigned to (the same list Edit selected offers). */
const DRAWER_ROLES = FUNCTIONAL_ROLES.filter((r) =>
  ["onboarding_director", "onboarding_manager", "onboarding_project_manager", "utilities", "lead_designer", "designer", "staging_team"].includes(r.code),
);
