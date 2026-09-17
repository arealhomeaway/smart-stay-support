import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, SectionCard } from "@/components/ui/page";
import {
  applyBillingAction,
  type BillingAction,
  type BillingRequest,
  type BillingRole,
  type DepositAction,
} from "@/lib/cleaning-billing";
import {
  writeSyntheticTask,
  type SyntheticCleaningTask,
  type TaskAction,
  type TaskActor,
} from "@/lib/cleaning-workflow";
import {
  deriveSupervisorDailyCounts,
  planCheckoutEvent,
  selectCleaner,
  type ChecklistAnswer,
  type OwnerRezCheckoutEvent,
} from "@/lib/ownerrez-checkout";

export const Route = createFileRoute("/_authenticated/operations-sandbox")({
  component: OperationsSandbox,
});

const syntheticTask: SyntheticCleaningTask = {
  id: "synthetic-clean-1",
  kind: "departure",
  state: "offered",
  assignedUserId: "synthetic-cleaner",
  checklistVersion: "synthetic-only-v1",
  checklistApproved: true,
  correctionRound: 0,
  events: [],
  submissions: [],
  answers: [],
  fields: [
    { id: "walkthrough", kind: "field", responseType: "text", required: true, photoRequired: true },
    { id: "damage", kind: "field", responseType: "yes_no", required: true, photoRequired: false },
    {
      id: "damage_photo",
      kind: "field",
      responseType: "photo",
      required: true,
      photoRequired: true,
      appliesWhen: { fieldId: "damage", equals: "yes" },
    },
  ],
};
const syntheticBilling: BillingRequest = {
  id: "synthetic-billing-1",
  status: "draft",
  requestingPcId: "synthetic-pc",
  proposedAmount: 125,
  approvedAmount: null,
  varianceProposedAmount: null,
  varianceReason: null,
  actualAmount: null,
  depositAmount: 100,
  depositSource: "synthetic-reservation",
  proposedDepositAction: "none",
  approvedDepositAction: null,
  executedDepositAction: null,
  bookingChannel: "synthetic-channel",
  findingCodes: ["CARPET_STAIN"],
  evidenceRefs: ["synthetic-photo-1"],
  cleaningReviewId: "synthetic-review-1",
  cleaningTaskId: "synthetic-clean-1",
  inspectionTaskId: "synthetic-inspection-1",
  reservationRef: "synthetic-booking-1",
  guestCommunicationDraft: "Draft only. No delivery.",
  accountingNotificationDraft: "Draft only. No delivery.",
  ownerrezNotesConfirmed: false,
  resolutionCenterRef: null,
  executionEvidenceRefs: [],
  requiresDirector: false,
  audit: [],
};
const syntheticChange: OwnerRezCheckoutEvent = {
  bookingId: "synthetic-booking-1",
  ownerrezPropertyId: "synthetic-ownerrez-home-1",
  reservationStatus: "changed",
  arrivalAt: "2026-10-01T20:00:00Z",
  checkoutAt: "2026-10-06T15:00:00Z",
  guestIdentityRef: "synthetic-guest-1",
  bookingChannel: "synthetic-channel",
  eventSource: "poll",
  sourceEventId: null,
  payloadVersionOrHash: "synthetic-v2",
};

