/**
 * Reopen for a closed ticket: a short reason, then one guarded database step.
 * Same dialog pattern as the Imported from Notion box. Rules live in
 * src/lib/ticket-reopen.ts.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reopenReasonProblem } from "@/lib/notion-ticket-display";
import { REOPEN_COPY } from "@/lib/ticket-reopen";
import { reopenClosedTicket } from "@/lib/ticket-reopen.functions";

export function ReopenTicketDialog({
  ticketId,
  open,
  onOpenChange,
  onReopened,
}: {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReopened: () => void | Promise<void>;
}) {
  const reopen = useServerFn(reopenClosedTicket);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = reopenReasonProblem(reason);

  async function submit() {
    if (problem) return;
    setBusy(true);
    try {
      await reopen({ data: { ticketId, reason } });
      toast.success(REOPEN_COPY.done);
      onOpenChange(false);
      setReason("");
      await onReopened();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{REOPEN_COPY.title}</DialogTitle>
          <DialogDescription>{REOPEN_COPY.help}</DialogDescription>
        </DialogHeader>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">{REOPEN_COPY.reasonLabel}</span>
          <Textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={REOPEN_COPY.reasonPlaceholder}
          />
        </label>
        {reason.length > 0 && problem && <p className="text-sm text-destructive">{problem}</p>}
        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            {REOPEN_COPY.cancel}
          </Button>
          <Button disabled={busy || Boolean(problem)} onClick={() => void submit()}>
            {REOPEN_COPY.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
