/**
 * The Claim card's approval (Emily, Nov 7, 2026; register C2), like the Refund card: over $500 a
 * coordinator asks; the Operations Supervisor (to $1,500) or the Director of Operations (above)
 * approves or declines with a required reason. The database functions request_claim_approval and
 * decide_claim_approval check the roles; rules in src/lib/claim-approval.ts.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRecoveryAuthority } from "@/components/recovery/RecoveryDecisionBox";
import { decisionReasonMissing } from "@/lib/guest-recovery";
import {
  CLAIM_APPROVAL_COPY as C,
  canDecideClaim,
  claimApprovalState,
  claimAuthority,
  parseAmount,
} from "@/lib/claim-approval";

export type ClaimApprovalFields = {
  id: string;
  estimated_amount?: number | string | null;
  submitted_amount?: number | string | null;
  approval_status?: string | null;
  approval_authority?: string | null;
  approval_amount?: number | string | null;
  approval_reason?: string | null;
};

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;

const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

export function ClaimApprovalBox({
  claim,
  canAsk,
  onDone,
}: {
  claim: ClaimApprovalFields;
  canAsk: boolean;
  onDone: () => void;
}) {
  const authority = useRecoveryAuthority();
  const known = num(claim.submitted_amount) ?? num(claim.estimated_amount);
  const [amountText, setAmountText] = useState(known !== null ? String(known) : "");
  const [reason, setReason] = useState("");
  const state = claimApprovalState(claim);
  const amount = parseAmount(amountText);
  const needed = claimAuthority(amount);
  // Bind: supabase-js rpc reads this.rest, so a detached reference crashes.
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;

  const ask = useMutation({
    mutationFn: async () => {
      const { error } = await rpc("request_claim_approval", { _claim_id: claim.id, _amount: amount });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      onDone();
      toast.success(C.asked);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async (decision: "approve" | "decline") => {
      const { error } = await rpc("decide_claim_approval", { _claim_id: claim.id, _decision: decision, _reason: reason.trim() });
      if (error) throw new Error(error.message);
      return decision;
    },
    onSuccess: (d) => {
      setReason("");
      onDone();
      toast.success(d === "approve" ? C.decidedApprove : C.decidedDecline);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewer = authority.data;
  const mayDecide = state === "pending" && viewer ? canDecideClaim(claim.approval_authority, viewer) : false;

  return (
    <div className="space-y-2 rounded-md border p-3" data-testid="claim-approval">
      <p className="font-medium">{C.title}</p>

      {state === "approved" ? (
        <p className="text-sm">{C.approved(num(claim.approval_amount), claim.approval_reason ?? null)}</p>
      ) : null}
      {state === "declined" ? <p className="text-sm">{C.declined(claim.approval_reason ?? null)}</p> : null}

      {state === "pending" ? (
        <p className="text-sm">{C.waiting[claim.approval_authority ?? "supervisor"] ?? C.waiting["supervisor"]}</p>
      ) : null}

      {mayDecide ? (
        <div className="space-y-2">
          <div>
            <Label htmlFor={`claim-reason-${claim.id}`}>{C.reason}</Label>
            <Textarea id={`claim-reason-${claim.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={decide.isPending || decisionReasonMissing(reason)} onClick={() => decide.mutate("approve")}>
              {C.approve}
            </Button>
            <Button className="min-h-11" variant="outline" disabled={decide.isPending || decisionReasonMissing(reason)} onClick={() => decide.mutate("decline")}>
              {C.decline}
            </Button>
          </div>
        </div>
      ) : null}

      {canAsk && state !== "pending" ? (
        <div className="space-y-2">
          <div>
            <Label htmlFor={`claim-amount-${claim.id}`}>{C.amount}</Label>
            <Input
              id={`claim-amount-${claim.id}`}
              className="min-h-11"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
            />
          </div>
          {amount !== null ? <p className="text-xs text-muted-foreground">{C.who[needed]}</p> : null}
          {amount !== null && needed !== "coordinator" && (state !== "approved" || amount > (num(claim.approval_amount) ?? 0)) ? (
            <Button className="min-h-11" variant="outline" disabled={ask.isPending} onClick={() => ask.mutate()}>
              {ask.isPending ? C.asking : C.ask}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
