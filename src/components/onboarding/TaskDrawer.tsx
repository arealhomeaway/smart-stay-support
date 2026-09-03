/**
 * Task detail drawer — the operational intelligence Asana does not give us.
 *
 * Every field shown already exists on `onboarding_tasks` or the canonical
 * template. The drawer never invents state: it explains what Resolve already
 * decided (release conditions, automatic due dates, evidence gates, owner
 * approvals, Breezeway linkage) and routes edits through the same server
 * functions the previous UI used.
 */

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { Separator } from "@/components/ui/separator";
import { OwnerParticipationOffer } from "@/components/OwnerParticipationOffer";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { BreezewayTaskPanel } from "@/components/BreezewayTaskPanel";
import { stateChip } from "@/lib/semantic";
import { repairApprovalGuidance } from "@/lib/onboarding-scope";
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

export type SaveTaskInput = {
  id: string;
  propertyId: string;
  stage: string;
  title: string;
  detail: string;
  assignedTo: string | null;
  dueOn: string | null;
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
  onClose,
  onSave,
  onSubmitApproval,
  onRecordException,
  onReopen,
  onAddObservation,
}: {
  task: WorkflowTask | null;
  tasks: WorkflowTask[];
  people: { id: string; full_name: string | null; email: string | null }[];
  propertyName: string;
  disabled: boolean;
  canRecordException: boolean;
  onClose: () => void;
  onSave: (input: SaveTaskInput) => void;
  onSubmitApproval: (taskId: string, version: string, note: string) => void;
  onRecordException: (taskId: string, reason: string) => void;
  onReopen: (taskId: string, reason: string) => void;
  onAddObservation: (taskId: string, body: string) => void;
}) {
  const [evidence, setEvidence] = useState("");
  const [due, setDue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [approvalVersion, setApprovalVersion] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [exception, setException] = useState("");
  const [observation, setObservation] = useState("");
  const [reopenReason, setReopenReason] = useState("");

  useEffect(() => {
    setEvidence(task?.evidence_note ?? "");
    setDue(task?.due_on ?? "");
    setOverrideReason("");
    setApprovalVersion("");
    setApprovalNote("");
    setException("");
    setObservation("");
    setReopenReason("");
  }, [task?.id, task?.evidence_note, task?.due_on]);

  if (!task) return null;

  const view = viewTask(task, tasks);
  const why = whyThisTaskExists(view, tasks);
  const subtasks = tasks.filter((t) => t.parent_task_id === task.id);
  const deps = (task.depends_on ?? [])
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is WorkflowTask => Boolean(t));
  const downstream = tasks.filter((t) => (t.depends_on ?? []).includes(task.id));
  const evidenceMissing = task.evidence_required && !(task.evidence_note ?? "").trim();
  const awaitingOwner = task.requires_owner_approval && task.owner_approval_status !== "approved";
  const dueChanged = (due || null) !== (task.due_on ?? null);

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="pr-6 text-left text-base leading-snug">{task.title}</SheetTitle>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
          {view.reason && <p className="text-left text-xs text-muted-foreground">{view.reason}</p>}
        </SheetHeader>

        <div className="space-y-5 p-4">
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
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {task.detail}
              </p>
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

          {/* Native capture: what the person actually found in the home. */}
          <section className="space-y-2">
            <p className="eyebrow">What did you find?</p>
            <p className="text-xs text-muted-foreground">
              Record the observation here, in Resolve — not in a separate form. It stays on this
              step and on the home&apos;s history.
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

          {/* Due date with override reason */}
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
                  disabled ||
                  !dueChanged ||
                  (Boolean(task.schedule_anchor) && overrideReason.trim().length < 3)
                }
                onClick={() => {
                  onSave(taskPayload(task, { dueOn: due || null }));
                  if (overrideReason.trim().length >= 3)
                    onRecordException(task.id, `Due date override: ${overrideReason.trim()}`);
                }}
              >
                Save date
              </Button>
            </div>
            {task.schedule_anchor && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Override reason (required — this date is calculated automatically)
                </Label>
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Why is the automatic date wrong for this home?"
                />
              </div>
            )}
          </section>

          {task.requires_owner_approval && task.owner_approval_status !== "approved" && (
            <>
              <Separator />
              <section className="space-y-2">
                <p className="eyebrow">Send to the homeowner</p>
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
                  The homeowner&apos;s name, the time, their comments and this version are recorded
                  with the decision. Sending alone does not complete the step.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={disabled || approvalVersion.trim().length < 2}
                  onClick={() =>
                    onSubmitApproval(task.id, approvalVersion.trim(), approvalNote.trim())
                  }
                >
                  {task.owner_approval_status === "changes_requested"
                    ? "Resubmit for approval"
                    : "Send for approval"}
                </Button>
              </section>
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

        <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card p-3">
          {task.status !== "complete" ? (
            <Button
              className="flex-1"
              disabled={disabled || view.waitingOn.length > 0 || evidenceMissing || awaitingOwner}
              onClick={() => onSave(taskPayload(task, { status: "complete", blocker: "" }))}
            >
              Mark complete
            </Button>
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
        </div>
      </SheetContent>
    </Sheet>
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
