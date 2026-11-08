import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import { addCommitment, approveCommitment, getMyScorecardRoles, listCommitments } from "@/lib/scorecard-capture.functions";
import { CAPTURE_COPY, centralDay } from "@/lib/scorecard-capture";
import { usDate, usDateTime } from "@/lib/dates";

/** Corrective commitments on a guest issue ticket. The page shows this only for guest issues. */
export function CorrectiveCommitments({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const rolesFn = useServerFn(getMyScorecardRoles);
  const listFn = useServerFn(listCommitments);
  const addFn = useServerFn(addCommitment);
  const approveFn = useServerFn(approveCommitment);
  const staff = useStaffDirectory();
  const qc = useQueryClient();
  const roles = useQuery({ queryKey: ["scorecard-roles"], queryFn: () => rolesFn(), staleTime: 5 * 60 * 1000 });
  const list = useQuery({ queryKey: ["commitments", ticketId], queryFn: () => listFn({ data: { ticketId } }) });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["commitments", ticketId] });

  const add = useMutation({
    mutationFn: () => addFn({ data: { ticketId, commitment: text, dueOn: due } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.commitThanks);
      setText("");
      setDue("");
      setOpen(false);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: (recordId: string) => approveFn({ data: { recordId } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.approveThanks);
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = list.data?.items ?? [];
  const canAdd = roles.data?.leads === true && !closed;
  const canApprove = roles.data?.coo === true;
  if (!canAdd && items.length === 0) return null;
  const nameOf = (id: string) => displayName((staff.data ?? []).find((m) => m.id === id));

  return (
    <div className="rounded-lg border border-border/60 p-4">
      <h3 className="font-medium">Corrective commitment</h3>
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((c) => (
            <li key={c.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <p className="font-medium">{c.note}</p>
              <p className="text-xs text-muted-foreground">
                Due {c.details?.due_on ? usDate(c.details.due_on) : ""}. Added by {nameOf(c.recorded_by)},{" "}
                {usDateTime(c.recorded_at)}.
              </p>
              {c.approval ? (
                <p className="mt-1 text-xs text-success">Approved by the COO, {usDateTime(c.approval.recorded_at)}.</p>
              ) : canApprove ? (
                <Button size="sm" className="mt-2 min-h-11" disabled={approve.isPending} onClick={() => approve.mutate(c.id)}>
                  {CAPTURE_COPY.approveButton}
                </Button>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Waiting for the COO.</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {canAdd &&
        (open ? (
          <div className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`commit-${ticketId}`}>What we commit to</Label>
              <Textarea id={`commit-${ticketId}`} value={text} onChange={(e) => setText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`commit-due-${ticketId}`}>Due by</Label>
              <Input
                id={`commit-due-${ticketId}`}
                type="date"
                min={centralDay(new Date()).date}
                className="min-h-11 w-48"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button className="min-h-11" disabled={text.trim().length < 5 || !due || add.isPending} onClick={() => add.mutate()}>
                Save
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => setOpen(true)}>
            {CAPTURE_COPY.commitButton}
          </Button>
        ))}
    </div>
  );
}
