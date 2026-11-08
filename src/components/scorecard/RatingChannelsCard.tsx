import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionCard } from "@/components/ui/page";
import { getMyScorecardRoles, getRatingChannels, saveRatingChannels } from "@/lib/scorecard-capture.functions";
import { CAPTURE_COPY, RATING_CHANNELS } from "@/lib/scorecard-capture";

/** Review channels that count for the Director's guest rating. Supervisor and Director edit. */
export function RatingChannelsCard() {
  const rolesFn = useServerFn(getMyScorecardRoles);
  const getFn = useServerFn(getRatingChannels);
  const saveFn = useServerFn(saveRatingChannels);
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["scorecard-roles"], queryFn: () => rolesFn(), staleTime: 5 * 60 * 1000 });
  const current = useQuery({ queryKey: ["rating-channels"], queryFn: () => getFn() });
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (current.data) setPicked(current.data.channels);
  }, [current.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { channels: picked } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.channelsThanks);
      void qc.invalidateQueries({ queryKey: ["rating-channels"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!current.data) return null;
  const canEdit = roles.data?.leads === true;
  const changed = [...picked].sort().join() !== [...current.data.channels].sort().join();

  return (
    <SectionCard title="Guest rating channels" description="Reviews from these channels count for the guest rating.">
      <div className="flex flex-wrap gap-2">
        {RATING_CHANNELS.map((c) => {
          const on = picked.includes(c.value);
          return (
            <label key={c.value} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
              <Checkbox
                checked={on}
                disabled={!canEdit}
                onCheckedChange={(v) =>
                  setPicked((p) => (v ? [...new Set([...p, c.value])] : p.filter((x) => x !== c.value)))
                }
              />
              {c.label}
            </label>
          );
        })}
      </div>
      {canEdit && (
        <Button
          className="mt-3 min-h-11"
          disabled={!changed || picked.length === 0 || save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      )}
    </SectionCard>
  );
}
