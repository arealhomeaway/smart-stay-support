/**
 * Work Order workspace.
 *
 * The order on screen is the order of the job: what to do next, the money and
 * who may authorise it, the owner's decision, the warranty route, the vendor's
 * commitments, the evidence, then closure and the related recovery or claim.
 * Resolve derives the authority, the checkpoints and the gates; the employee
 * supplies the judgement, the amounts and the words.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Chip } from "@/components/ui/page";
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
import {
  WARRANTY_OVERRIDE_LABELS,
  type WarrantyOverrideReason,
} from "@/lib/maintenance-policy";
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
  ownerApprovalRequest,
  secondQuoteAdvice,
  workOrderBucket,
  type OwnerApprovalOutcome,
} from "@/lib/work-orders";
import type { WorkOrderEventRow, WorkOrderRow, WorkOrderUpdate } from "@/lib/work-order-types";

const OVERRIDE_REASONS = Object.keys(WARRANTY_OVERRIDE_LABELS) as WarrantyOverrideReason[];

export function WorkOrderDrawer({
  workOrder,
  people,
  canEdit,
  propertyName,
  onClose,
}: {
  workOrder: WorkOrderRow | null;
  people: TeamMember[];
  canEdit: boolean;
  propertyName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { isSupervisor } = useRole();
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

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
    qc.invalidateQueries({ queryKey: ["work-order-requirements"] });
    qc.invalidateQueries({ queryKey: ["work-order-evidence", workOrder?.id] });
    qc.invalidateQueries({ queryKey: ["work-order-events", workOrder?.id] });
    qc.invalidateQueries({ queryKey: ["work-orders-for-ticket", workOrder?.ticket_id] });
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

  /** Owner approval goes through the existing approvals architecture. */
  const requestApproval = useMutation({
    mutationFn: async () => {
      if (!workOrder) return;
      const request = ownerApprovalRequest(workOrder);
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
          approver_role: "owner",
          status: "pending",
          is_demo: workOrder.is_demo,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      const { error: updateError } = await supabase
        .from("work_orders")
        .update({
          approval_id: (data as { id: string }).id,
          approval_status: "pending",
          approval_requested_at: new Date().toISOString(),
          approval_requested_by: userId,
        })
        .eq("id", workOrder.id);
      if (updateError) throw updateError;

      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: userId,
        event_type: "owner_approval_requested",
        body: `Owner approval requested for ${money(workOrder.quote_amount)}`,
        detail: request.detail as never,
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      refresh();
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Owner approval requested");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** The owner's answer, transcribed with where it was recorded. */
  const recordDecision = useMutation({
    mutationFn: async (outcome: OwnerApprovalOutcome) => {
      if (!workOrder) return;
      const decidedAt = new Date().toISOString();
      const approvedAmount =
        outcome === "approved"
          ? (fields["approved_amount"] ? Number(fields["approved_amount"]) : workOrder.quote_amount)
          : null;

      if (workOrder.approval_id) {
        const { error } = await supabase
          .from("approvals")
          .update({
            status: outcome === "approved" ? "approved" : outcome === "declined" ? "declined" : "pending",
            decision_note: note,
            decided_at: outcome === "info_requested" ? null : decidedAt,
            approver_role: "owner",
          })
          .eq("id", workOrder.approval_id);
        if (error) throw error;
      }

      const { error } = await supabase
        .from("work_orders")
        .update({
          approval_status: outcome,
          approval_note: note,
          approval_decided_at: outcome === "info_requested" ? null : decidedAt,
          approved_amount: approvedAmount,
        })
        .eq("id", workOrder.id);
      if (error) throw error;

      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: userId,
        event_type: `owner_${outcome}`,
        body: `${OWNER_APPROVAL_OUTCOME_LABELS[outcome]} — ${note}`,
        detail: { outcome, approved_amount: approvedAmount, recorded_by: userId } as never,
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      setNote("");
      refresh();
      qc.invalidateQueries({ queryKey: ["approvals"] });
      toast.success("Owner decision recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!workOrder) return <Sheet open={false} onOpenChange={() => onClose()} />;

  const value = (key: keyof WorkOrderRow) =>
    fields[key as string] ??
    (workOrder[key] === null || workOrder[key] === undefined ? "" : String(workOrder[key]));
  const set = (key: string, v: string) => setFields((f) => ({ ...f, [key]: v }));

  const verdict = evaluateAuthority({ ...workOrder, quote_amount: value("quote_amount") || null });
  const commitments = commitmentStatus(workOrder);
  const advice = secondQuoteAdvice(workOrder);
  const blockers = closureBlockers(workOrder, reqs);
  const consequence = declineConsequence(workOrder);
  const readOnly = !canEdit;
  const owner = workOrder.assigned_to;
  const stamp = () => new Date().toISOString();

  return (
    <Sheet open onOpenChange={(o) => (o ? null : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{workOrder.title}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 py-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={stateChip(workOrder.closed_at ? "done" : "active")}>
              {STAGE_LABELS[derivedStage(workOrder)]}
            </Chip>
            <Chip>{PHASE_LABELS[workOrder.phase]}</Chip>
            <Chip>{workOrder.priority.toUpperCase()}</Chip>
            <Chip>{APPROVAL_STATUS_LABELS[workOrder.approval_status]}</Chip>
            <span className="text-xs text-muted-foreground">
              {propertyName} · {BUCKET_LABELS[workOrderBucket(workOrder)]} · owned by{" "}
              {owner ? displayName(people.find((p) => p.id === owner)) : "nobody yet"}
            </span>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium">{nextAction(workOrder)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {verdict.label} · {verdict.reason}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Next checkpoint: {CHECKPOINT_LABELS[nextCheckpoint(workOrder)]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              You remain responsible for this work until it is resolved or another employee accepts a
              handoff on the ticket. Consulting James or waiting on the owner does not move ownership.
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

          {/* Money and authority ---------------------------------------- */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold">Cost and authority</h3>
            <div className="grid gap-2 sm:grid-cols-3">
              <MoneyField label="Quote" k="quote_amount" value={value} set={set} readOnly={readOnly} />
              <MoneyField label="Second quote" k="second_quote_amount" value={value} set={set} readOnly={readOnly} />
              <MoneyField label="Final cost" k="final_cost" value={value} set={set} readOnly={readOnly} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Scope of work</Label>
              <Textarea
                rows={2}
                disabled={readOnly}
                value={value("scope")}
                onChange={(e) => set("scope", e.target.value)}
              />
            </div>
            {advice.recommended ? (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
                {advice.reason} This is guidance, not a block.
              </p>
            ) : null}
            <Button
              size="sm"
              disabled={readOnly || save.isPending}
              onClick={() =>
                save.mutate({
                  patch: {
                    quote_amount: numOrNull(value("quote_amount")),
                    second_quote_amount: numOrNull(value("second_quote_amount")),
                    final_cost: numOrNull(value("final_cost")),
                    scope: value("scope") || null,
                    quote_received_at: value("quote_amount") ? (workOrder.quote_received_at ?? stamp()) : null,
                    authority_level: verdict.level,
                  },
                  event: "cost",
                  body: `Cost updated — quote ${money(numOrNull(value("quote_amount")))}`,
                  detail: { authority: verdict.level, reason: verdict.reason },
                })
              }
            >
              Save cost
            </Button>
          </section>

          <Separator />

          {/* Owner approval --------------------------------------------- */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold">Owner approval</h3>
            <p className="text-xs text-muted-foreground">
              Permanent repairs over the policy threshold are the owner's decision. Emergency mitigation may
              proceed regardless — approval covers the permanent repair. Owner notified is not owner approved.
            </p>

            {verdict.ownerApprovalRequired ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {workOrder.approval_status === "not_required" || !workOrder.approval_id ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={readOnly || requestApproval.isPending}
                      onClick={() => requestApproval.mutate()}
                    >
                      Request owner approval
                    </Button>
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
                  <MoneyField label="Amount approved" k="approved_amount" value={value} set={set} readOnly={readOnly} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["approved", "declined", "info_requested"] as OwnerApprovalOutcome[]).map((outcome) => (
                    <Button
                      key={outcome}
                      size="sm"
                      variant={outcome === "approved" ? "default" : "outline"}
                      disabled={readOnly || !note || recordDecision.isPending}
                      onClick={() => recordDecision.mutate(outcome)}
                    >
                      {OWNER_APPROVAL_OUTCOME_LABELS[outcome]}
                    </Button>
                  ))}
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
                <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
                  Warranty may apply
                  {workOrder.warranty_contact ? ` — ${workOrder.warranty_contact}` : ""}. Resolve never bypasses
                  the warranty by itself.
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
                      <SelectTrigger><SelectValue placeholder="Still on the warranty route" /></SelectTrigger>
                      <SelectContent>
                        {OVERRIDE_REASONS.map((r) => (
                          <SelectItem key={r} value={r}>{WARRANTY_OVERRIDE_LABELS[r]}</SelectItem>
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
                        patch: { warranty_eta_at: new Date(fields["warranty_eta_at"] as string).toISOString() },
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
                          WARRANTY_OVERRIDE_LABELS[fields["warranty_override_reason"] as WarrantyOverrideReason]
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
              <Stamp label="Contacted" k="vendor_contacted_at" wo={workOrder} save={save} readOnly={readOnly} />
              <Stamp label="Acknowledged" k="vendor_acknowledged_at" wo={workOrder} save={save} readOnly={readOnly} />
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
              <Stamp label="Arrived" k="vendor_arrived_at" wo={workOrder} save={save} readOnly={readOnly} />
              <Stamp label="Vendor says complete" k="vendor_completed_at" wo={workOrder} save={save} readOnly={readOnly} />
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
              <p className="text-xs text-muted-foreground">No checklist recorded for this work order.</p>
            ) : (
              reqs.map((r) => (
                <div key={r.slot_key} className="flex items-center justify-between rounded border px-3 py-1.5">
                  <span className="text-xs">
                    {r.label}
                    {r.required ? "" : " (optional)"}
                  </span>
                  <Chip>{r.status}</Chip>
                </div>
              ))
            )}
            {progress.blocking.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {progress.blocking.length} required item(s) outstanding. Linked claims and guest recovery read
                these same items — never upload the job twice.
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
                <Stamp label="Guest updated" k="guest_notified_at" wo={workOrder} save={save} readOnly={readOnly} />
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
                  disabled={readOnly || save.isPending}
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
                  className="underline underline-offset-2"
                >
                  Originating ticket
                </Link>
                {" — start a guest recovery or a claim from there so the stay context comes with it."}
              </p>
            ) : null}
            <p className="text-muted-foreground">
              {workOrder.recovery_id ? "Linked to a guest recovery." : "No guest recovery linked."}{" "}
              {workOrder.claim_id ? "Linked to a claim." : "No claim linked."} A work order fixes the home; a
              recovery gives the guest something back; a claim recovers the cost from someone else. Link one
              only when it is genuinely running.
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
                  {row.event_type} · {new Date(row.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </section>
        </div>
      </SheetContent>
    </Sheet>
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
        body: patch.recovery_id ? "Guest recovery linked" : "Claim linked",
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
            <SelectTrigger><SelectValue placeholder="Link a guest recovery" /></SelectTrigger>
            <SelectContent>
              {recoveryOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!recoveryId} onClick={() => link.mutate({ recovery_id: recoveryId })}>
            Link
          </Button>
        </div>
      ) : null}
      {claimOptions.length && !workOrder.claim_id ? (
        <div className="flex items-center gap-2">
          <Select value={claimId} onValueChange={setClaimId}>
            <SelectTrigger><SelectValue placeholder="Link a claim" /></SelectTrigger>
            <SelectContent>
              {claimOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!claimId} onClick={() => link.mutate({ claim_id: claimId })}>
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
  save: { mutate: (v: { patch: WorkOrderUpdate; event: string; body: string }) => void; isPending: boolean };
  readOnly: boolean;
}) {
  const done = Boolean(wo[k]);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={readOnly || save.isPending || done}
      onClick={() => save.mutate({ patch: { [k]: new Date().toISOString() } as WorkOrderUpdate, event: k, body: `${label} recorded` })}
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
      <Input type="number" disabled={readOnly} value={value(k)} onChange={(e) => set(k, e.target.value)} />
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
