/**
 * Task detail drawer — the operational intelligence a plain task list does not give us.
 *
 * Every field shown already exists on `onboarding_tasks` or the canonical
 * template. The drawer never invents state: it explains what Resolve already
 * decided (release conditions, automatic due dates, evidence gates, owner
 * approvals, Breezeway linkage) and routes edits through the same server
 * functions the previous UI used.
 */

import { useEffect, useState } from "react";
import { TaskWorkspace } from "@/components/ui/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { Separator } from "@/components/ui/separator";
import { OwnerParticipationOffer } from "@/components/OwnerParticipationOffer";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { TaskStageTrail } from "@/components/onboarding/TaskStageTrail";
import { EmailComposer } from "@/components/EmailComposer";
import { GuidedActionCard } from "@/components/GuidedActionCard";
import {
  nextActionableTask,
  onboardingTaskAction,
  type TaskActionId,
} from "@/lib/onboarding-task-action";
import { BreezewayTaskPanel } from "@/components/BreezewayTaskPanel";
import { SendToHomeownerDialog } from "@/components/onboarding/SendToHomeownerDialog";
import { TaskGallery } from "@/components/onboarding/TaskGallery";
import { trackForTask } from "@/lib/onboarding-workstreams";
import { stateChip } from "@/lib/semantic";
import { repairApprovalGuidance } from "@/lib/onboarding-scope";
import type { ReleaseContext } from "@/lib/onboarding-state";
import { stageLabel } from "@/lib/onboarding";
import {
  STATUS_LABEL,
  STATUS_STATE,
  assigneeLabel,
  dueExplanation,
  viewTask,
  whyThisTaskExists,
  type WorkflowTask,
} from "@/lib/onboarding-workflow";
import { usDate, usDateTime } from "@/lib/dates";

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
  onSubmitApproval,
  onRecordOwnerDecision,

  onRecordException,
  onReopen,
  onAddObservation,
  onAdvance,
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
}) {
  const [evidence, setEvidence] = useState("");
  const [due, setDue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [approvalVersion, setApprovalVersion] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionEvidence, setDecisionEvidence] = useState("");
  const [exception, setException] = useState("");
  const [observation, setObservation] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    setEvidence(task?.evidence_note ?? "");
    setDue(task?.due_on ?? "");
    setOverrideReason("");
    setApprovalVersion("");
    setApprovalNote("");
    setDecisionNote("");
    setDecisionEvidence("");
    setException("");
    setObservation("");
    setReopenReason("");
  }, [task?.id, task?.evidence_note, task?.due_on]);

  if (!task) return null;

  const view = viewTask(task, tasks, release);
  // One canonical approval record per request — the drawer must never look
  // like a request that already went out has never been sent.
  const taskApprovals = approvals
    .filter((a) => a.entity_id === task.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const openApproval = taskApprovals.find((a) => a.status === "pending") ?? null;
  const lastApproval = taskApprovals[0] ?? null;
  const why = whyThisTaskExists(view, tasks);
  const subtasks = tasks.filter((t) => t.parent_task_id === task.id);
  const deps = (task.depends_on ?? [])
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is WorkflowTask => Boolean(t));
  const downstream = tasks.filter((t) => (t.depends_on ?? []).includes(task.id));
  const evidenceMissing = task.evidence_required && !(task.evidence_note ?? "").trim();
  const awaitingOwner = task.requires_owner_approval && task.owner_approval_status !== "approved";
  const dueChanged = (due || null) !== (task.due_on ?? null);
  // Design and listing work is looked at, not read — those drawers get the gallery.
  const track = trackForTask({ title: task.title, stage: task.stage });
  const visualTrack = track === "furnishing_staging" || track === "media_listing";

  // One guided step at a time — the same pattern as the ticket workspace.
  // Every effect below routes through the callbacks this drawer already uses,
  // so the release, evidence and approval rules stay the single authority.
  const t: WorkflowTask = task;
  const action = onboardingTaskAction(view);
  const nextTask = nextActionableTask(t, tasks, release);

  const advance = () => {
    if (nextTask && onAdvance) onAdvance(nextTask.id);
  };

  const finishesStep = action?.id === "complete_task" || action?.id === "reopen_or_move_on";

  const runAction = (id: TaskActionId, values: Record<string, string>) => {
    const text = (k: string) => (values[k] ?? "").trim();
    if (id === "clear_blocker") {
      onAddObservation(t.id, text("update"));
      onSave(
        taskPayload(t, {
          blocker: values["outcome"] === "cleared" ? "" : text("update"),
        }),
      );
      return true;
    }
    if (id === "capture_evidence") {
      onSave(taskPayload(t, { evidenceNote: text("evidence") }));
      return true;
    }
    if (id === "send_for_approval" || id === "resubmit_for_approval") {
      onSubmitApproval(t.id, text("version"), text("note"));
      return true;
    }
    if (id === "record_owner_answer") {
      onRecordOwnerDecision(
        t.id,
        values["decision"] === "approved",
        text("note"),
        text("evidence_url"),
      );
      return true;
    }
    if (id === "complete_task") {
      if (text("observation")) onAddObservation(t.id, text("observation"));
      onSave(taskPayload(t, { status: "complete", blocker: "" }));
      advance();
      return true;
    }
    if (id === "reopen_or_move_on") {
      advance();
      return true;
    }
    return false;
  };

  const guidedCard = action ? (
    <GuidedActionCard
      action={{
        ...action,
        ...(nextTask && finishesStep ? { then: `Next: ${nextTask.title}` } : {}),
      }}
      readOnly={disabled}
      successMessage={
        nextTask && action.id === "complete_task"
          ? `Step recorded — next: ${nextTask.title}`
          : "Step recorded."
      }
      onHandoff={() =>
        document
          .getElementById("task-detail-body")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      onComplete={(values) => runAction(action.id, values)}
    />
  ) : null;

  return (
    <TaskWorkspace
      open
      onOpenChange={(v) => !v && onClose()}
      title={task.title}
      headerExtra={
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip className={stateChip(STATUS_STATE[view.status])}>
              {STATUS_LABEL[view.status]}
            </Chip>
            {view.overdue && view.status !== "complete" && (
              <Chip className={stateChip("blocked")}>Overdue</Chip>
            )}
            <span className="text-xs text-muted-foreground">
              {propertyName} · {stageLabel(task.stage)}
            </span>
          </div>
          {view.reason && <p className="mt-1 text-xs text-muted-foreground">{view.reason}</p>}
        </>
      }
      footer={
        <>
          {task.status !== "complete" ? (
            <div className="flex flex-1 flex-col gap-1">
              <Button
                className="w-full"
                disabled={
                  disabled ||
                  !view.canComplete ||
                  view.waitingOn.length > 0 ||
                  evidenceMissing ||
                  awaitingOwner
                }
                onClick={() => onSave(taskPayload(task, { status: "complete", blocker: "" }))}
              >
                Mark complete
              </Button>
              {!view.canComplete && view.reason && (
                <p className="text-xs text-muted-foreground">{view.reason}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-1.5">
              <Input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Why is this being reopened?"
              />
              <Button
                variant="secondary"
                disabled={disabled || reopenReason.trim().length < 3}
                onClick={() => onReopen(task.id, reopenReason.trim())}
              >
                Reopen with reason
              </Button>
            </div>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <SendToHomeownerDialog
            taskId={task.id}
            taskTitle={task.title}
            disabled={disabled || task.owner_approval_status === "approved"}
            alreadyWaiting={task.owner_approval_status === "awaiting_owner"}
          />
          {task.owner_approval_status === "awaiting_owner" && (
            <span className="text-xs text-muted-foreground">
              Waiting on the homeowner since the last send.
            </span>
          )}
        </div>

        {visualTrack && <TaskGallery taskId={task.id} />}

        {/*
         * Finishing comes last. Anything that unblocks the step stays at the
         * top where it is read first; the card that closes the step sits at the
         * bottom, after the instructions, so the drawer reads in work order.
         */}
        {action && !finishesStep && guidedCard}

        <div id="task-detail-body" />

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Assignee" value={assigneeLabel(task, people)} />
          <Field
            label="Due date"
            value={task.due_on ?? "—"}
            hint={dueExplanation(task) ?? undefined}
          />
          <Field label="Blocks handoff" value={task.blocks_handoff ? "Yes" : "No"} />
          <Field
            label="Owner approval"
            value={
              task.requires_owner_approval
                ? task.owner_approval_status === "approved"
                  ? "Approved"
                  : task.owner_approval_status === "awaiting_owner"
                    ? "Waiting on homeowner"
                    : task.owner_approval_status === "changes_requested"
                      ? "Changes requested"
                      : "Required"
                : "Not required"
            }
          />
        </dl>

        {/* Why this task exists — the plain-language automation story. */}
        <section className="sunken rounded-lg p-3">
          <p className="eyebrow">Why this task exists</p>
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {why.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </section>

        {repairApprovalGuidance(task.title) && (
          <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
            {repairApprovalGuidance(task.title)}
          </p>
        )}

        {task.detail && (
          <section>
            <p className="eyebrow">Instructions</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{task.detail}</p>
          </section>
        )}

        {(deps.length > 0 || downstream.length > 0) && (
          <section className="space-y-1">
            <p className="eyebrow">Dependencies &amp; release</p>
            {deps.map((d) => (
              <p key={d.id} className="text-sm">
                <span className="text-muted-foreground">Waits for </span>
                {d.title}
                <span className="text-muted-foreground">
                  {" "}
                  — {d.status === "complete" ? "complete" : "not complete"}
                </span>
              </p>
            ))}
            {downstream.map((d) => (
              <p key={d.id} className="text-sm text-muted-foreground">
                Releases {d.title}
              </p>
            ))}
          </section>
        )}

        {subtasks.length > 0 && (
          <section className="space-y-1">
            <p className="eyebrow">Subtasks</p>
            {subtasks.map((s) => (
              <p key={s.id} className="text-sm">
                {s.status === "complete" ? "✓" : "·"} {s.title}
              </p>
            ))}
          </section>
        )}

        <Separator />

        {/* Evidence gate */}
        <section className="space-y-2">
          <p className="eyebrow">
            {task.evidence_required ? "Evidence required before completion" : "Notes & files"}
          </p>
          {evidenceMissing && (
            <p className="text-sm text-state-blocked">
              Required evidence is missing — this task cannot be marked complete.
            </p>
          )}
          <Textarea
            rows={3}
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="What proves this is done — photo location, document name, meter reading, confirmation number."
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={
              disabled ||
              evidence.trim().length < 3 ||
              evidence.trim() === (task.evidence_note ?? "")
            }
            onClick={() => onSave(taskPayload(task, { evidenceNote: evidence.trim() }))}
          >
            Save evidence
          </Button>
          <AttachmentsPanel
            entityType="onboarding_task"
            entityId={task.id}
            title="Photos & documents"
          />
        </section>

        <Separator />

        <TaskStageTrail taskId={task.id} />

        <Separator />

        {/* Native capture: what the person actually found in the home. */}
        <section className="space-y-2">
          <p className="eyebrow">What did you find?</p>
          <p className="text-xs text-muted-foreground">
            Record the observation here, in Resolve — not in a separate form. It stays on this step
            and on the home&apos;s history.
          </p>
          <Textarea
            rows={2}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Condition, measurement, missing item, something the next person needs to know."
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled || observation.trim().length < 3}
            onClick={() => {
              onAddObservation(task.id, observation.trim());
              setObservation("");
            }}
          >
            Record observation
          </Button>
        </section>

        <Separator />

        {/* Management-only date edits; the current date remains visible above. */}
        {canManageTask && (
          <section className="space-y-2">
            <p className="eyebrow">Due date</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="w-44"
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={
                  disabled || !dueChanged || !task.updated_at || overrideReason.trim().length < 3
                }
                onClick={() => {
                  if (task.updated_at)
                    onSaveDate(task.id, task.updated_at, due || null, overrideReason.trim());
                }}
              >
                Save date
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Reason for changing the due date (required)
              </Label>
              <Input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Why does this task need a different date?"
              />
            </div>
          </section>
        )}

        {task.requires_owner_approval && task.owner_approval_status !== "approved" && (
          <>
            <Separator />
            {lastApproval && (
              <section className="space-y-1 rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip
                    className={stateChip(
                      lastApproval.status === "approved"
                        ? "done"
                        : lastApproval.status === "pending"
                          ? "waiting"
                          : "info",
                    )}
                  >
                    {lastApproval.status === "pending"
                      ? "Request sent — waiting on the homeowner"
                      : lastApproval.status === "approved"
                        ? "Approved"
                        : "Changes requested"}
                  </Chip>
                  <span className="numeric text-xs text-muted-foreground">
                    Sent {usDate(lastApproval.created_at)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Channel:{" "}
                  {task.owner_approval_status === "awaiting_owner"
                    ? "Recorded on the canonical approval record — Active Owner portal or Resolve-generated email."
                    : "Canonical approval record."}
                  {lastApproval.decided_at
                    ? ` Decided ${usDateTime(lastApproval.decided_at)}.`
                    : ""}
                </p>
                {lastApproval.decision_note && (
                  <p className="text-xs text-muted-foreground">{lastApproval.decision_note}</p>
                )}
              </section>
            )}

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="eyebrow">
                  {openApproval ? "Resend this request" : "Send to the homeowner"}
                </p>
                {/* Write to the homeowner with the home and their name already filled in. */}
                <EmailComposer
                  context="onboarding_task"
                  recordId={task.id}
                  label="Write to the homeowner"
                />
              </div>
              <Input
                value={approvalVersion}
                onChange={(e) => setApprovalVersion(e.target.value)}
                placeholder="Version being reviewed — e.g. Mood boards v2"
              />
              <Textarea
                rows={2}
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="What the homeowner is being asked to approve."
              />
              <p className="text-xs text-muted-foreground">
                An enrolled Active Owner sees this in their portal. A standard homeowner gets a
                Resolve-generated email — they never need Resolve access to answer. Either way it is
                the same approval record. Sending alone does not complete the step.
              </p>
              <Button
                size="sm"
                variant="secondary"
                disabled={disabled || approvalVersion.trim().length < 2}
                onClick={() =>
                  onSubmitApproval(task.id, approvalVersion.trim(), approvalNote.trim())
                }
              >
                {openApproval
                  ? "Resend request"
                  : task.owner_approval_status === "changes_requested"
                    ? "Resubmit for approval"
                    : "Send for approval"}
              </Button>
            </section>

            {task.owner_approval_status === "awaiting_owner" && (
              <section className="space-y-2 rounded-lg border border-border p-3">
                <p className="eyebrow">Record the homeowner&apos;s answer</p>
                <p className="text-xs text-muted-foreground">
                  When the homeowner replies by email or phone, record it here. It is written to the
                  same approval record with your name and the time.
                </p>
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
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={disabled || decisionNote.trim().length < 3}
                    onClick={() =>
                      onRecordOwnerDecision(
                        task.id,
                        true,
                        decisionNote.trim(),
                        decisionEvidence.trim(),
                      )
                    }
                  >
                    Homeowner approved
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={disabled || decisionNote.trim().length < 3}
                    onClick={() =>
                      onRecordOwnerDecision(
                        task.id,
                        false,
                        decisionNote.trim(),
                        decisionEvidence.trim(),
                      )
                    }
                  >
                    Changes requested
                  </Button>
                </div>
              </section>
            )}
          </>
        )}

        <Separator />

        <Separator />
        <section className="space-y-2">
          <p className="eyebrow">Active Owner</p>
          <OwnerParticipationOffer source="onboarding" sourceId={task.id} />
        </section>

        <section className="space-y-2">
          <p className="eyebrow">Breezeway</p>
          <BreezewayTaskPanel
            sourceType="onboarding_task"
            sourceId={task.id}
            defaultTitle={task.title}
            defaultDescription={task.detail ?? null}
          />
        </section>

        {canRecordException && !task.exception_reason && (
          <>
            <Separator />
            <section className="space-y-2">
              <p className="eyebrow">Authorised exception</p>
              <Textarea
                rows={2}
                value={exception}
                onChange={(e) => setException(e.target.value)}
                placeholder="Why is this requirement being waived, and who approved it?"
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || exception.trim().length < 3}
                onClick={() => onRecordException(task.id, exception.trim())}
              >
                Record exception
              </Button>
            </section>
          </>
        )}
      </div>
    </TaskWorkspace>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="text-sm">{value}</dd>
      {hint && <dd className="text-[0.6875rem] text-muted-foreground">{hint}</dd>}
    </div>
  );
}
