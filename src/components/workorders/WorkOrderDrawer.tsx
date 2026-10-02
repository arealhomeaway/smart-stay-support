import { ExpensesCard } from "@/components/finance/ExpensesCard";
/**
 * Work Order workspace.
 *
 * The order on screen is the order of the job: what to do next, the money and
 * who may authorise it, the owner's decision, the warranty route, the vendor's
 * commitments, the evidence, then closure and the related recovery or claim.
 * Resolve derives the authority, the checkpoints and the gates; the employee
 * supplies the judgement, the amounts and the words.
 */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { parseWorkOrderCost, editWorkOrderCostDraft } from "@/lib/work-order-cost-input";
import { supabase } from "@/integrations/supabase/client";
import { TaskWorkspace } from "@/components/ui/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Chip } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { ProgressSteps, Celebrate } from "@/components/ui/feedback";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { EmailComposer } from "@/components/EmailComposer";
import { PhotoStrip } from "@/components/onboarding/PhotoStrip";
import { usDate, usDateTime } from "@/lib/dates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayName, useCurrentUserId, type TeamMember } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { stateChip } from "@/lib/semantic";
import { evidenceProgress, type RequirementLike } from "@/lib/claims";
import { WARRANTY_OVERRIDE_LABELS, type WarrantyOverrideReason } from "@/lib/maintenance-policy";
import {
  APPROVAL_STATUS_LABELS,
  BUCKET_LABELS,
  CHECKPOINT_LABELS,
  MAINTENANCE_POLICY_VERSION,
  OWNER_APPROVAL_KIND,
  OWNER_APPROVAL_OUTCOME_LABELS,
  PHASE_LABELS,
  STAGE_LABELS,
  canClose,
  closureBlockers,
  commitmentStatus,
  declineConsequence,
  derivedStage,
  evaluateAuthority,
  money,
  nextAction,
  nextCheckpoint,
  ownerApprovalText,
  secondQuoteAdvice,
  supervisorApprovalRequest,
  supervisorApproved,
  workOrderBucket,
  workOrderReassignment,
  type OwnerApprovalOutcome,
} from "@/lib/work-orders";
import {
  ticketWorkOrdersQueryKey,
  type WorkOrderEventRow,
  type WorkOrderRow,
  type WorkOrderUpdate,
} from "@/lib/work-order-types";

const OVERRIDE_REASONS = Object.keys(WARRANTY_OVERRIDE_LABELS) as WarrantyOverrideReason[];

/**
 * What the approval chip says. The tier decides who has to approve, so the
 * chip has to agree with it: a $275 repair that needs a supervisor must not
 * read "no approval needed" just because the owner is not involved.
 */
function approvalChipLabel(
  wo: { approval_status: string; supervisor_approval_status?: string | null },
  verdict: { ownerApprovalRequired: boolean; supervisorApprovalRequired?: boolean },
): string {
  if (
    verdict.supervisorApprovalRequired &&
    (wo.supervisor_approval_status ?? "not_required") === "not_required"
  )
    return "Supervisor approval not requested yet";
  if (verdict.supervisorApprovalRequired && wo.supervisor_approval_status === "pending")
    return "Waiting on supervisor approval";
  if (wo.supervisor_approval_status === "approved" && !verdict.ownerApprovalRequired)
    return "Supervisor approved";
  if (verdict.ownerApprovalRequired && wo.approval_status === "not_required")
    return "Owner approval not requested yet";
  return (
    (APPROVAL_STATUS_LABELS as Record<string, string>)[wo.approval_status] ?? wo.approval_status
  );
}

function stageTone(closed: boolean, bucket: string): StatusTone {
  if (closed) return "resolved";
  if (bucket === "needs_action") return "escalated";
  if (bucket === "permanent_pending" || bucket === "evidence_missing") return "progress";
  return "waiting";
}

/** Five plain-English milestones, derived from the checkpoints already on the record. */
function timelineSteps(wo: WorkOrderRow) {
  const steps = [
    { key: "created", label: "Created", hint: usDate(wo.created_at) },
    {
      key: "assigned",
      label: "Assigned",
      hint: usDate(wo.vendor_contacted_at ?? (wo.vendor_name ? wo.created_at : null)),
    },
    { key: "scheduled", label: "Scheduled", hint: usDate(wo.vendor_eta_at ?? wo.scheduled_for) },
    { key: "in_progress", label: "In progress", hint: usDate(wo.vendor_arrived_at) },
    { key: "completed", label: "Completed", hint: usDate(wo.closed_at) },
  ];
  let currentIndex = 0;
  if (wo.vendor_contacted_at || wo.vendor_name) currentIndex = 1;
  if (wo.scheduled_for || wo.vendor_eta_at) currentIndex = 2;
  if (wo.vendor_arrived_at) currentIndex = 3;
  if (wo.closed_at) currentIndex = 4;
  return { steps, currentIndex };
}

