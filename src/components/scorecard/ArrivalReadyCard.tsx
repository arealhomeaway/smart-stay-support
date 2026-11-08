import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { getPropertyContactContext } from "@/lib/guest-context.functions";
import { arrivalReadyStatus, recordArrivalReady } from "@/lib/scorecard-capture.functions";
import { CAPTURE_COPY } from "@/lib/scorecard-capture";
import { usDate, usDateTime } from "@/lib/dates";

/** "Ready for arrival" on a home's next arrival. Operations staff only (the caller decides). */
export function ArrivalReadyCard({ propertyId }: { propertyId: string }) {
  const contextFn = useServerFn(getPropertyContactContext);
  const statusFn = useServerFn(arrivalReadyStatus);
  const recordFn = useServerFn(recordArrivalReady);
  const qc = useQueryClient();

  const ctx = useQuery({
    queryKey: ["property-contact-context", propertyId],
    queryFn: () => contextFn({ data: { propertyId } }),
    staleTime: 5 * 60 * 1000,
  });
  const guest = ctx.data && ctx.data.visible ? ctx.data.guest : null;
  const arrivalOn = guest?.status === "vacant" && guest.next_arrival ? guest.next_arrival.slice(0, 10) : null;

  const status = useQuery({
    queryKey: ["arrival-ready", propertyId, arrivalOn],
    enabled: Boolean(arrivalOn),
    queryFn: () => statusFn({ data: { propertyId, arrivalOn: arrivalOn! } }),
  });

  const mark = useMutation({
    mutationFn: () => recordFn({ data: { propertyId, arrivalOn: arrivalOn! } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.readyThanks);
      void qc.invalidateQueries({ queryKey: ["arrival-ready", propertyId, arrivalOn] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!arrivalOn) return null;
  const ready = status.data?.ready === true;

  return (
    <SectionCard title={CAPTURE_COPY.readyTitle} description={`Arrives ${usDate(arrivalOn)}.`}>
      {ready ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" />
          Ready. Marked {status.data?.recordedAt ? usDateTime(status.data.recordedAt) : ""}.
        </p>
      ) : (
        <Button className="min-h-11" disabled={mark.isPending || status.isLoading} onClick={() => mark.mutate()}>
          {CAPTURE_COPY.readyButton}
        </Button>
      )}
    </SectionCard>
  );
}
