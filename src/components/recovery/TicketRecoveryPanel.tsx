/**
 * Guest Recovery on the ticket where the guest situation is being handled.
 *
 * The ticket says what broke. The recovery says what the guest is owed and who
 * has to approve it. Context comes across from the ticket by reference, so the
 * only thing an employee types is the decision itself.
 */
import { useState } from "react";
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
  RECOVERY_ACTION_LABELS,
  RECOVERY_STAGE_LABELS,
  evaluateAuthority,
  evidenceSlots,
  findDuplicates,
  formatMoney,
  isMonetary,
  nextAction,
  stageState,
  type RecoveryAction,
  type RecoveryStage,
} from "@/lib/guest-recovery";

type TicketContext = {
  id: string;
  title: string;
  description?: string | null;
  property_id?: string | null;
  guest_name?: string | null;
  is_demo?: boolean | null;
  ownerrez_booking_id?: string | null;
  ownerrez_channel?: string | null;
  ownerrez_confirmation_code?: string | null;
  ownerrez_arrival?: string | null;
  ownerrez_departure?: string | null;
};

type RecoveryRow = {
  id: string;
  stage: RecoveryStage;
  recovery_action: RecoveryAction | null;
  title: string;
  impact_detail: string | null;
  nightly_rate: number | null;
  impacted_nights: number | null;
  proposed_amount: number | null;
  approved_amount: number | null;
  delivered_amount: number | null;
  stay_departure: string | null;
  ticket_id: string | null;
  ownerrez_booking_id: string | null;
};

const ACTIONS: RecoveryAction[] = [
  "none",
  "apology",
  "mitigation",
  "credit",
  "partial_refund",
  "full_refund",
  "fee_waiver",
  "shorten_stay",
  "relocation",
];

export function TicketRecoveryPanel({ ticket }: { ticket: TicketContext }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { can, readOnly } = useRole();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<RecoveryAction | "">("");
  const [impact, setImpact] = useState("");
  const [nightlyRate, setNightlyRate] = useState("");
  const [nights, setNights] = useState("");
  const [amount, setAmount] = useState("");
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

  const stayRecoveries = useQuery({
    queryKey: ["recovery-duplicate-check", ticket.ownerrez_booking_id, ticket.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_recovery")
        .select("*")
        .eq("ticket_id", ticket.id)
        .limit(25);
      if (error) throw error;
      return (data ?? []) as unknown as RecoveryRow[];
    },
  });

  const duplicates = open
    ? findDuplicates(
        { ticket_id: ticket.id, ownerrez_booking_id: ticket.ownerrez_booking_id ?? null },
        stayRecoveries.data ?? [],
      )
    : [];

  const verdict = evaluateAuthority({
    recovery_action: action || null,
    proposed_amount: amount || null,
    nightly_rate: nightlyRate || null,
    impacted_nights: nights || null,
  });

  const create = useMutation({
    mutationFn: async () => {
      const chosen = (action || null) as RecoveryAction | null;
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
          nightly_rate: nightlyRate ? Number(nightlyRate) : null,
          impacted_nights: nights ? Number(nights) : null,
          proposed_amount: amount ? Number(amount) : null,
          authority_level: verdict.level,
          assigned_to: userId,
          created_by: userId,
          is_demo: ticket.is_demo ?? false,
        } as never)
        .select("id")
        .single();
      if (error) throw error;
      const recoveryId = (data as { id: string }).id;

      const slots = evidenceSlots(chosen).map((slot) => ({
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
          ? `Recovery opened from ticket — proposed remedy: ${RECOVERY_ACTION_LABELS[chosen]}`
          : "Recovery opened from ticket",
        detail: { authority: verdict.level, reason: verdict.reason },
        is_demo: ticket.is_demo ?? false,
      } as never);
      return recoveryId;
    },
    onSuccess: () => {
      setOpen(false);
      setAcknowledged(false);
      setImpact("");
      setAmount("");
      qc.invalidateQueries({ queryKey: ["recovery-for-ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["guest-recovery"] });
      toast.success("Guest recovery opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("claims_work")) return null;

  const existing = recoveries.data ?? [];
  const blocked = duplicates.length > 0 && !acknowledged;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest recovery</CardTitle>
        <CardDescription>
          What the guest is owed after this failure — separate from recovering the cost from anyone else.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {existing.map((row) => (
          <div key={row.id} className="rounded-md border px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={stateChip(stageState(row.stage))}>{RECOVERY_STAGE_LABELS[row.stage]}</Chip>
              {row.recovery_action ? <Chip>{RECOVERY_ACTION_LABELS[row.recovery_action]}</Chip> : null}
            </div>
            <p className="mt-1 font-medium">{nextAction(row)}</p>
            <p className="text-xs text-muted-foreground">
              Proposed {formatMoney(row.proposed_amount)} · approved {formatMoney(row.approved_amount)} · delivered{" "}
              {formatMoney(row.delivered_amount)}
            </p>
          </div>
        ))}

        {readOnly ? null : !open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {existing.length ? "Open another recovery" : "Open a guest recovery"}
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="rec-impact">What did the guest actually lose?</Label>
              <Textarea
                id="rec-impact"
                value={impact}
                rows={2}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="No hot water for two nights; guest showered at the neighbours'."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Proposed remedy</Label>
              <Select value={action} onValueChange={(v) => setAction(v as RecoveryAction)}>
                <SelectTrigger><SelectValue placeholder="Decide later" /></SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{RECOVERY_ACTION_LABELS[a]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="rec-rate">Nightly rate</Label>
                <Input id="rec-rate" type="number" value={nightlyRate} onChange={(e) => setNightlyRate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="rec-nights">Impacted nights</Label>
                <Input id="rec-nights" type="number" value={nights} onChange={(e) => setNights(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="rec-amount">Proposed amount</Label>
                <Input
                  id="rec-amount"
                  type="number"
                  value={amount}
                  disabled={!isMonetary(action || null)}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-medium">{verdict.label}</p>
              <p className="text-xs text-muted-foreground">{verdict.reason}</p>
            </div>

            {duplicates.length > 0 ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                <p className="text-sm font-medium">Possible duplicate</p>
                <p className="text-xs text-muted-foreground">{duplicates[0]?.reason} Review before opening another.</p>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                  This is a separate remedy
                </label>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button disabled={create.isPending || blocked} onClick={() => create.mutate()}>
                Open recovery
              </Button>
              <Button variant="ghost" onClick={() => { setOpen(false); setAcknowledged(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
