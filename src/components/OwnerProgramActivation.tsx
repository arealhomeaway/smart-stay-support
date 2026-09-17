import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { activateOwnerProgram } from "@/lib/owner-program.functions";
import {
  captureOwnerActivation,
  type OwnerActivationContext,
  type OwnerActivationDraft,
} from "@/lib/owner-program-activation";
import { ACTIVATABLE_STATUSES, PROGRAM_STATUS_META } from "@/lib/owner-participation";
import { usCalendarDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  context: OwnerActivationContext;
  initialStartDate: string;
  onRefresh: () => void;
};

/** A new program identity remounts its draft and any outstanding mutation. */
export function OwnerProgramActivation(props: Props) {
  return <OwnerProgramActivationForm key={props.context.programId} {...props} />;
}

function ActivationFacts({ snapshot }: { snapshot: OwnerActivationDraft }) {
  return (
    <div className="space-y-2 text-sm">
      <p>DFY confirmation: {snapshot.dfyConfirmed ? "Confirmed" : "Not confirmed"}</p>
      <p className="font-medium">Included properties</p>
      {snapshot.properties.length ? (
        <ul className="list-disc space-y-1 pl-5">
          {snapshot.properties.map((property) => (
            <li key={property.propertyId}>
              {property.name} —{" "}
              {property.closingConfirmed && property.closingDate
                ? `closing confirmed ${usCalendarDate(property.closingDate)}`
                : "closing not confirmed"}
            </li>
          ))}
        </ul>
      ) : (
        <p>No properties are included.</p>
      )}
    </div>
  );
}

function OwnerProgramActivationForm({ context, initialStartDate, onRefresh }: Props) {
  const activate = useServerFn(activateOwnerProgram);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OwnerActivationDraft | null>(null);
  const [error, setError] = useState("");
  const dateId = useId();
  const available =
    !context.startedOn && ACTIVATABLE_STATUSES.some((status) => status === context.status);
  const stale = !!draft && draft.expectedVersion !== context.reportVersion;
  const mutation = useMutation({
    mutationFn: (reviewed: OwnerActivationDraft) =>
      activate({
        data: {
          programId: reviewed.programId,
          expectedVersion: reviewed.expectedVersion,
          startedOn: reviewed.startedOn,
        },
      }),
    onSuccess: () => {
      setDraft(null);
      toast.success("Program activated. The 90-day clock has started.");
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ["owner-home"] });
      void queryClient.invalidateQueries({ queryKey: ["owner-report"] });
    },
    onError: (failure: Error) => {
      setError(failure.message);
      onRefresh();
    },
  });

  return (
    <>
      <Button
        size="sm"
        disabled={!available || mutation.isPending}
        onClick={() => {
          setDraft(captureOwnerActivation(context, initialStartDate));
          setError("");
        }}
      >
        <CalendarClock className="size-4" /> Review activation
      </Button>
      <p className="text-xs text-muted-foreground">
        Requires DFY confirmation and a confirmed closing on every included home.
      </p>
      <Dialog
        open={!!draft}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activate the 90-day program</DialogTitle>
            <DialogDescription>
              Activation starts one clock for all included properties. Adding homes later will not
              reset it.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (mutation.isPending || stale || !available) return;
                setError("");
                mutation.mutate(draft);
              }}
            >
              <ActivationFacts snapshot={draft} />
              {stale && (
                <div role="status" className="space-y-3 rounded-md border p-3">
                  <p className="text-sm">
                    The program changed. Your start date has been retained. Review the current
                    details before activating.
                  </p>
                  <ActivationFacts snapshot={captureOwnerActivation(context, draft.startedOn)} />
                  <p className="text-sm">
                    Status:{" "}
                    {PROGRAM_STATUS_META[context.status as keyof typeof PROGRAM_STATUS_META]
                      ?.label ?? context.status}
                  </p>
                  {available && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => {
                        setDraft(captureOwnerActivation(context, draft.startedOn));
                        setError("");
                      }}
                    >
                      I reviewed the current program
                    </Button>
                  )}
                </div>
              )}
              {!available && (
                <p role="status" className="text-sm">
                  This program is no longer available for activation. Its existing clock is
                  preserved.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor={dateId}>Day one (required)</Label>
                <Input
                  id={dateId}
                  name="programStartDate"
                  type="date"
                  required
                  max={new Date().toISOString().slice(0, 10)}
                  disabled={mutation.isPending}
                  value={draft.startedOn}
                  onChange={(event) => {
                    setDraft({ ...draft, startedOn: event.target.value });
                    setError("");
                  }}
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={mutation.isPending}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={mutation.isPending || stale || !available}>
                  {mutation.isPending ? "Activating…" : "Activate program"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
