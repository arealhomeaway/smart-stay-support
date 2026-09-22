/**
 * Where is this home worked? One control, both directions.
 *
 * Moving a home into Onboarding also makes sure it has a live project and task
 * plan, so it shows up in the Onboarding hub ready to work. Existing task
 * progress and notes are never touched.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status";
import { switchPropertyLifecycleFn } from "@/lib/onboarding.functions";

const LABEL: Record<string, string> = {
  onboarding: "Onboarding",
  active_operations: "Active operations",
  not_onboarded: "Not started",
  handoff_requested: "Handoff requested",
  handoff_corrections: "Handoff corrections",
  offboarded: "Offboarded",
};

export function LifecycleSwitcher({
  propertyId,
  propertyName,
  lifecycleStatus,
  canManage,
}: {
  propertyId: string;
  propertyName: string;
  lifecycleStatus: string | null;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const switchFn = useServerFn(switchPropertyLifecycleFn);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const current = lifecycleStatus ?? "active_operations";
  const target = current === "onboarding" ? "active_operations" : "onboarding";

  const move = useMutation({
    mutationFn: () => switchFn({ data: { propertyId, target, reason: reason.trim() } }),
    onSuccess: (result) => {
      toast.success(
        target === "onboarding"
          ? `${propertyName} is in Onboarding${result.createdTasks ? ` with ${result.createdTasks} steps added` : ""}.`
          : `${propertyName} is now in Active operations.`,
      );
      setOpen(false);
      setReason("");
      void qc.invalidateQueries();
    },
    onError: (error: unknown) => {
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message?: unknown }).message)
          : "";
      toast.error(message || "That move did not go through. Please try again.");
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Stage</span>
      <StatusBadge tone={current === "onboarding" ? "waiting" : "resolved"}>
        {LABEL[current] ?? current}
      </StatusBadge>
      {canManage ? (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <ArrowLeftRight className="size-4" aria-hidden="true" />
          Move to {LABEL[target]}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {propertyName} to {LABEL[target]}</DialogTitle>
            <DialogDescription>
              {target === "onboarding"
                ? "The home appears in the Onboarding hub straight away. If it already has a plan, that work and its notes stay exactly as they are; if it has none, a full plan is created."
                : "Only use this for a home that never went through onboarding. A home in onboarding leaves it through the handoff review instead."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lifecycle-reason">Why are you moving it?</Label>
            <Textarea
              id="lifecycle-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Closing pushed back, home needs setup work again…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => move.mutate()}
              disabled={reason.trim().length < 3 || move.isPending}
            >
              {move.isPending ? "Moving…" : `Move to ${LABEL[target]}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
