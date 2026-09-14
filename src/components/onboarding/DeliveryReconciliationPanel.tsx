import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getOnboardingDeliveries,
  reconcileOnboardingDeliveryFn,
} from "@/lib/onboarding-delivery.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DeliveryReconciliationPanel({
  propertyId,
  canEdit,
}: {
  propertyId: string;
  canEdit: boolean;
}) {
  const load = useServerFn(getOnboardingDeliveries);
  const save = useServerFn(reconcileOnboardingDeliveryFn);
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const query = useQuery({
    queryKey: ["onboarding-deliveries", propertyId],
    queryFn: () => load({ data: { propertyId } }),
    refetchInterval: 15000,
  });
  const mutation = useMutation({
    mutationFn: save,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["onboarding-deliveries", propertyId] });
      void qc.invalidateQueries({ queryKey: ["onboarding-finance", propertyId] });
    },
  });
  if (query.error)
    return <p role="alert">Delivery status could not be loaded: {query.error.message}</p>;
  if (!query.data?.length) return null;
  return (
    <section className="surface space-y-3 p-4">
      <h3 className="font-medium">Verify email delivery</h3>
      <p className="text-sm text-muted-foreground">
        Check the shared mailbox and delivery evidence before recording an outcome. This action does
        not send an email.
      </p>
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
      {query.data.map((row) => {
        const attempt = row.onboarding_delivery_attempt as {
          id?: string;
          recipient?: string;
          state?: string;
        } | null;
        const reviewable = attempt?.state === "uncertain" || attempt?.state === "sent_unrecorded";
        const note = notes[row.id] ?? "";
        return (
          <div key={`${row.kind}:${row.id}`} className="space-y-2 rounded-md border p-3">
            <p className="font-medium">{row.title}</p>
            <p className="break-words text-sm">To: {attempt?.recipient ?? "Unknown recipient"}</p>
            {!reviewable ? (
              <p className="text-sm text-muted-foreground">
                An attempt is still recorded as running. If it was interrupted, ask an administrator
                to investigate before retrying.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  {attempt?.state === "sent_unrecorded"
                    ? "The provider accepted this email; its local delivery record needs confirmation."
                    : "Delivery could not be confirmed."}
                </p>
                <Textarea
                  aria-label={`Delivery verification for ${row.title}`}
                  placeholder="What did you verify? Include the mailbox message reference or delivery evidence."
                  value={note}
                  onChange={(e) => setNotes({ ...notes, [row.id]: e.target.value })}
                  disabled={!canEdit || mutation.isPending}
                />
                <div className="flex flex-wrap gap-2">
                  {[true, false]
                    .filter((delivered) => delivered || attempt?.state !== "sent_unrecorded")
                    .map((delivered) => (
                      <Button
                        key={String(delivered)}
                        variant={delivered ? "default" : "outline"}
                        disabled={
                          !canEdit || mutation.isPending || note.trim().length < 10 || !attempt?.id
                        }
                        onClick={() =>
                          mutation.mutate({
                            data: {
                              kind: row.kind,
                              recordId: row.id,
                              attemptId: attempt!.id!,
                              delivered,
                              note,
                            },
                          })
                        }
                      >
                        {delivered
                          ? "Record verified delivery"
                          : "Verified not delivered — allow retry"}
                      </Button>
                    ))}
                </div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
