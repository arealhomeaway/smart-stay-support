/**
 * Create a claim from the ticket where the incident was handled.
 *
 * The ticket stays the operational record — what happened and who fixed it.
 * The claim is the recovery process that follows. Everything Resolve already
 * knows about the stay is carried across, so nobody retypes it, and the
 * evidence checklist for the chosen claim type is created up front.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CLAIM_STAGE_LABELS,
  CLAIM_TYPE_LABELS,
  RECOVERY_SOURCE,
  deadlineLabel,
  evidenceSlots,
  findDuplicates,
  formatMoney,
  nextAction,
  stageState,
  type ClaimType,
} from "@/lib/claims";
import type { ClaimRow } from "@/lib/claim-types";

const TYPES: ClaimType[] = [
  "channel_aircover",
  "channel_vrbo",
  "guest_damage",
  "deposit_recovery",
  "insurance",
  "owner_recovery",
];

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

/** The claim type a channel booking usually points to — always overridable. */
function suggestType(channel: string | null | undefined): ClaimType {
  const c = (channel ?? "").toLowerCase();
  if (c.includes("airbnb")) return "channel_aircover";
  if (c.includes("vrbo") || c.includes("homeaway")) return "channel_vrbo";
  return "guest_damage";
}

export function TicketClaimPanel({ ticket }: { ticket: TicketContext }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { can, readOnly } = useRole();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ClaimType>(suggestType(ticket.ownerrez_channel));
  const [deadline, setDeadline] = useState("");
  const [acknowledgedDuplicate, setAcknowledgedDuplicate] = useState(false);

  const claims = useQuery({
    queryKey: ["claims-for-ticket", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClaimRow[];
    },
  });

  // Two recovery paths for one incident are legitimate, so a match warns.
  const openClaims = useQuery({
    queryKey: ["claims-duplicate-check", ticket.property_id, ticket.ownerrez_booking_id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .eq("property_id", ticket.property_id ?? "")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as ClaimRow[];
    },
  });

  const duplicates = open
    ? findDuplicates(
        {
          claim_type: type,
          property_id: ticket.property_id ?? null,
          ticket_id: ticket.id,
          ownerrez_booking_id: ticket.ownerrez_booking_id ?? null,
        },
        openClaims.data ?? [],
      )
    : [];

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .insert({
          claim_type: type,
          stage: "gathering",
          title: ticket.title,
          incident_description: ticket.description ?? null,
          incident_on: new Date().toISOString().slice(0, 10),
          property_id: ticket.property_id ?? null,
          ticket_id: ticket.id,
          guest_name: ticket.guest_name ?? null,
          reservation_channel: ticket.ownerrez_channel ?? null,
          reservation_confirmation: ticket.ownerrez_confirmation_code ?? null,
          ownerrez_booking_id: ticket.ownerrez_booking_id ?? null,
          stay_arrival: ticket.ownerrez_arrival ?? null,
          stay_departure: ticket.ownerrez_departure ?? null,
          assigned_to: userId,
          deadline_on: deadline || null,
          created_by: userId,
          is_demo: ticket.is_demo ?? false,
        })
        .select("id")
        .single();
      if (error) throw error;

      const claimId = data.id as string;
      const slots = evidenceSlots(type).map((slot) => ({
        subject_type: "claim",
        subject_id: claimId,
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

      await supabase.from("claim_activity").insert({
        claim_id: claimId,
        author_id: userId,
        event_type: "created",
        body: `Claim opened from ticket — recovering from ${RECOVERY_SOURCE[type]}`,
        is_demo: ticket.is_demo ?? false,
      });
      return claimId;
    },
    onSuccess: () => {
      setOpen(false);
      setAcknowledgedDuplicate(false);
      qc.invalidateQueries({ queryKey: ["claims-for-ticket", ticket.id] });
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["claim-requirements"] });
      toast.success("Claim opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("claims_work")) return null;

  const existing = claims.data ?? [];
  const blockedByWarning = duplicates.length > 0 && !acknowledgedDuplicate;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recovery</CardTitle>
        <CardDescription>
          Open a claim when the cost of this ticket should come back from a guest, platform, insurer or owner.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {existing.map((claim) => (
          <Link
            key={claim.id}
            to="/claims"
            className="block rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Chip className={stateChip(stageState(claim.stage))}>{CLAIM_STAGE_LABELS[claim.stage]}</Chip>
              <Chip>{CLAIM_TYPE_LABELS[claim.claim_type]}</Chip>
            </div>
            <p className="mt-1 font-medium">{nextAction(claim)}</p>
            <p className="text-xs text-muted-foreground">
              {deadlineLabel(claim.deadline_on)} · recovered {formatMoney(claim.recovered_amount)}
            </p>
          </Link>
        ))}

        {readOnly ? null : !open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {existing.length ? "Open another claim" : "Open a claim"}
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label className="text-xs">Recover from</Label>
              <Select value={type} onValueChange={(v) => setType(v as ClaimType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{CLAIM_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sets the evidence checklist: {evidenceSlots(type).filter((s) => s.required).map((s) => s.label).join(", ")}.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="claim-new-deadline">Submission deadline (optional)</Label>
              <Input
                id="claim-new-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Only if the platform states one — Resolve never invents a deadline.
              </p>
            </div>

            {duplicates.length > 0 ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                <p className="text-sm font-medium">Possible duplicate</p>
                <p className="text-xs text-muted-foreground">{duplicates[0]?.reason} Review before opening another.</p>
                <label className="mt-2 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={acknowledgedDuplicate}
                    onChange={(e) => setAcknowledgedDuplicate(e.target.checked)}
                  />
                  This is a separate recovery
                </label>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button disabled={create.isPending || blockedByWarning} onClick={() => create.mutate()}>
                Open claim
              </Button>
              <Button variant="ghost" onClick={() => { setOpen(false); setAcknowledgedDuplicate(false); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
