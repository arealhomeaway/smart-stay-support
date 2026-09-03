import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { HandHeart } from "lucide-react";
import { toast } from "sonner";
import {
  closeOwnerOpportunity,
  offerOwnerOpportunity,
  ownerOpportunityContext,
} from "@/lib/owner-opportunity.functions";
import {
  ACTION_TYPE_META,
  OWNER_ACTION_TYPES,
  actionLabel,
  opportunityState,
  OPPORTUNITY_STATE_META,
  type OwnerActionType,
} from "@/lib/owner-opportunity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Offers one real piece of Resolve work to the homeowner as a participation
 * opportunity. The underlying task or ticket is never duplicated or changed —
 * this only creates the owner-facing offer that points back at it.
 */
export function OwnerParticipationOffer({
  source,
  sourceId,
}: {
  source: "onboarding" | "operations";
  sourceId: string;
}) {
  const qc = useQueryClient();
  const load = useServerFn(ownerOpportunityContext);
  const offer = useServerFn(offerOwnerOpportunity);
  const close = useServerFn(closeOwnerOpportunity);
  const [open, setOpen] = useState(false);

  const key = ["owner-opportunity", source, sourceId];
  const ctx = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { source, sourceId } }),
    retry: false,
  });

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [actionType, setActionType] = useState<OwnerActionType>("review");
  const [availableFrom, setAvailableFrom] = useState("");
  const [respondBy, setRespondBy] = useState("");
  const [staffContext, setStaffContext] = useState("");

  const save = useMutation({
    mutationFn: () =>
      offer({
        data: {
          source,
          sourceId,
          title: title.trim(),
          instructions: instructions.trim(),
          actionType,
          availableFrom: availableFrom || null,
          respondBy: respondBy || null,
          staffContext: staffContext.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Offered to the homeowner.");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: (opportunityId: string) =>
      close({ data: { opportunityId, reason: "Withdrawn by staff" } }),
    onSuccess: () => {
      toast.success("Opportunity closed.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (ctx.isLoading || !ctx.data) return null;
  if (!ctx.data.eligible) {
    // Not every task or ticket is owner work — stay silent rather than noisy.
    return null;
  }

  const existing = ctx.data.existing;

  if (existing) {
    const state = opportunityState(existing);
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
        <HandHeart className="size-4 text-primary" />
        <span className="text-sm">Offered to {ctx.data.ownerName ?? "the homeowner"}</span>
        <Badge variant="outline" className={OPPORTUNITY_STATE_META[state].tone}>
          {OPPORTUNITY_STATE_META[state].label}
        </Badge>
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {actionLabel(existing.owner_action_type)}
        </Badge>
        {state !== "completed" && state !== "closed" && (
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate(existing.id)}
          >
            Withdraw
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          setTitle(ctx.data.eligible ? ctx.data.defaultTitle : "");
          setInstructions(ctx.data.eligible ? ctx.data.defaultInstructions : "");
          setOpen(true);
        }}
      >
        <HandHeart className="size-4" /> Offer to owner
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Offer this to the homeowner</DialogTitle>
            <DialogDescription>
              This creates a participation opportunity linked to this work. The homeowner decides
              whether to take part and enters their own time. ARHA never enters it for them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="opp-title">Owner-facing title</Label>
              <Input id="opp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="opp-instructions">What the owner is being asked to do</Label>
              <Textarea
                id="opp-instructions"
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Action type</Label>
              <Select value={actionType} onValueChange={(v) => setActionType(v as OwnerActionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNER_ACTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACTION_TYPE_META[t].label} — {ACTION_TYPE_META[t].hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="opp-from">Available from (optional)</Label>
                <Input
                  id="opp-from"
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="opp-by">Needed by (optional)</Label>
                <Input
                  id="opp-by"
                  type="date"
                  value={respondBy}
                  onChange={(e) => setRespondBy(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="opp-context">Internal note (never shown to the owner)</Label>
              <Textarea
                id="opp-context"
                rows={2}
                value={staffContext}
                onChange={(e) => setStaffContext(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending || title.trim().length < 3 || instructions.trim().length < 3}
              onClick={() => save.mutate()}
            >
              Offer to owner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
