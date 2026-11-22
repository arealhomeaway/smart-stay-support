/**
 * Escalate on an owner card: asks what is needed, then sends it to the Director of Onboarding
 * (in app and by email). One open escalation per card; pressing again shows it is already escalated.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { raiseOnboardingEscalationFn } from "@/lib/onboarding-escalations.functions";
import { escalationsKey } from "./EscalationsSection";

export function EscalateButton(p: { propertyId: string; workItemId: string | null; taskId?: string | null; title: string; escalated?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const raise = useServerFn(raiseOnboardingEscalationFn);
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: () => raise({ data: { workItemId: p.workItemId, taskId: p.taskId ?? null, reason } }),
    onSuccess: () => {
      toast.success("Escalated to the Director of Onboarding.");
      setOpen(false);
      setReason("");
      void qc.invalidateQueries({ queryKey: escalationsKey(p.propertyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (p.escalated) {
    return (
      <Button variant="outline" className="min-h-11" disabled>
        Escalated
      </Button>
    );
  }
  return (
    <>
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        Escalate
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate to the Director of Onboarding</DialogTitle>
            <DialogDescription>{p.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="escalate-reason">What do you need?</Label>
            <Textarea id="escalate-reason" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
              Not now
            </Button>
            <Button className="min-h-11" disabled={reason.trim().length < 3 || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? "Sending..." : "Escalate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
