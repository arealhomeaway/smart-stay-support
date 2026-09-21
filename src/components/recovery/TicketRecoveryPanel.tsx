/**
 * Guest refunds & credits on the ticket where the guest situation is being handled.
 *
 * The ticket says what broke. The recovery says what the guest is owed and who
 * has to approve it. Context comes across from the ticket by reference, so the
 * only thing an employee types is the decision itself. Every threshold shown
 * here comes from the central ARHA policy — nothing is decided in this file.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { stateChip } from "@/lib/semantic";
import {
  ESCALATION_FLAGS,
  ESCALATION_FLAG_LABELS,
  POLICY_VERSION,
  RECOVERY_ACTIONS,
  RECOVERY_ACTION_LABELS,
  RECOVERY_STAGE_LABELS,
  SITUATION_LABELS,
  evaluateAuthority,
  evidenceSlots,
  findDuplicates,
  formatMoney,
  isMonetary,
  nextAction,
  policyBoundaryLabel,
  stageState,
  type EscalationFlag,
  type RecoveryAction,
  type RecoverySituation,
  type RecoveryStage,
} from "@/lib/guest-recovery";

type TicketContext = {
  id: string;
  title: string;
  description?: string | null;
  property_id?: string | null;
  guest_name?: string | null;
  priority?: string | null;
  is_demo?: boolean | null;
  ownerrez_booking_id?: string | null;
  ownerrez_channel?: string | null;
  ownerrez_confirmation_code?: string | null;
  ownerrez_arrival?: string | null;
  ownerrez_departure?: string | null;
  guest_recovery_needed?: boolean | null;
};

type RecoveryRow = {
  id: string;
  stage: RecoveryStage;
  recovery_action: RecoveryAction | null;
  title: string;
  impact_detail: string | null;
  proposed_amount: number | null;
  approved_amount: number | null;
  delivered_amount: number | null;
  stay_departure: string | null;
  ticket_id: string | null;
  ownerrez_booking_id: string | null;
  within_airbnb_policy?: boolean | null;
  escalation_flags?: string[] | null;
};

const SITUATIONS = Object.keys(SITUATION_LABELS) as RecoverySituation[];

export function TicketRecoveryPanel({ ticket }: { ticket: TicketContext }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { can, readOnly } = useRole();
  const [open, setOpen] = useState(false);
  const [situation, setSituation] = useState<RecoverySituation>("general");
  const [action, setAction] = useState<RecoveryAction | "">("");
  const [impact, setImpact] = useState("");
  const [requested, setRequested] = useState("");
  const [amount, setAmount] = useState("");
  const [policyFit, setPolicyFit] = useState<"unknown" | "within" | "outside">("unknown");
  const [flags, setFlags] = useState<EscalationFlag[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);

  const recoveries = useQuery({
    queryKey: ["recovery-for-ticket", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_recovery")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RecoveryRow[];
    },
  });

  const duplicates = open
    ? findDuplicates(
        { ticket_id: ticket.id, ownerrez_booking_id: ticket.ownerrez_booking_id ?? null },
        recoveries.data ?? [],
      )
    : [];

  const withinPolicy = policyFit === "unknown" ? null : policyFit === "within";

  const verdict = evaluateAuthority({
    recovery_action: action || null,
    proposed_amount: amount || null,
    within_airbnb_policy: withinPolicy,
    escalation_flags: flags,
  });

  const create = useMutation({
    mutationFn: async () => {
      const chosen = (action || null) as RecoveryAction | null;
      const escalations = verdict.escalations;
      const { data, error } = await supabase
        .from("guest_recovery")
        .insert({
          ticket_id: ticket.id,
          property_id: ticket.property_id ?? null,
          stage: impact ? "impact_confirmed" : "reported",
          title: ticket.title,
          issue_summary: ticket.description ?? null,
          impact_detail: impact || null,
          recovery_action: chosen,
          guest_name: ticket.guest_name ?? null,
          reservation_channel: ticket.ownerrez_channel ?? null,
          reservation_confirmation: ticket.ownerrez_confirmation_code ?? null,
          ownerrez_booking_id: ticket.ownerrez_booking_id ?? null,
          stay_arrival: ticket.ownerrez_arrival ?? null,
          stay_departure: ticket.ownerrez_departure ?? null,
          priority: ticket.priority ?? "p3",
          guest_requested_amount: requested ? Number(requested) : null,
          proposed_amount: amount ? Number(amount) : null,
          within_airbnb_policy: withinPolicy,
          escalation_flags: escalations,
          authority_level: verdict.level,
          approval_status: verdict.level === "pc" ? "not_required" : "pending",
          policy_version: POLICY_VERSION,
          assigned_to: userId,
          created_by: userId,
          is_demo: ticket.is_demo ?? false,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const recoveryId = (data as { id: string }).id;

      const slots = evidenceSlots(chosen, situation).map((slot) => ({
        subject_type: "guest_recovery",
        subject_id: recoveryId,
        property_id: ticket.property_id ?? null,
        slot_key: slot.key,
        label: slot.label,
        requirement_kind: slot.kind,
        instruction: slot.instruction,
        required: slot.required,
        status: "awaiting",
        created_by: userId,
      }));
      if (slots.length) {
        const { error: reqError } = await supabase.from("evidence_requirements").insert(slots);
        if (reqError) throw reqError;
      }

      await supabase.from("guest_recovery_activity").insert({
        recovery_id: recoveryId,
        author_id: userId,
        event_type: "created",
        body: chosen
          ? `Refund or credit opened from ticket — proposed remedy: ${RECOVERY_ACTION_LABELS[chosen]}`
          : "Refund or credit opened from ticket",
        detail: {
          authority: verdict.level,
          reason: verdict.reason,
          escalations,
          policy_version: POLICY_VERSION,
        },
        is_demo: ticket.is_demo ?? false,
      } as never);

      // A recovery on a ticket is itself the documentation, so the ticket says so.
      if (!ticket.guest_recovery_needed) {
        await supabase
          .from("tickets")
          .update({
            guest_recovery_needed: true,
            guest_recovery_flagged_at: new Date().toISOString(),
            guest_recovery_flagged_by: userId,
          } as never)
          .eq("id", ticket.id);
      }
      return recoveryId;
    },
    onSuccess: () => {
      setOpen(false);
      setAcknowledged(false);
      setImpact("");
      setAmount("");
      setRequested("");
      setFlags([]);
      setPolicyFit("unknown");
      qc.invalidateQueries({ queryKey: ["recovery-for-ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["guest-recovery"] });
      toast.success("Guest refunds & credits opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Documenting it on the ticket is the decision; logging the recovery is the
  // next step, so saying yes opens the form straight away.
  const flagged = Boolean(ticket.guest_recovery_needed);
  const flag = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("tickets")
        .update({
          guest_recovery_needed: next,
          guest_recovery_flagged_at: next ? new Date().toISOString() : null,
          guest_recovery_flagged_by: next ? userId : null,
        } as never)
        .eq("id", ticket.id);
      if (error) throw error;
      await supabase.from("ticket_activity").insert({
        ticket_id: ticket.id,
        author_id: userId,
        kind: "status",
        event_type: next ? "guest_recovery_flagged" : "guest_recovery_unflagged",
        body: next
          ? "Documented on the ticket: this resulted in guest refund or credit."
          : "Guest refunds & credits no longer applies to this ticket.",
        internal: true,
        is_demo: ticket.is_demo ?? false,
      } as never);
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["tickets"] });
      if (next) setOpen(true);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("claims_work")) return null;

  const existing = recoveries.data ?? [];
  const blocked = duplicates.length > 0 && !acknowledged;

  const toggleFlag = (flag: EscalationFlag) =>
    setFlags((current) =>
      current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag],
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Make it right for the guest</CardTitle>
        <CardDescription>
          What the guest is owed after this failure — separate from recovering the cost from anyone
          else.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <label className="flex items-start gap-2 rounded-md border px-3 py-2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={flagged}
            disabled={readOnly || flag.isPending || (flagged && existing.length > 0)}
            onChange={(e) => flag.mutate(e.target.checked)}
          />
          <span>
            <span className="font-medium">This ticket resulted in guest refund or credit</span>
            <span className="block text-xs text-muted-foreground">
              {flagged
                ? existing.length > 0
                  ? "Recorded on this ticket and linked to the refund or credit below."
                  : "Recorded — log what the guest is owed to finish it."
                : "Tick this and the refund or credit log opens straight away."}
            </span>
          </span>
        </label>

        {existing.map((row) => (
          <div key={row.id} className="rounded-md border px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={stateChip(stageState(row.stage))}>
                {RECOVERY_STAGE_LABELS[row.stage]}
              </Chip>
              {row.recovery_action ? (
                <Chip>{RECOVERY_ACTION_LABELS[row.recovery_action]}</Chip>
              ) : null}
              {row.within_airbnb_policy === false ? (
                <Chip className={stateChip("blocked")}>Outside standard policy</Chip>
              ) : null}
            </div>
            <p className="mt-1 font-medium">{nextAction(row)}</p>
            <p className="text-xs text-muted-foreground">
              Proposed {formatMoney(row.proposed_amount)} · approved{" "}
              {formatMoney(row.approved_amount)} · issued {formatMoney(row.delivered_amount)}
            </p>
            <Link
              to="/recovery"
              search={{ open: row.id }}
              className="text-xs font-medium underline underline-offset-2"
            >
              See it in Guest refunds & credits
            </Link>
          </div>
        ))}

        {readOnly ? null : !open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {existing.length ? "Open another refund or credit" : "Open a guest refund or credit"}
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="rec-impact">
                What did the guest actually lose?
              </Label>
              <Textarea
                id="rec-impact"
                value={impact}
                rows={2}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="No hot water for two nights; guest showered at the neighbours'."
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Situation</Label>
                <Select
                  value={situation}
                  onValueChange={(v) => setSituation(v as RecoverySituation)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SITUATIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SITUATION_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Proposed remedy</Label>
                <Select value={action} onValueChange={(v) => setAction(v as RecoveryAction)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Decide later" />
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
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="rec-requested">
                  Guest asked for
                </Label>
                <Input
                  id="rec-requested"
                  type="number"
                  value={requested}
                  onChange={(e) => setRequested(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="rec-amount">
                  Proposed amount
                </Label>
                <Input
                  id="rec-amount"
                  type="number"
                  value={amount}
                  disabled={!isMonetary(action || null)}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Airbnb policy fit</Label>
                <Select
                  value={policyFit}
                  onValueChange={(v) => setPolicyFit(v as typeof policyFit)}
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

            <div className="space-y-1">
              <Label className="text-xs">Anything that raises the stakes?</Label>
              <div className="flex flex-wrap gap-2">
                {ESCALATION_FLAGS.filter(
                  (f) => f !== "outside_policy" && f !== "multi_night_refund" && f !== "relocation",
                ).map((flag) => (
                  <label
                    key={flag}
                    className="flex items-center gap-1 rounded border px-2 py-1 text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={flags.includes(flag)}
                      onChange={() => toggleFlag(flag)}
                    />
                    {ESCALATION_FLAG_LABELS[flag]}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-medium">{verdict.label}</p>
              <p className="text-xs text-muted-foreground">{verdict.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {policyBoundaryLabel(withinPolicy)} · {POLICY_VERSION}
              </p>
            </div>

            {duplicates.length > 0 ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                <p className="text-sm font-medium">Possible duplicate</p>
                <p className="text-xs text-muted-foreground">
                  {duplicates[0]?.reason} Review before opening another.
                </p>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  This is a separate remedy
                </label>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button disabled={create.isPending || blocked} onClick={() => create.mutate()}>
                Open refund or credit
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setAcknowledged(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