export function WorkOrderDrawer({
  workOrder,
  people,
  canEdit,
  propertyName,
  propertyPhotoUrl,
  originToken,
  onClose,
}: {
  workOrder: WorkOrderRow | null;
  people: TeamMember[];
  canEdit: boolean;
  propertyName: string;
  propertyPhotoUrl?: string | null;
  /** Where this list is — carried onto the Ticket so Back returns here. */
  originToken?: string | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { isSupervisor } = useRole();
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [reassignTo, setReassignTo] = useState("");

  /*
   * Every unsaved value belongs to one work order. QA found a quote typed on
   * one job still sitting in the box after opening another, so the workspace
   * clears itself whenever the record it is showing changes — belt and braces
   * alongside the caller remounting it by id.
   */
  const shownId = useRef<string | null>(workOrder?.id ?? null);
  if (workOrder && shownId.current !== workOrder.id) {
    shownId.current = workOrder.id;
    if (note) setNote("");
    if (Object.keys(fields).length) setFields({});
  }

  const requirements = useQuery({
    queryKey: ["work-order-evidence", workOrder?.id],
    enabled: !!workOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_requirements")
        .select("*")
        .eq("subject_type", "work_order")
        .eq("subject_id", workOrder!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activity = useQuery({
    queryKey: ["work-order-events", workOrder?.id],
    enabled: !!workOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_order_events")
        .select("*")
        .eq("work_order_id", workOrder!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkOrderEventRow[];
    },
  });

  const reqs = (requirements.data ?? []) as RequirementLike[];
  const progress = useMemo(() => evidenceProgress(reqs), [reqs]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["work-orders"] });
    qc.invalidateQueries({ queryKey: ["owner-home"] });
    qc.invalidateQueries({ queryKey: ["work-order-requirements"] });
    qc.invalidateQueries({ queryKey: ["work-order-evidence", workOrder?.id] });
    qc.invalidateQueries({ queryKey: ["work-order-events", workOrder?.id] });
    qc.invalidateQueries({ queryKey: ticketWorkOrdersQueryKey(workOrder?.ticket_id) });
  };

  const save = useMutation({
    mutationFn: async ({
      patch,
      event,
      body,
      detail,
    }: {
      patch: WorkOrderUpdate;
      event: string;
      body: string;
      detail?: Record<string, unknown>;
    }) => {
      if (!workOrder) return;
      const { error } = await supabase.from("work_orders").update(patch).eq("id", workOrder.id);
      if (error) throw error;
      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: userId,
        event_type: event,
        body,
        detail: { ...(detail ?? {}), policy_version: MAINTENANCE_POLICY_VERSION } as never,
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      setNote("");
      refresh();
      toast.success("Work order updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCost = useMutation({
    mutationFn: async () => {
      if (!workOrder) throw new Error("Choose a Work Order first.");
      const read = (key: "quote_amount" | "second_quote_amount" | "final_cost" | "scope") =>
        fields[key] ?? String(workOrder[key] ?? "");
      const result = await supabase.rpc("save_work_order_costs", {
        _work_order_id: workOrder.id,
        _expected_updated_at: fields["cost_version"] ?? workOrder.updated_at,
        // These three costs may legitimately be blank; the database accepts null.
        _quote: parseWorkOrderCost(read("quote_amount")) as unknown as number,
        _second_quote: parseWorkOrderCost(read("second_quote_amount")) as unknown as number,
        _final_cost: parseWorkOrderCost(read("final_cost")) as unknown as number,
        _scope: read("scope"),
        _reason: fields["cost_reason"] ?? "",
      });
      if (result.error) throw result.error;
      return { workOrderId: workOrder.id, ticketId: workOrder.ticket_id };
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ticketWorkOrdersQueryKey(saved.ticketId) });
      if (shownId.current === saved.workOrderId) {
        setFields((current) => {
          const next = { ...current };
          for (const key of [
            "quote_amount",
            "second_quote_amount",
            "final_cost",
            "scope",
            "cost_version",
            "cost_reason",
          ])
            delete next[key];
          return next;
        });
      }
      refresh();
      toast.success("Costs and history saved");
    },
    onError: (error: Error) => {
      refresh();
      toast.error(error.message);
    },
  });

  /** Owner approval goes through the existing approvals architecture. */
  const requestApproval = useMutation({
    mutationFn: async () => {
      if (!workOrder) return;
      const ownerText = ownerApprovalText(fields["owner_approval_summary"] ?? "");
      const { error } = await supabase.rpc("prepare_work_order_owner_approval", {
        _work_order_id: workOrder.id,
        _expected_updated_at: fields["owner_approval_version"] ?? workOrder.updated_at,
        _owner_summary: ownerText.detail,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Owner approval requested");
      setFields((current) => ({
        ...current,
        owner_approval_summary: "",
        owner_approval_version: "",
      }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** The owner's answer, transcribed with where it was recorded. */
  const recordDecision = useMutation({
    mutationFn: async (outcome: OwnerApprovalOutcome) => {
      if (!workOrder) return;
      const approvedAmount =
        outcome === "approved"
          ? fields["approved_amount"]
            ? Number(fields["approved_amount"])
            : workOrder.quote_amount
          : null;

      const { error } = await supabase.rpc("record_staff_work_order_owner_decision", {
        _work_order_id: workOrder.id,
        _expected_updated_at: workOrder.updated_at,
        _outcome: outcome,
        // Declining an amount carries no figure; the database accepts null.
        _approved_amount: approvedAmount as unknown as number,
        _note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote("");
      refresh();
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Owner decision recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** $200–$350: a supervisor decides first, on the same approvals record. */
  const requestSupervisorApproval = useMutation({
    mutationFn: async () => {
      if (!workOrder) return;
      const request = supervisorApprovalRequest(workOrder);
      const { data: seat } = await supabase.rpc("seat_holder_at", {
        _role_code: "ops_supervisor",
        _at: new Date().toISOString(),
      });
      const { data, error } = await supabase
        .from("approvals")
        .insert({
          entity_type: "work_order",
          entity_id: workOrder.id,
          property_id: workOrder.property_id,
          kind: request.kind,
          title: request.title,
          detail: (workOrder.scope ?? workOrder.title) as string,
          amount: request.amount,
          requested_by: userId,
          approver_role: "supervisor",
          approver_id: (seat as string | null) ?? null,
          status: "pending",
          is_demo: workOrder.is_demo,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const { error: updateError } = await supabase
        .from("work_orders")
        .update({
          supervisor_approval_id: (data as { id: string }).id,
          supervisor_approval_status: "pending",
          supervisor_approval_requested_at: new Date().toISOString(),
          supervisor_approval_requested_by: userId,
        } as never)
        .eq("id", workOrder.id);
      if (updateError) throw updateError;

      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: userId,
        event_type: "supervisor_approval_requested",
        body: `Supervisor approval requested for ${money(workOrder.quote_amount)}`,
        detail: request.detail as never,
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Supervisor approval requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordSupervisorDecision = useMutation({
    mutationFn: async (outcome: "approved" | "declined") => {
      if (!workOrder) return;
      const decidedAt = new Date().toISOString();
      if (workOrder.supervisor_approval_id) {
        const { error } = await supabase
          .from("approvals")
          .update({ status: outcome, decision_note: note, decided_at: decidedAt })
          .eq("id", workOrder.supervisor_approval_id as string);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("work_orders")
        .update({
          supervisor_approval_status: outcome,
          supervisor_approval_note: note,
          supervisor_approval_decided_at: decidedAt,
        } as never)
        .eq("id", workOrder.id);
      if (error) throw error;

      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: userId,
        event_type: `supervisor_${outcome}`,
        body: `Supervisor ${outcome} — ${note}`,
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      setNote("");
      refresh();
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Supervisor decision recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** The homeowner is told after supervisor-authorised work, not asked first. */
  const sendOwnerFyi = useMutation({
    mutationFn: async () => {
      if (!workOrder) return;
      const at = new Date().toISOString();
      const { error } = await supabase
        .from("work_orders")
        .update({ owner_fyi_at: at, owner_fyi_by: userId } as never)
        .eq("id", workOrder.id);
      if (error) throw error;
      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: userId,
        event_type: "owner_fyi_sent",
        body: note ? `Homeowner told: ${note}` : "Homeowner told this work is going ahead.",
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      setNote("");
      refresh();
      toast.success("Homeowner FYI recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!workOrder) return null;

  const value = (key: keyof WorkOrderRow) =>
    fields[key as string] ??
    (workOrder[key] === null || workOrder[key] === undefined ? "" : String(workOrder[key]));
  const set = (key: string, v: string) => setFields((f) => ({ ...f, [key]: v }));
  const setCost = (key: string, value: string) =>
    setFields((current) => editWorkOrderCostDraft(current, workOrder, key, value));
  const staleCost = Boolean(
    fields["cost_version"] && fields["cost_version"] !== workOrder.updated_at,
  );

  const verdict = evaluateAuthority({ ...workOrder, quote_amount: value("quote_amount") || null });
  const commitments = commitmentStatus(workOrder);
  const advice = secondQuoteAdvice(workOrder);
  const blockers = closureBlockers(workOrder, reqs);
  const consequence = declineConsequence(workOrder);
  const permissionReadOnly = !canEdit;
  // Once the Work Order is actually closed (closed_at set), every action
  // below locks except Reopen — which intentionally checks
  // permissionReadOnly instead, since it is the one action a supervisor
  // must still be able to take on a closed record.
  const readOnly = permissionReadOnly || Boolean(workOrder.closed_at);
  const owner = workOrder.assigned_to;
  const stamp = () => new Date().toISOString();

  const { steps, currentIndex } = timelineSteps(workOrder);

  return (
    <TaskWorkspace
      open
      onOpenChange={(o) => (o ? null : onClose())}
      width="full"
      title={
        <span className="flex items-center gap-2">
          <PropertyPhoto url={propertyPhotoUrl ?? null} name={propertyName} className="size-8" />
          {workOrder.title}
        </span>
      }
      subtitle={propertyName}
      headerExtra={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={stageTone(!!workOrder.closed_at, workOrderBucket(workOrder))}>
            {STAGE_LABELS[derivedStage(workOrder)]}
          </StatusBadge>
          <Chip>{PHASE_LABELS[workOrder.phase]}</Chip>
          <Chip>{workOrder.priority.toUpperCase()}</Chip>
          <Chip>{approvalChipLabel(workOrder, verdict)}</Chip>
          <span className="text-xs text-muted-foreground">
            owned by {owner ? displayName(people.find((p) => p.id === owner)) : "nobody yet"}
          </span>
          <EmailComposer context="work_order" recordId={workOrder.id} />
        </div>
      }
    >
      <div className="space-y-5 text-sm">
        {workOrder.closed_at ? (
          <Celebrate title="Work order completed">
            Closed {usDate(workOrder.closed_at)}
            {workOrder.closure_note ? ` — ${workOrder.closure_note}` : ""}
          </Celebrate>
        ) : (
          <ProgressSteps steps={steps} currentIndex={currentIndex} />
        )}

        <div className="rounded-md border bg-muted/40 p-3">
          <p className="font-medium">{nextAction(workOrder)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {verdict.label} · {verdict.reason}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Next checkpoint: {CHECKPOINT_LABELS[nextCheckpoint(workOrder)]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Stays yours until it's resolved or handed off — asking for advice doesn't change that.
          </p>
        </div>

        {consequence ? (
          <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            {consequence}
          </div>
        ) : null}

        {commitments.action ? (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
            {commitments.action}
          </div>
        ) : null}

        <Separator />

        {/* Ownership ------------------------------------------------------
            Who internally owns getting this Work Order done — never the
            external vendor doing the work. Reassigning here only ever
            writes assigned_to; it must never touch vendor_name or any
            future vendor-delivery/recipient field, and this Work Order's
            owner is not assumed to be who a vendor-facing delivery (PDF,
            email, share — not built yet) would go to. */}
        <section className="space-y-2">
          <h3 className="font-display text-sm font-semibold">Ownership</h3>
          <Chip>{owner ? displayName(people.find((p) => p.id === owner)) : "Unassigned"}</Chip>
          {isSupervisor && !readOnly ? (
            <div className="flex gap-2">
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Reassign to…" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {displayName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!reassignTo || reassignTo === owner || save.isPending}
                onClick={() => {
                  const target = people.find((p) => p.id === reassignTo);
                  save.mutate(
                    workOrderReassignment({
                      fromOwnerId: owner ?? null,
                      toUserId: reassignTo,
                      toUserName: displayName(target),
                      actorId: userId,
                    }),
                  );
                  setReassignTo("");
                }}
              >
                Reassign
              </Button>
            </div>
          ) : null}
        </section>

        <Separator />

        {/* Money and authority ---------------------------------------- */}
        <section className="space-y-3">
          <h3 className="font-display text-sm font-semibold">Cost and authority</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <MoneyField
              label="Quote"
              k="quote_amount"
              value={value}
              set={setCost}
              readOnly={readOnly || saveCost.isPending}
            />
            <MoneyField
              label="Second quote"
              k="second_quote_amount"
              value={value}
              set={setCost}
              readOnly={readOnly || saveCost.isPending}
            />
            <MoneyField
              label="Final cost"
              k="final_cost"
              value={value}
              set={setCost}
              readOnly={readOnly || saveCost.isPending}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Scope of work</Label>
            <Textarea
              rows={2}
              disabled={readOnly || saveCost.isPending}
              value={value("scope")}
              onChange={(e) => setCost("scope", e.target.value)}
            />
          </div>
          {advice.recommended ? (
            <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
              {advice.reason} This is guidance, not a block.
            </p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="work-order-cost-reason">Reason or cost evidence</Label>
            <Textarea
              id="work-order-cost-reason"
              value={fields["cost_reason"] ?? ""}
              maxLength={2000}
              disabled={readOnly || saveCost.isPending}
              onChange={(event) => setCost("cost_reason", event.target.value)}
            />
          </div>
          {staleCost && (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                The Work Order changed. Your draft is preserved. Current quote:{" "}
                {money(workOrder.quote_amount)}, second quote:{" "}
                {money(workOrder.second_quote_amount)}, actual cost: {money(workOrder.final_cost)}.
              </p>
              <p className="whitespace-pre-wrap">
                Current scope: {workOrder.scope || "Not recorded"}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={readOnly || saveCost.isPending}
                onClick={() =>
                  setFields((current) => ({ ...current, cost_version: workOrder.updated_at }))
                }
              >
                I reviewed the current costs and scope
              </Button>
            </div>
          )}
          <Button
            size="sm"
            disabled={
              readOnly ||
              saveCost.isPending ||
              staleCost ||
              (fields["cost_reason"] ?? "").trim().length < 3
            }
            onClick={() => saveCost.mutate()}
          >
            {saveCost.isPending ? "Saving…" : "Save cost"}
          </Button>
        </section>

        <Separator />

        {/* Supervisor approval ----------------------------------------- */}
        {verdict.supervisorApprovalRequired ? (
          <>
            <section className="space-y-3">
              <h3 className="font-display text-sm font-semibold">Supervisor approval</h3>
              <p className="text-xs text-muted-foreground">{verdict.reason}</p>

              {!workOrder.supervisor_approval_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={readOnly || requestSupervisorApproval.isPending}
                  onClick={() => requestSupervisorApproval.mutate()}
                >
                  Request supervisor approval
                </Button>
              ) : (
                <div className="space-y-2">
                  <Chip className={stateChip(supervisorApproved(workOrder) ? "done" : "waiting")}>
                    {APPROVAL_STATUS_LABELS[
                      (workOrder.supervisor_approval_status ??
                        "pending") as keyof typeof APPROVAL_STATUS_LABELS
                    ] ?? "Pending"}
                  </Chip>
                  {isSupervisor && workOrder.supervisor_approval_status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={readOnly || !note || recordSupervisorDecision.isPending}
                        onClick={() => recordSupervisorDecision.mutate("approved")}
                      >
                        Approve this amount
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={readOnly || !note || recordSupervisorDecision.isPending}
                        onClick={() => recordSupervisorDecision.mutate("declined")}
                      >
                        Decline
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}

              {supervisorApproved(workOrder) && !workOrder.owner_fyi_at ? (
                <div className="space-y-2">
                  <Label className="text-xs">What the homeowner was told, and where</Label>
                  <Textarea
                    rows={2}
                    disabled={readOnly}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Emailed the homeowner on 12 Aug — $275 disposal replacement going ahead."
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={readOnly || sendOwnerFyi.isPending}
                    onClick={() => sendOwnerFyi.mutate()}
                  >
                    Record homeowner FYI
                  </Button>
                </div>
              ) : null}
              {workOrder.owner_fyi_at ? (
                <p className="text-xs text-muted-foreground">
                  Homeowner told on {usDate(workOrder.owner_fyi_at as string)}.
                </p>
              ) : null}
            </section>
            <Separator />
          </>
        ) : null}

        {/* Owner approval --------------------------------------------- */}
        <section className="space-y-3">
          <h3 className="font-display text-sm font-semibold">Owner approval</h3>
          <p className="text-xs text-muted-foreground">
            Repairs over the policy threshold need the owner's sign-off. Emergency mitigation can
            proceed anyway — approval is for the permanent fix. Notified is not the same as
            approved.
          </p>

          {verdict.ownerApprovalRequired ? (
            <>
              <div className="flex flex-wrap gap-2">
                {workOrder.approval_status === "not_required" || !workOrder.approval_id ? (
                  <form
                    className="w-full space-y-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!readOnly && !requestApproval.isPending) requestApproval.mutate();
                    }}
                  >
                    <Label htmlFor={`owner-summary-${workOrder.id}`}>
                      Explanation for the owner (required)
                    </Label>
                    <Textarea
                      id={`owner-summary-${workOrder.id}`}
                      name="owner_approval_summary"
                      aria-describedby={`owner-summary-help-${workOrder.id}`}
                      required
                      minLength={20}
                      maxLength={4000}
                      rows={4}
                      disabled={readOnly || requestApproval.isPending}
                      value={fields["owner_approval_summary"] ?? ""}
                      onChange={(event) =>
                        setFields((current) => ({
                          ...current,
                          owner_approval_summary: event.target.value,
                          owner_approval_version:
                            current["owner_approval_version"] || workOrder.updated_at,
                        }))
                      }
                    />
                    <p
                      id={`owner-summary-help-${workOrder.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      The owner will see this explanation with the requested amount. Describe the
                      issue, work already performed, proposed repair and why a decision is needed.
                      Review it for guest personal information, private staff notes and access
                      credentials before requesting approval.
                    </p>
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={readOnly || requestApproval.isPending}
                    >
                      Request owner approval
                    </Button>
                  </form>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">
                  Owner's answer, and where it was recorded (required to log a decision)
                </Label>
                <Textarea
                  rows={2}
                  disabled={readOnly}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Email from the owner on 12 Aug approving the $650 water heater replacement."
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <MoneyField
                  label="Amount approved"
                  k="approved_amount"
                  value={value}
                  set={set}
                  readOnly={readOnly}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(["approved", "declined", "info_requested"] as OwnerApprovalOutcome[]).map(
                  (outcome) => (
                    <Button
                      key={outcome}
                      size="sm"
                      variant={outcome === "approved" ? "default" : "outline"}
                      disabled={readOnly || !note || recordDecision.isPending}
                      onClick={() => recordDecision.mutate(outcome)}
                    >
                      {OWNER_APPROVAL_OUTCOME_LABELS[outcome]}
                    </Button>
                  ),
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{verdict.reason}</p>
          )}
        </section>

        <Separator />

        {/* Warranty ---------------------------------------------------- */}
        {workOrder.warranty_may_apply ? (
          <>
            <section className="space-y-3">
              <h3 className="font-display text-sm font-semibold">Warranty</h3>
              <p className="rounded-md border border-amber/25 bg-amber/10 px-2 py-1 text-xs">
                Warranty may apply
                {workOrder.warranty_contact ? ` — ${workOrder.warranty_contact}` : ""}.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Warranty appointment or ETA</Label>
                  <Input
                    type="datetime-local"
                    disabled={readOnly}
                    value={local(fields["warranty_eta_at"] ?? workOrder.warranty_eta_at)}
                    onChange={(e) => set("warranty_eta_at", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason for going around the warranty</Label>
                  <Select
                    disabled={readOnly}
                    value={value("warranty_override_reason")}
                    onValueChange={(v) => set("warranty_override_reason", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Still on the warranty route" />
                    </SelectTrigger>
                    <SelectContent>
                      {OVERRIDE_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {WARRANTY_OVERRIDE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={readOnly || save.isPending}
                  onClick={() =>
                    save.mutate({
                      patch: { warranty_contacted_at: stamp() },
                      event: "warranty_contacted",
                      body: "Warranty provider contacted",
                    })
                  }
                >
                  Provider contacted
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={readOnly || save.isPending || !fields["warranty_eta_at"]}
                  onClick={() =>
                    save.mutate({
                      patch: {
                        warranty_eta_at: new Date(
                          fields["warranty_eta_at"] as string,
                        ).toISOString(),
                      },
                      event: "warranty_eta",
                      body: "Warranty appointment recorded",
                    })
                  }
                >
                  Record warranty ETA
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || save.isPending || !fields["warranty_override_reason"]}
                  onClick={() =>
                    save.mutate({
                      patch: {
                        warranty_override_reason: fields["warranty_override_reason"] as string,
                        warranty_override_at: stamp(),
                        warranty_override_by: userId,
                      },
                      event: "warranty_override",
                      body: `Alternate vendor chosen — ${
                        WARRANTY_OVERRIDE_LABELS[
                          fields["warranty_override_reason"] as WarrantyOverrideReason
                        ]
                      }`,
                    })
                  }
                >
                  Choose an alternate vendor
                </Button>
              </div>
            </section>
            <Separator />
          </>
        ) : null}

        {/* Vendor commitments ------------------------------------------ */}
        <section className="space-y-3">
          <h3 className="font-display text-sm font-semibold">Vendor</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Vendor</Label>
              <Input
                disabled={readOnly}
                value={value("vendor_name")}
                onChange={(e) => set("vendor_name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Arrival ETA</Label>
              <Input
                type="datetime-local"
                disabled={readOnly}
                value={local(fields["vendor_eta_at"] ?? workOrder.vendor_eta_at)}
                onChange={(e) => set("vendor_eta_at", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stamp
              label="Contacted"
              k="vendor_contacted_at"
              wo={workOrder}
              save={save}
              readOnly={readOnly}
            />
            <Stamp
              label="Acknowledged"
              k="vendor_acknowledged_at"
              wo={workOrder}
              save={save}
              readOnly={readOnly}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || save.isPending || !fields["vendor_eta_at"]}
              onClick={() =>
                save.mutate({
                  patch: {
                    vendor_name: value("vendor_name") || null,
                    vendor_eta_at: new Date(fields["vendor_eta_at"] as string).toISOString(),
                    scheduled_for: new Date(fields["vendor_eta_at"] as string).toISOString(),
                  },
                  event: "vendor_scheduled",
                  body: "Appointment and ETA recorded",
                })
              }
            >
              Record appointment
            </Button>
            <Stamp
              label="Arrived"
              k="vendor_arrived_at"
              wo={workOrder}
              save={save}
              readOnly={readOnly}
            />
            <Stamp
              label="Vendor says complete"
              k="vendor_completed_at"
              wo={workOrder}
              save={save}
              readOnly={readOnly}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={readOnly || save.isPending}
              onClick={() =>
                save.mutate({
                  patch: { missed_commitments: (workOrder.missed_commitments ?? 0) + 1 },
                  event: "missed_commitment",
                  body: `Missed commitment recorded (${(workOrder.missed_commitments ?? 0) + 1})`,
                })
              }
            >
              Record a missed commitment
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vendor report</Label>
            <Textarea
              rows={2}
              disabled={readOnly}
              value={value("vendor_report")}
              onChange={(e) => set("vendor_report", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Temporary mitigation in place</Label>
            <Input
              disabled={readOnly}
              value={value("temporary_mitigation")}
              onChange={(e) => set("temporary_mitigation", e.target.value)}
              placeholder="Mini-fridge delivered; water shut off at the valve…"
            />
          </div>
          <Button
            size="sm"
            disabled={readOnly || save.isPending}
            onClick={() =>
              save.mutate({
                patch: {
                  vendor_name: value("vendor_name") || null,
                  vendor_report: value("vendor_report") || null,
                  temporary_mitigation: value("temporary_mitigation") || null,
                },
                event: "vendor_detail",
                body: "Vendor detail updated",
              })
            }
          >
            Save vendor detail
          </Button>
        </section>

        <Separator />

        {/* Evidence ---------------------------------------------------- */}
        <section className="space-y-2">
          <h3 className="font-display text-sm font-semibold">Evidence</h3>
          {reqs.length === 0 ? (
            // Same rule the Complete button uses (closureBlockers): never claim
            // nothing is needed while completion evidence is still missing.
            workOrder.evidence_complete ? (
              <p className="text-xs text-muted-foreground">Completion evidence confirmed.</p>
            ) : (
              <div className="text-xs">
                <p className="font-medium">Still needed before completion</p>
                <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                  <li>Completion photo</li>
                </ul>
              </div>
            )
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {reqs.map((r) => {
                const done = r.status === "provided" || r.status === "waived";
                return (
                  <div
                    key={r.slot_key}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs ${
                      done ? "bg-sage/8 text-foreground" : "bg-sunken text-foreground"
                    }`}
                  >
                    <span className="truncate">
                      {r.label}
                      {r.required ? "" : " (optional)"}
                    </span>
                    <StatusBadge tone={done ? "resolved" : "waiting"}>{r.status}</StatusBadge>
                  </div>
                );
              })}
            </div>
          )}
          <PhotoStrip
            entityType="ticket"
            entityId={workOrder.ticket_id ?? workOrder.id}
            title="Job photos"
            emptyHint="No photos uploaded from the ticket yet."
          />
          {progress.blocking.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {progress.blocking.length} required item(s) still outstanding.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || save.isPending || workOrder.evidence_complete}
              onClick={() =>
                save.mutate({
                  patch: { evidence_complete: true },
                  event: "evidence_complete",
                  body: "Completion evidence confirmed",
                })
              }
            >
              Confirm completion evidence
            </Button>
          </div>
        </section>

        <Separator />

        {/* Closure ----------------------------------------------------- */}
        <section className="space-y-3">
          <h3 className="font-display text-sm font-semibold">Closure</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Invoice reference</Label>
              <Input
                disabled={readOnly}
                value={value("invoice_reference")}
                onChange={(e) => set("invoice_reference", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Closure note</Label>
              <Input
                disabled={readOnly}
                value={value("closure_note")}
                onChange={(e) => set("closure_note", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {workOrder.occupied_now && !workOrder.guest_notified_at ? (
              <Stamp
                label="Guest updated"
                k="guest_notified_at"
                wo={workOrder}
                save={save}
                readOnly={readOnly}
              />
            ) : null}
            <Button
              size="sm"
              disabled={readOnly || save.isPending || !canClose(workOrder, reqs)}
              onClick={() =>
                save.mutate({
                  patch: {
                    invoice_reference: value("invoice_reference") || null,
                    closure_note: value("closure_note") || null,
                    closed_at: stamp(),
                    closed_by: userId,
                  },
                  event: "closed",
                  body: "Work order closed",
                })
              }
            >
              Close work order
            </Button>
            {workOrder.closed_at && isSupervisor ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={permissionReadOnly || save.isPending}
                onClick={() =>
                  save.mutate({
                    patch: {
                      closed_at: null,
                      reopened_at: stamp(),
                      reopened_by: userId,
                      reopen_reason: note || "Reopened for review",
                    },
                    event: "reopened",
                    body: note || "Reopened for review",
                  })
                }
              >
                Reopen
              </Button>
            ) : null}
          </div>
          {blockers.length > 0 ? (
            <ul className="list-disc pl-4 text-xs text-muted-foreground">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </section>

        <Separator />

        {/* Related ----------------------------------------------------- */}
        <section className="space-y-2 text-xs">
          <h3 className="font-display text-sm font-semibold">Related</h3>
          {workOrder.ticket_id ? (
            <p>
              <Link
                to="/tickets/$ticketId"
                params={{ ticketId: workOrder.ticket_id }}
                search={(originToken ? { from: originToken } : undefined) as never}
                className="underline underline-offset-2"
                onClick={onClose}
              >
                Originating ticket
              </Link>
              {" — start a guest refund or credit or a claim from there so the stay context comes with it."}
            </p>
          ) : null}
          <p className="text-muted-foreground">
            {workOrder.recovery_id ? "Linked to a guest refund or credit." : "No guest refund or credit linked."}{" "}
            {workOrder.claim_id ? "Linked to a claim." : "No claim linked."} A work order fixes the
            home; a recovery gives the guest something back; a claim recovers the cost from someone
            else. Link one only when it is genuinely running.
          </p>
          <LinkRelated workOrder={workOrder} canEdit={canEdit} onSaved={refresh} />
        </section>

        <Separator />

        <section className="space-y-2">
          <h3 className="font-display text-sm font-semibold">History</h3>
          {(activity.data ?? []).map((row) => (
            <div key={row.id} className="rounded border px-3 py-1.5 text-xs">
              <p className="font-medium">{row.body}</p>
              <p className="text-muted-foreground">
                {row.event_type} · {usDateTime(row.created_at)}
              </p>
            </div>
          ))}
        </section>
      </div>
      <div className="p-4"><ExpensesCard propertyId={workOrder.property_id ?? null} linkType="work_order" targetId={workOrder.id} /></div>
    </TaskWorkspace>
  );
}

/** Link an already-running recovery or claim; never auto-created. */
function LinkRelated({
  workOrder,
  canEdit,
  onSaved,
}: {
  workOrder: WorkOrderRow;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [recoveryId, setRecoveryId] = useState("");
  const [claimId, setClaimId] = useState("");

  const recoveries = useQuery({
    queryKey: ["recovery-for-ticket", workOrder.ticket_id],
    enabled: !!workOrder.ticket_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_recovery")
        .select("id, title")
        .eq("ticket_id", workOrder.ticket_id as string);
      if (error) throw error;
      return data ?? [];
    },
  });

  const claims = useQuery({
    queryKey: ["claims-for-ticket", workOrder.ticket_id],
    enabled: !!workOrder.ticket_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("id, title")
        .eq("ticket_id", workOrder.ticket_id as string);
      if (error) throw error;
      return data ?? [];
    },
  });

  const link = useMutation({
    mutationFn: async (patch: { recovery_id?: string; claim_id?: string }) => {
      const { error } = await supabase.from("work_orders").update(patch).eq("id", workOrder.id);
      if (error) throw error;
      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: null,
        event_type: "linked",
        body: patch.recovery_id ? "Guest refunds & credits linked" : "Claim linked",
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      onSaved();
      toast.success("Linked");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canEdit) return null;
  const recoveryOptions = recoveries.data ?? [];
  const claimOptions = claims.data ?? [];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {recoveryOptions.length && !workOrder.recovery_id ? (
        <div className="flex items-center gap-2">
          <Select value={recoveryId} onValueChange={setRecoveryId}>
            <SelectTrigger>
              <SelectValue placeholder="Link a guest refund or credit" />
            </SelectTrigger>
            <SelectContent>
              {recoveryOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!recoveryId}
            onClick={() => link.mutate({ recovery_id: recoveryId })}
          >
            Link
          </Button>
        </div>
      ) : null}
      {claimOptions.length && !workOrder.claim_id ? (
        <div className="flex items-center gap-2">
          <Select value={claimId} onValueChange={setClaimId}>
            <SelectTrigger>
              <SelectValue placeholder="Link a claim" />
            </SelectTrigger>
            <SelectContent>
              {claimOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!claimId}
            onClick={() => link.mutate({ claim_id: claimId })}
          >
            Link
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Stamp({
  label,
  k,
  wo,
  save,
  readOnly,
}: {
  label: string;
  k: keyof WorkOrderRow & string;
  wo: WorkOrderRow;
  save: {
    mutate: (v: { patch: WorkOrderUpdate; event: string; body: string }) => void;
    isPending: boolean;
  };
  readOnly: boolean;
}) {
  const done = Boolean(wo[k]);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={readOnly || save.isPending || done}
      onClick={() =>
        save.mutate({
          patch: { [k]: new Date().toISOString() } as WorkOrderUpdate,
          event: k,
          body: `${label} recorded`,
        })
      }
    >
      {done ? `${label} ✓` : label}
    </Button>
  );
}

function MoneyField({
  label,
  k,
  value,
  set,
  readOnly,
}: {
  label: string;
  k: keyof WorkOrderRow & string;
  value: (key: keyof WorkOrderRow) => string;
  set: (key: string, v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        disabled={readOnly}
        value={value(k)}
        onChange={(e) => set(k, e.target.value)}
      />
    </div>
  );
}

function numOrNull(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ISO to the value a datetime-local input expects. */
function local(iso: string | null | undefined) {
  if (!iso) return "";
  if (!iso.includes("Z") && iso.includes("T")) return iso.slice(0, 16);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
