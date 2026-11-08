import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import { addRoutineCorrection, listRoutineCorrections } from "@/lib/scorecard-capture.functions";
import { CAPTURE_COPY } from "@/lib/scorecard-capture";
import { usDateTime } from "@/lib/dates";

/** A saved check never changes. A correction is added below it as a new line. */
export function RoutineCorrections({ routineId }: { routineId: string }) {
  const listFn = useServerFn(listRoutineCorrections);
  const addFn = useServerFn(addRoutineCorrection);
  const staff = useStaffDirectory();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["routine-corrections", routineId], queryFn: () => listFn({ data: { routineId } }) });
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: () => addFn({ data: { routineId, note } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.correctionThanks);
      setNote("");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["routine-corrections", routineId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const items = list.data?.items ?? [];

  return (
    <div className="space-y-2 border-t border-success/20 pt-3">
      {items.map((c) => (
        <p key={c.id} className="text-sm">
          <span className="font-medium">Correction: </span>
          {c.note}
          <span className="block text-xs text-muted-foreground">
            {displayName((staff.data ?? []).find((m) => m.id === c.corrected_by))}, {usDateTime(c.corrected_at)}
          </span>
        </p>
      ))}
      {open ? (
        <div className="space-y-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} aria-label="Correction" />
          <div className="flex gap-2">
            <Button className="min-h-11" disabled={note.trim().length < 3 || add.isPending} onClick={() => add.mutate()}>
              Save correction
            </Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
          {CAPTURE_COPY.correctionButton}
        </Button>
      )}
    </div>
  );
}
