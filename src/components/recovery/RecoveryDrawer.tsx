/**
 * Guest refunds & credits workspace.
 *
 * The order on screen is the order of the work: what to do next, what the
 * guest is still owed a word about, the evidence, the decision and who may
 * approve it, then delivery and closure. Resolve derives the authority and the
 * checkpoints; the employee supplies judgement, the amounts and the words.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TaskWorkspace } from "@/components/ui/workspace";
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
import { stateChip } from "@/lib/semantic";
import { evidenceProgress, type RequirementLike } from "@/lib/claims";
import {
  APPROVAL_STATUS_LABELS,
  ESCALATION_FLAG_LABELS,
  POLICY_VERSION,
  RECOVERY_ACTIONS,
  RECOVERY_ACTION_LABELS,
  RECOVERY_STAGE_LABELS,
  canClose,
  closureBlockers,
  effectiveOwner,
  evaluateAuthority,
  formatMoney,
  handoffPending,
  isMonetary,
  nextAction,
  nextGuestUpdateDue,
  policyBoundaryLabel,
  proposeStage,
  stageState,
  supervisorTriggerReason,
  supervisorTriggers,
  type EscalationFlag,
  type RecoveryAction,
} from "@/lib/guest-recovery";
import type { RecoveryActivityRow, RecoveryRow, RecoveryUpdate } from "@/lib/recovery-types";
import { usDateTime } from "@/lib/dates";

export function RecoveryDrawer({
  recovery,
  people,
  canEdit,
  propertyName,
  onClose,
}: {
  recovery: RecoveryRow | null;
  people: TeamMember[];
  canEdit: boolean;
  propertyName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});

  const requirements = useQuery({
    queryKey: ["recovery-evidence", recovery?.id],
    enabled: !!recovery,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_requirements")
        .select("*")
        .eq("subject_type", "guest_recovery")
        .eq("subject_id", recovery!.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const activity = useQuery({
    queryKey: ["recovery-activity", recovery?.id],
    enabled: !!recovery,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_recovery_activity")
        .select("*")
        .eq("recovery_id", recovery!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RecoveryActivityRow[];
    },
  });

  const reqs = (requirements.data ?? []) as RequirementLike[];
  const progress = useMemo(() => evidenceProgress(reqs), [reqs]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["guest-recovery"] });
    qc.invalidateQueries({ queryKey: ["recovery-requirements"] });
    qc.invalidateQueries({ queryKey: ["recovery-evidence", recovery?.id] });
    qc.invalidateQueries({ queryKey: ["recovery-activity", recovery?.id] });
    qc.invalidateQueries({ queryKey: ["recovery-for-ticket", recovery?.ticket_id] });
  };

  const save = useMutation({
    mutationFn: async ({
      patch,
      event,
      body,
      detail,
    }: {
      patch: RecoveryUpdate;
      event: string;
      body: string;
      detail?: Record<string, unknown>;
    }) => {
      if (!recovery) return;
      const { error } = await supabase.from("guest_recovery").update(patch).eq("id", recovery.id);
      if (error) throw error;
      await supabase.from("guest_recovery_activity").insert({
        recovery_id: recovery.id,
        author_id: userId,
        event_type: event,
        body,
        detail: { ...(detail ?? {}), policy_version: POLICY_VERSION } as never,
        is_demo: recovery.is_demo,
      });
    },
    onSuccess: () => {
      setNote("");
      refresh();
      toast.success("Refund or credit updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!recovery)
    return (
      <TaskWorkspace open={false} onOpenChange={() => onClose()} title="">
        {null}
      </TaskWorkspace>
    );

  const value = (key: keyof RecoveryRow) =>
    fields[key as string] ??
    (recovery[key] === null || recovery[key] === undefined ? "" : String(recovery[key]));
  const set = (key: string, v: string) => setFields((f) => ({ ...f, [key]: v }));

  const verdict = evaluateAuthority({
    recovery_action: recovery.recovery_action,
    proposed_amount: value("proposed_amount") || null,
    within_airbnb_policy: recovery.within_airbnb_policy,
    escalation_flags: recovery.escalation_flags,
  });
  const triggers = supervisorTriggers(recovery);
  const blockers = closureBlockers(recovery);
  const suggested = proposeStage(recovery, reqs);
  const updateDue = nextGuestUpdateDue(recovery);
  const owner = effectiveOwner(recovery);
  const readOnly = !canEdit;

  return (
    <TaskWorkspace open onOpenChange={(o) => (o ? null : onClose())} title={recovery.title}>
      <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Chip className={stateChip(stageState(recovery.stage))}>
              {RECOVERY_STAGE_LABELS[recovery.stage]}
            </Chip>
            <Chip>{recovery.priority.toUpperCase()}</Chip>
            <Chip>{APPROVAL_STATUS_LABELS[recovery.approval_status]}</Chip>
            <span className="text-xs text-muted-foreground">
              {propertyName} · {recovery.guest_name ?? "Guest unrecorded"} · owned by{" "}
              {owner ? displayName(people.find((p) => p.id === owner)) : "nobody yet"}
            </span>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium">{nextAction(recovery, { requirements: reqs })}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {policyBoundaryLabel(recovery.within_airbnb_policy)} · {verdict.label}
            </p>
            {updateDue ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Next guest update due {usDateTime(updateDue)}
              </p>
            ) : null}
          </div>

          {triggers.length > 0 ? (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
              <p className="text-sm font-medium">Involve James</p>
              <ul className="mt-1 list-disc pl-4">
                {triggers.map((t) => (
                  <li key={t}>{supervisorTriggerReason(t)}</li>
                ))}
              </ul>
              <p className="mt-1 text-muted-foreground">
                Escalation is guidance and approval — you remain the owner until a handoff is
                accepted.
              </p>
            </div>
          ) : null}

          {recovery.escalation_flags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {recovery.escalation_flags.map((flag) => (
                <Chip key={flag} className="border-danger/40 bg-danger/10 text-danger">
                  {ESCALATION_FLAG_LABELS[flag as EscalationFlag] ?? flag}
                </Chip>
              ))}
            </div>
          ) : null}

          <Separator />

          {/* Evidence ------------------------------------------------- */}
          <section className="space-y-2">
            <h3 className="font-display text-sm font-semibold">Evidence</h3>
            {reqs.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No checklist recorded for this recovery.
              </p>
            ) : (
              reqs.map((r) => (
                <div
                  key={r.slot_key}
                  className="flex items-center justify-between rounded border px-3 py-1.5"
                >
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
                {progress.blocking.length} required item(s) outstanding. Record an exception rather
                than skipping one silently.
              </p>
            ) : null}
          </section>

          <Separator />

          {/* Decision -------------------------------------------------- */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold">Decision</h3>

            <div className="space-y-1">
              <Label className="text-xs">Impact on the guest</Label>
              <Textarea
                rows={2}
                disabled={readOnly}
                value={value("impact_detail")}
                onChange={(e) => set("impact_detail", e.target.value)}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Remedy</Label>
                <Select
                  disabled={readOnly}
                  value={value("recovery_action")}
                  onValueChange={(v) => set("recovery_action", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Not decided" />
                  </SelectTrigger>
                  <SelectContent>
                    {RECOVERY_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {RECOVERY_ACTION_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Airbnb policy fit</Label>
                <Select
                  disabled={readOnly}
                  value={
                    recovery.within_airbnb_policy === null
                      ? (fields["within_airbnb_policy"] ?? "unknown")
                      : (fields["within_airbnb_policy"] ??
                        (recovery.within_airbnb_policy ? "within" : "outside"))
                  }
                  onValueChange={(v) => set("within_airbnb_policy", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Not confirmed yet</SelectItem>
                    <SelectItem value="within">Within normal policy</SelectItem>
                    <SelectItem value="outside">Outside normal policy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <MoneyField
                label="Guest asked for"
                k="guest_requested_amount"
                value={value}
                set={set}
                readOnly={readOnly}
              />
              <MoneyField
                label="Proposed"
                k="proposed_amount"
                value={value}
                set={set}
                readOnly={readOnly || !isMonetary(recovery.recovery_action)}
              />
              <MoneyField
                label="Approved"
                k="approved_amount"
                value={value}
                set={set}
                readOnly={readOnly}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <p className="text-sm font-medium">{verdict.label}</p>
              <p className="text-muted-foreground">{verdict.reason}</p>
              <p className="mt-1 text-muted-foreground">{POLICY_VERSION}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">
                Decision reason {verdict.requiresDecisionReason ? "(required)" : "(optional)"}
              </Label>
              <Textarea
                rows={2}
                disabled={readOnly}
                value={value("decision_reason")}
                onChange={(e) => set("decision_reason", e.target.value)}
                placeholder="Why this remedy, at this amount, for this guest."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={readOnly || save.isPending}
                onClick={() => {
                  const policy = fields["within_airbnb_policy"];
                  save.mutate({
                    patch: {
                      impact_detail: value("impact_detail") || null,
                      recovery_action: value("recovery_action") || null,
                      guest_requested_amount: numOrNull(value("guest_requested_amount")),
                      proposed_amount: numOrNull(value("proposed_amount")),
                      approved_amount: numOrNull(value("approved_amount")),
                      decision_reason: value("decision_reason") || null,
                      authority_level: verdict.level,
                      escalation_flags: verdict.escalations,
                      ...(policy
                        ? {
                            within_airbnb_policy: policy === "unknown" ? null : policy === "within",
                          }
                        : {}),
                    },
                    event: "decision",
                    body: "Decision updated",
                    detail: { authority: verdict.level, reason: verdict.reason },
                  });
                }}
              >
                Save decision
              </Button>

              {verdict.level !== "pc" && recovery.approval_status !== "pending" ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    readOnly ||
                    save.isPending ||
                    (verdict.requiresDecisionReason && !value("decision_reason"))
                  }
                  onClick={() =>
                    save.mutate({
                      patch: {
                        approval_status: "pending",
                        approval_authority: verdict.level,
                        stage: "awaiting_approval",
                        requested_at: new Date().toISOString(),
                        requested_by: userId,
                      },
                      event: "approval_requested",
                      body: `Approval requested — ${verdict.label}`,
                      detail: { reason: verdict.reason },
                    })
                  }
                >
                  Request approval
                </Button>
              ) : null}

              {suggested !== recovery.stage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || save.isPending}
                  onClick={() =>
                    save.mutate({
                      patch: { stage: suggested },
                      event: "stage",
                      body: `Stage moved to ${RECOVERY_STAGE_LABELS[suggested]}`,
                    })
                  }
                >
                  Move to {RECOVERY_STAGE_LABELS[suggested]}
                </Button>
              ) : null}
            </div>
          </section>

          <Separator />

          {/* Guest communication --------------------------------------- */}
          <section className="space-y-2">
            <h3 className="font-display text-sm font-semibold">Guest communication</h3>
            <div className="space-y-1">
              <Label className="text-xs">Update sent to the guest</Label>
              <Textarea
                rows={2}
                disabled={readOnly}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly || !note || save.isPending}
                onClick={() =>
                  save.mutate({
                    patch: {
                      last_guest_update_at: new Date().toISOString(),
                      promised_update_at: null,
                    },
                    event: "guest_update",
                    body: note,
                  })
                }
              >
                Record guest update
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={readOnly || !note || save.isPending}
                onClick={() =>
                  save.mutate({
                    patch: {
                      final_communication_at: new Date().toISOString(),
                      last_guest_update_at: new Date().toISOString(),
                    },
                    event: "final_communication",
                    body: note,
                  })
                }
              >
                Record final communication
              </Button>
            </div>
          </section>

          <Separator />

          {/* Delivery and closure -------------------------------------- */}
          <section className="space-y-3">
            <h3 className="font-display text-sm font-semibold">Delivery and closure</h3>
            <p className="text-xs text-muted-foreground">
              Refunds and credits are issued in OwnerRez; record here what was actually sent.
              QuickBooks remains the accounting record.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <MoneyField
                label="Amount issued"
                k="delivered_amount"
                value={value}
                set={set}
                readOnly={readOnly}
              />
              <div className="space-y-1">
                <Label className="text-xs">Issued via</Label>
                <Input
                  disabled={readOnly}
                  value={value("delivery_method")}
                  onChange={(e) => set("delivery_method", e.target.value)}
                  placeholder="OwnerRez refund, Airbnb resolution centre…"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Corrective action on the property</Label>
              <Textarea
                rows={2}
                disabled={readOnly}
                value={value("corrective_action")}
                onChange={(e) => set("corrective_action", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unresolved concern, if any</Label>
              <Input
                disabled={readOnly}
                value={value("unresolved_concern")}
                onChange={(e) => set("unresolved_concern", e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={readOnly || save.isPending}
                onClick={() =>
                  save.mutate({
                    patch: {
                      delivered_amount: numOrNull(value("delivered_amount")),
                      delivery_method: value("delivery_method") || null,
                      corrective_action: value("corrective_action") || null,
                      unresolved_concern: value("unresolved_concern") || null,
                      issued_by: userId,
                      issued_on: value("delivered_amount")
                        ? new Date().toISOString().slice(0, 10)
                        : null,
                    },
                    event: "delivered",
                    body: `Recorded ${formatMoney(numOrNull(value("delivered_amount")))} issued to the guest`,
                  })
                }
              >
                Save delivery
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={readOnly || save.isPending || !canClose(recovery)}
                onClick={() =>
                  save.mutate({
                    patch: { stage: "closed", closed_at: new Date().toISOString() },
                    event: "closed",
                    body: "Recovery closed",
                  })
                }
              >
                Close recovery
              </Button>
              {recovery.stage === "closed" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={readOnly || save.isPending}
                  onClick={() =>
                    save.mutate({
                      patch: {
                        stage: "completed",
                        reopened_at: new Date().toISOString(),
                        reopened_by: userId,
                        reopen_reason: note || "Reopened for review",
                        closed_at: null,
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

          {/* Related work ---------------------------------------------- */}
          <section className="space-y-2 text-xs">
            <h3 className="font-display text-sm font-semibold">Related</h3>
            <p>
              <Link
                to="/tickets/$ticketId"
                params={{ ticketId: recovery.ticket_id }}
                className="underline underline-offset-2"
              >
                Originating ticket
              </Link>
              {recovery.claim_id ? " · linked to a claim" : " · no claim linked"}
            </p>
            <p className="text-muted-foreground">
              A recovery gives the guest something back; a claim recovers cost from someone else.
              Link one only when both are genuinely running.
            </p>
            {handoffPending(recovery) ? (
              <p className="text-warning">
                Handoff requested and not yet accepted — you are still responsible for this
                recovery.
              </p>
            ) : null}
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
    </TaskWorkspace>
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
  k: keyof RecoveryRow & string;
  value: (key: keyof RecoveryRow) => string;
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
