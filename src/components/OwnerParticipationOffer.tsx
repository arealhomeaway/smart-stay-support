import { useId, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  captureOpportunityWithdrawal,
  mayWithdrawOpportunity,
  type OpportunityWithdrawalDraft,
} from "@/lib/owner-opportunity-withdrawal";
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
const OPPORTUNITY_STATE_TONE: Record<string, StatusTone> = {
  available: "progress",
  upcoming: "waiting",
  completed: "resolved",
  closed: "closed",
};

type OwnerParticipationOfferProps = {
  source: "onboarding" | "operations";
  sourceId: string;
};

export function OwnerParticipationOffer(props: OwnerParticipationOfferProps) {
  return <OwnerParticipationOfferContent key={`${props.source}:${props.sourceId}`} {...props} />;
}

function OwnerParticipationOfferContent({ source, sourceId }: OwnerParticipationOfferProps) {
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
  const [actionType, setActionType] = useState<OwnerActionType>("review_comment");
  const [availableFrom, setAvailableFrom] = useState("");
  const [respondBy, setRespondBy] = useState("");
  const [staffContext, setStaffContext] = useState("");
  const [withdrawal, setWithdrawal] = useState<OpportunityWithdrawalDraft | null>(null);
  const [withdrawalError, setWithdrawalError] = useState("");
  const withdrawalReasonId = useId();

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
    mutationFn: (draft: OpportunityWithdrawalDraft) =>
      close({
        data: {
          opportunityId: draft.opportunityId,
          expectedUpdatedAt: draft.expectedUpdatedAt,
          reason: draft.reason.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Opportunity closed.");
      setWithdrawal(null);
      void qc.invalidateQueries({ queryKey: key });
      for (const queryKey of ["owner-home", "owner-report", "owner-program", "owner-programs"]) {
        void qc.invalidateQueries({ queryKey: [queryKey] });
      }
    },
    onError: (e: Error) => {
      setWithdrawalError(e.message);
      void ctx.refetch();
    },
  });

  const existing = ctx.data?.eligible ? ctx.data.existing : null;
  const state = existing ? opportunityState(existing) : "closed";
  const withdrawable = !!existing && mayWithdrawOpportunity(existing);
  const changed =
    !!withdrawal &&
    (!existing ||
      withdrawal.opportunityId !== existing.id ||
      withdrawal.expectedUpdatedAt !== existing.updated_at);
  const withdrawalDialog = (
    <Dialog
      open={!!withdrawal}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !withdraw.isPending) setWithdrawal(null);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Withdraw this participation opportunity</DialogTitle>
          <DialogDescription>
            The owner will no longer be able to take part in this opportunity. Existing
            participation records are retained.
          </DialogDescription>
        </DialogHeader>
        {withdrawal && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (withdraw.isPending || changed || !withdrawable) return;
              if (withdrawal.reason.trim().length < 3) {
                setWithdrawalError("Explain why this opportunity is being withdrawn.");
                return;
              }
              setWithdrawalError("");
              withdraw.mutate(withdrawal);
            }}
          >
            <div className="space-y-1 text-sm">
              <p className="font-medium">{withdrawal.title}</p>
              <p className="whitespace-pre-wrap">{withdrawal.recommendation}</p>
            </div>
            {changed && (
              <div role="status" className="space-y-2 rounded-md border p-3 text-sm">
                <p>
                  This opportunity changed. Your explanation has been retained. Review its current
                  details before continuing.
                </p>
                <p className="font-medium">{existing?.title}</p>
                <p className="whitespace-pre-wrap">{existing?.recommendation}</p>
                <p>Status: {OPPORTUNITY_STATE_META[state].label}</p>
                {existing && withdrawable && existing.id === withdrawal.opportunityId && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={withdraw.isPending || ctx.isFetching}
                    onClick={() => {
                      setWithdrawal(captureOpportunityWithdrawal(existing, withdrawal.reason));
                      setWithdrawalError("");
                    }}
                  >
                    I reviewed the current opportunity
                  </Button>
                )}
              </div>
            )}
            {!withdrawable && (
              <p role="status" className="text-sm">
                This opportunity is no longer available for withdrawal. Your explanation has been
                retained.
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor={withdrawalReasonId}>Reason for withdrawal (required)</Label>
              <Textarea
                id={withdrawalReasonId}
                name="withdrawalReason"
                required
                minLength={3}
                maxLength={500}
                rows={3}
                disabled={withdraw.isPending}
                value={withdrawal.reason}
                onChange={(event) => {
                  setWithdrawal({ ...withdrawal, reason: event.target.value });
                  setWithdrawalError("");
                }}
              />
            </div>
            {withdrawalError && (
              <p role="alert" className="text-sm text-destructive">
                {withdrawalError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={withdraw.isPending}
                onClick={() => setWithdrawal(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={withdraw.isPending || changed || !withdrawable}>
                {withdraw.isPending ? "Withdrawing…" : "Withdraw opportunity"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );

  if (ctx.isLoading || !ctx.data || !ctx.data.eligible) return withdrawalDialog;

  if (existing) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 py-1">
          <HandHeart className="size-4 text-primary" />
          <span className="text-sm">Offered to {ctx.data.ownerName ?? "the homeowner"}</span>
          <StatusBadge tone={OPPORTUNITY_STATE_TONE[state] ?? "context"}>
            {OPPORTUNITY_STATE_META[state].label}
          </StatusBadge>
          <StatusBadge tone="context">{actionLabel(existing.owner_action_type)}</StatusBadge>
          {withdrawable && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              disabled={withdraw.isPending}
              onClick={() => {
                setWithdrawal(captureOpportunityWithdrawal(existing));
                setWithdrawalError("");
              }}
            >
              Withdraw
            </Button>
          )}
          {(existing.auto_ticket || existing.ticket_id) && (
            <span className="text-sm text-muted-foreground">
              Ticket work stays available for owner review.
            </span>
          )}
        </div>
        {withdrawalDialog}
      </>
    );
  }

  return (
    <>
      {withdrawalDialog}
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
