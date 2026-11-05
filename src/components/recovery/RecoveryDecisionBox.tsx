/**
 * Approve / Decline for a refund or credit awaiting approval. Shown only to a
 * viewer allowed at the required level (canDecideApproval); the database
 * function decide_recovery_approval re-checks the approver's role.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUserId } from "@/hooks/useTeam";
import { canDecideApproval, decisionReasonMissing } from "@/lib/guest-recovery";

export function useRecoveryAuthority() {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: ["recovery-viewer-authority", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [sup, dir] = await Promise.all([
        supabase.rpc("is_supervisor", { _user_id: userId! }),
        supabase.rpc("is_director", { _user_id: userId! }),
      ]);
      return { isSupervisor: sup.data === true, isDirector: dir.data === true };
    },
  });
}

export function RecoveryDecisionBox({
  recovery,
  onDone,
}: {
  recovery: { id: string; approval_status?: string | null; approval_authority?: string | null; proposed_amount?: number | string | null };
  onDone: () => void;
}) {
  const authority = useRecoveryAuthority();
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionAmount, setDecisionAmount] = useState("");
  const decide = useMutation({
    mutationFn: async (decision: "approve" | "decline") => {
      const amount = decisionAmount.trim() === "" ? null : Number(decisionAmount);
      // decide_recovery_approval checks the approver's role in the database.
      // Bind: supabase-js rpc reads this.rest, so a detached reference crashes.
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
      const { error } = await rpc("decide_recovery_approval", {
        _recovery_id: recovery.id,
        _decision: decision,
        _approved_amount: decision === "approve" ? amount : null,
        _reason: decisionReason.trim(),
      });
      if (error) throw new Error(error.message);
      return decision;
    },
    onSuccess: (d) => {
      setDecisionReason("");
      setDecisionAmount("");
      onDone();
      toast.success(d === "approve" ? "Approved" : "Declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (recovery.approval_status !== "pending" || !authority.data) return null;
  if (!canDecideApproval(recovery.approval_authority, authority.data)) return null;

  return (
    <div className="w-full space-y-2 rounded-md border p-3" data-testid="recovery-decision">
      <p className="font-medium">Your decision</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor={`decision-amount-${recovery.id}`}>Approved amount</Label>
          <Input
            id={`decision-amount-${recovery.id}`}
            inputMode="decimal"
            placeholder={recovery.proposed_amount != null ? String(recovery.proposed_amount) : ""}
            value={decisionAmount}
            onChange={(e) => setDecisionAmount(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`decision-reason-${recovery.id}`}>Reason (required)</Label>
        <Textarea
          id={`decision-reason-${recovery.id}`}
          rows={2}
          value={decisionReason}
          onChange={(e) => setDecisionReason(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={decide.isPending || decisionReasonMissing(decisionReason)} onClick={() => decide.mutate("approve")}>
          Approve
        </Button>
        <Button size="sm" variant="outline" disabled={decide.isPending || decisionReasonMissing(decisionReason)} onClick={() => decide.mutate("decline")}>
          Decline
        </Button>
      </div>
    </div>
  );
}