function OperationsSandbox() {
  const routing = selectCleaner(
    [],
    "synthetic-property-1",
    "OKC",
    "departure",
    syntheticChange.checkoutAt,
  );
  const changedReservation = planCheckoutEvent(syntheticChange, {
    checkoutAt: "2026-10-05T15:00:00Z",
    propertyId: "synthetic-property-1",
    taskState: "accepted",
    hasSubmittedEvidence: false,
  });
  const dailyCounts = deriveSupervisorDailyCounts(
    [
      { kind: "quality_control", workDate: "2026-10-05" },
      { kind: "cleaning", stayNights: 4, workDate: "2026-10-05" },
    ],
    "2026-10-05",
  );
  const [task, setTask] = useState<SyntheticCleaningTask>(syntheticTask);
  const [walkthrough, setWalkthrough] = useState("");
  const [walkthroughPhoto, setWalkthroughPhoto] = useState("");
  const [damage, setDamage] = useState("no");
  const [damagePhoto, setDamagePhoto] = useState("");
  const [correction, setCorrection] = useState("");
  const [billing, setBilling] = useState<BillingRequest>(syntheticBilling);
  const [proposedAmount, setProposedAmount] = useState("125");
  const [depositAction, setDepositAction] = useState<DepositAction>("none");
  const [financeDepositAction, setFinanceDepositAction] = useState<DepositAction>("none");
  const [billingReason, setBillingReason] = useState("Synthetic evidence review");
  const [message, setMessage] = useState("");

  const answers: ChecklistAnswer[] = [
    {
      fieldId: "walkthrough",
      value: walkthrough,
      photoRefs: walkthroughPhoto ? [walkthroughPhoto] : [],
    },
    { fieldId: "damage", value: damage, photoRefs: [] },
    { fieldId: "damage_photo", value: damagePhoto, photoRefs: damagePhoto ? [damagePhoto] : [] },
  ];

  function taskAction(action: TaskAction, actor: TaskActor) {
    try {
      setTask(
        writeSyntheticTask(
          task,
          action,
          actor,
          new Date().toISOString(),
          action === "require_correction" ? correction : action,
          answers,
        ),
      );
      setMessage(`${action.replaceAll("_", " ")} recorded in this browser session only.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action could not be completed.");
    }
  }

  function billingAction(action: BillingAction, role: BillingRole, actorId: string) {
    try {
      setBilling(
        applyBillingAction(
          action === "submit"
            ? {
                ...billing,
                proposedAmount: Number(proposedAmount),
                proposedDepositAction: depositAction,
              }
            : billing,
          action,
          role,
          actorId,
          new Date().toISOString(),
          billingReason,
          action === "supervisor_approve" || action === "director_approve"
            ? (billing.varianceProposedAmount ?? Number(proposedAmount))
            : action === "execute" || action === "request_variance_reapproval"
              ? Number(proposedAmount)
              : null,
          action === "execute" ? ["synthetic-finance-receipt"] : [],
          action === "execute" ? financeDepositAction : null,
        ),
      );
      setMessage(`${action.replaceAll("_", " ")} recorded in this browser session only.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing action could not be completed.");
    }
  }

  function submitChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    taskAction("submit", { id: "synthetic-cleaner", role: "cleaner" });
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Operations synthetic workflow lab"
        description="Local interaction review for workflow design. This page does not read or write operational records."
      />
      <div
        className="rounded-lg border border-amber-500 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
        role="status"
      >
        <strong>Synthetic only · No backend writes · No external delivery.</strong> The checklist
        below is fictional and is not the approved ARHA checklist. Controls simulate roles; they do
        not prove authentication or authorization. Staging acceptance remains blocked.
      </div>
      {message && (
        <p className="rounded-md border p-3 text-sm" aria-live="polite">
          {message}
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Departure clean and review"
          description={`Synthetic task · ${task.state.replaceAll("_", " ")} · correction round ${task.correctionRound}`}
        >
          <div className="space-y-4">
            <p className="text-sm">
              Submission records a snapshot. The PC review remains a separate action.
            </p>
            {task.state === "offered" && (
              <Button
                type="button"
                onClick={() => taskAction("accept", { id: "synthetic-cleaner", role: "cleaner" })}
              >
                Accept synthetic offer
              </Button>
            )}
            {task.state === "accepted" && (
              <Button
                type="button"
                onClick={() => taskAction("begin", { id: "synthetic-cleaner", role: "cleaner" })}
              >
                Begin synthetic clean
              </Button>
            )}
            {(task.state === "in_progress" || task.state === "reopened_in_progress") && (
              <form onSubmit={submitChecklist} className="space-y-4">
                <fieldset className="space-y-3">
                  <legend className="font-medium">Synthetic condition walkthrough</legend>
                  <div>
                    <Label htmlFor="walkthrough">Initial condition *</Label>
                    <Input
                      id="walkthrough"
                      name="walkthrough"
                      value={walkthrough}
                      onChange={(event) => setWalkthrough(event.target.value)}
                      aria-describedby="walkthrough-help"
                    />
                    <p id="walkthrough-help" className="text-xs text-muted-foreground">
                      Required for this synthetic checklist.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="walkthrough-photo">Photo reference *</Label>
                    <Input
                      id="walkthrough-photo"
                      name="walkthrough_photo"
                      value={walkthroughPhoto}
                      onChange={(event) => setWalkthroughPhoto(event.target.value)}
                      placeholder="synthetic-photo-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="damage">Damage found? *</Label>
                    <select
                      id="damage"
                      name="damage"
                      value={damage}
                      onChange={(event) => setDamage(event.target.value)}
                      className="block min-h-12 w-full rounded-md border bg-background px-3"
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  {damage === "yes" && (
                    <div>
                      <Label htmlFor="damage-photo">Damage photo reference *</Label>
                      <Input
                        id="damage-photo"
                        name="damage_photo"
                        value={damagePhoto}
                        onChange={(event) => setDamagePhoto(event.target.value)}
                      />
                    </div>
                  )}
                </fieldset>
                <Button type="submit">Submit synthetic clean for review</Button>
              </form>
            )}
            {task.state === "submitted" && (
              <Button
                type="button"
                onClick={() => taskAction("begin_review", { id: "synthetic-pc", role: "pc" })}
              >
                Begin PC review
              </Button>
            )}
            {task.state === "pending_review" && (
              <div className="space-y-3">
                <Label htmlFor="correction">Correction reason</Label>
                <Input
                  id="correction"
                  name="correction"
                  value={correction}
                  onChange={(event) => setCorrection(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => taskAction("approve", { id: "synthetic-pc", role: "pc" })}
                  >
                    Approve synthetic clean
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      taskAction("require_correction", { id: "synthetic-pc", role: "pc" })
                    }
                  >
                    Require correction
                  </Button>
                </div>
              </div>
            )}
            {task.state === "correction_required" && (
              <Button
                type="button"
                onClick={() => taskAction("reopen", { id: "synthetic-cleaner", role: "cleaner" })}
              >
                Reopen for cleaner
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Submission snapshots: {task.submissions.length}. Audit events: {task.events.length}.
            </p>
          </div>
        </SectionCard>
        <SectionCard
          title="Cleaning Review and guest billing"
          description={`Synthetic review · billing ${billing.status.replaceAll("_", " ")}`}
        >
          <div className="space-y-4">
            <p className="text-sm">
              Finding: Carpet stain · Evidence: synthetic photo · Booking: synthetic booking. No
              charge or message is sent.
            </p>
            <div>
              <Label htmlFor="proposed-amount">Proposed amount</Label>
              <Input
                id="proposed-amount"
                name="proposed_amount"
                type="number"
                min="0"
                step="0.01"
                value={proposedAmount}
                onChange={(event) => setProposedAmount(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="billing-reason">Decision reason</Label>
              <Input
                id="billing-reason"
                name="billing_reason"
                value={billingReason}
                onChange={(event) => setBillingReason(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="deposit-proposal">PC deposit proposal</Label>
              <select
                id="deposit-proposal"
                name="deposit_proposal"
                value={depositAction}
                onChange={(event) => setDepositAction(event.target.value as DepositAction)}
                disabled={billing.status !== "draft"}
                className="block min-h-12 w-full rounded-md border bg-background px-3"
              >
                <option value="none">No deposit action</option>
                <option value="withhold">Propose withholding</option>
                <option value="release">Propose release</option>
                <option value="refund">Propose refund</option>
              </select>
            </div>
            {billing.status === "finance_processing" && (
              <div>
                <Label htmlFor="finance-deposit-action">Finance execution action</Label>
                <select
                  id="finance-deposit-action"
                  name="finance_deposit_action"
                  value={financeDepositAction}
                  onChange={(event) => setFinanceDepositAction(event.target.value as DepositAction)}
                  className="block min-h-12 w-full rounded-md border bg-background px-3"
                >
                  <option value="none">No deposit action</option>
                  <option value="withhold">Withhold</option>
                  <option value="release">Release</option>
                  <option value="refund">Refund</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Must match the approved deposit action; this control sends nothing.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {billing.status === "draft" && (
                <Button type="button" onClick={() => billingAction("submit", "pc", "synthetic-pc")}>
                  Submit to James role
                </Button>
              )}
              {billing.status === "submitted_for_supervisor_review" && (
                <>
                  <Button
                    type="button"
                    onClick={() =>
                      billingAction(
                        "supervisor_approve",
                        "operations_supervisor",
                        "synthetic-james",
                      )
                    }
                  >
                    Supervisor approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      billingAction("escalate", "operations_supervisor", "synthetic-james")
                    }
                  >
                    Escalate to Director
                  </Button>
                </>
              )}
              {billing.status === "escalated_to_director" && (
                <Button
                  type="button"
                  onClick={() =>
                    billingAction("director_approve", "director_operations", "synthetic-micah")
                  }
                >
                  Director approve
                </Button>
              )}
              {(billing.status === "supervisor_approved" ||
                billing.status === "director_approved") && (
                <Button
                  type="button"
                  onClick={() =>
                    billingAction(
                      "send_to_finance",
                      billing.status === "director_approved"
                        ? "director_operations"
                        : "operations_supervisor",
                      "synthetic-approver",
                    )
                  }
                >
                  Mark ready for Finance
                </Button>
              )}
              {billing.status === "ready_for_finance" && (
                <Button
                  type="button"
                  onClick={() => billingAction("start_processing", "finance", "synthetic-finance")}
                >
                  Start Finance review
                </Button>
              )}
              {billing.status === "finance_processing" && (
                <>
                  <Button
                    type="button"
                    onClick={() => billingAction("execute", "finance", "synthetic-finance")}
                  >
                    Record synthetic execution
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      billingAction("request_variance_reapproval", "finance", "synthetic-finance")
                    }
                  >
                    Return changed amount for approval
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Approved amount: {billing.approvedAmount ?? "none"}. Actual amount:{" "}
              {billing.actualAmount ?? "none"}. Audit events: {billing.audit.length}.
            </p>
          </div>
        </SectionCard>
      </div>
      <SectionCard
        title="Dispatch and scheduling exceptions"
        description="Synthetic queue rules; no live assignments or OwnerRez connection"
      >
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            Property default:{" "}
            {routing.kind === "unassigned"
              ? "Unassigned and at risk — no verified Breezeway default"
              : routing.cleanerId}
          </li>
          <li>
            Reservation change:{" "}
            {changedReservation.action === "scheduling_exception"
              ? changedReservation.reason
              : changedReservation.action}
          </li>
          <li>
            Daily derived counts: {dailyCounts.qcInspections} QC inspection,{" "}
            {dailyCounts.shortStayCleans} short-stay clean. Unknown stay length would remain
            unclassified.
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
