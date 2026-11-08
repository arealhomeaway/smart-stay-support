import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { archiveTicket, restoreTicket } from "@/lib/scorecard-capture.functions";
import { CAPTURE_COPY, archiveReasonProblem } from "@/lib/scorecard-capture";
import { usDateTime } from "@/lib/dates";

/** Archive replaces delete. Asks for a reason; the history stays. */
export function ArchiveTicketButton({
  ticketId,
  ticketRef,
  onDone,
}: {
  ticketId: string;
  ticketRef: string;
  onDone: () => void;
}) {
  const archiveFn = useServerFn(archiveTicket);
  const [reason, setReason] = useState("");
  const run = useMutation({
    mutationFn: () => archiveFn({ data: { ticketId, reason } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.archiveThanks);
      setReason("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const problem = archiveReasonProblem(reason);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="min-h-11 w-full">
          <Archive className="size-4" />
          {CAPTURE_COPY.archiveButton}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive ticket #{ticketRef}?</AlertDialogTitle>
          <AlertDialogDescription>
            It leaves every list and count. Its history stays, and an Admin can bring it back.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={`archive-reason-${ticketId}`}>Reason</Label>
          <Textarea
            id={`archive-reason-${ticketId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="For example: duplicate of another ticket"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={Boolean(problem) || run.isPending} onClick={() => run.mutate()}>
            {CAPTURE_COPY.archiveButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shown on an archived ticket. Admin can restore it. */
export function ArchivedTicketBanner({
  ticketId,
  archivedAt,
  reason,
  canRestore,
  onDone,
}: {
  ticketId: string;
  archivedAt: string;
  reason: string | null;
  canRestore: boolean;
  onDone: () => void;
}) {
  const restoreFn = useServerFn(restoreTicket);
  const run = useMutation({
    mutationFn: () => restoreFn({ data: { ticketId } }),
    onSuccess: () => {
      toast.success(CAPTURE_COPY.restoreThanks);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
      <Archive className="size-4 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        Archived {usDateTime(archivedAt)}.{reason ? ` Reason: ${reason}` : ""}
      </p>
      {canRestore && (
        <Button variant="outline" className="min-h-11" disabled={run.isPending} onClick={() => run.mutate()}>
          {CAPTURE_COPY.restoreButton}
        </Button>
      )}
    </div>
  );
}
