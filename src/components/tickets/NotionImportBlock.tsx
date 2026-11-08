/**
 * The "Imported from Notion" block on a ticket: the badge, read-only lines from
 * Notion (including who it was assigned to in Notion, as text only) and the
 * Reopen or Take this ticket button. Display and one guarded action; the rules
 * live in src/lib/notion-ticket-display.ts.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assignedInNotionLine,
  notionAction,
  notionBadge,
  notionTicketState,
  parseNotionBlock,
  reopenReasonProblem,
  type NotionTicketLike,
} from "@/lib/notion-ticket-display";
import { reopenNotionTicket } from "@/lib/notion-reopen.functions";

export const NOTION_BLOCK_COPY = {
  title: "Imported from Notion",
  openLink: "Open in Notion",
  reopenTitle: "Reopen this ticket",
  takeTitle: "Take this ticket",
  reopenHelp:
    "It becomes live work in Resolve, assigned to you, with fresh response times starting now. Only your work from now on is credited to you.",
  reasonLabel: "Why are you reopening it?",
  reasonPlaceholder: "A short reason, for example: the guest wrote back about the same issue.",
  cancel: "Cancel",
  confirmReopen: "Reopen and take it",
  confirmTake: "Take it",
  done: "It is yours now. Thank you for looking after this home.",
} as const;

type Ticket = NotionTicketLike & {
  id: string;
  description?: string | null;
  external_url?: string | null;
};

export function NotionImportBlock({
  ticket,
  canWorkTickets,
  onChanged,
}: {
  ticket: Ticket;
  canWorkTickets: boolean;
  onChanged: () => void;
}) {
  const state = notionTicketState(ticket);
  const reopen = useServerFn(reopenNotionTicket);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (state === "none") return null;

  const badge = notionBadge(ticket);
  const block = parseNotionBlock(ticket.description);
  const assigned = assignedInNotionLine(block.assigneeName);
  const action = notionAction(ticket, canWorkTickets);
  const problem = reopenReasonProblem(reason);

  async function submit() {
    if (problem) return;
    setBusy(true);
    try {
      await reopen({ data: { ticketId: ticket.id, reason } });
      toast.success(NOTION_BLOCK_COPY.done);
      setOpen(false);
      setReason("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "This could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={NOTION_BLOCK_COPY.title}
      data-testid="notion-import-block"
      className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{NOTION_BLOCK_COPY.title}</span>
        {badge && badge !== NOTION_BLOCK_COPY.title && <StatusBadge tone="context">{badge}</StatusBadge>}
        {ticket.external_url && (
          <a
            href={ticket.external_url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            {NOTION_BLOCK_COPY.openLink}
          </a>
        )}
        {action && (
          <Button size="sm" className="ml-auto gap-1.5" onClick={() => setOpen(true)}>
            <RotateCcw className="size-3.5" aria-hidden="true" /> {action.label}
          </Button>
        )}
      </div>
      {(assigned || block.lines.length > 0) && (
        <ul className="space-y-0.5 text-muted-foreground">
          {assigned && <li data-testid="assigned-in-notion">{assigned}</li>}
          {block.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.kind === "take" ? NOTION_BLOCK_COPY.takeTitle : NOTION_BLOCK_COPY.reopenTitle}</DialogTitle>
            <DialogDescription>{NOTION_BLOCK_COPY.reopenHelp}</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">{NOTION_BLOCK_COPY.reasonLabel}</span>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={NOTION_BLOCK_COPY.reasonPlaceholder}
            />
          </label>
          {reason.length > 0 && problem && <p className="text-sm text-destructive">{problem}</p>}
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {NOTION_BLOCK_COPY.cancel}
            </Button>
            <Button disabled={busy || Boolean(problem)} onClick={() => void submit()}>
              {action?.kind === "take" ? NOTION_BLOCK_COPY.confirmTake : NOTION_BLOCK_COPY.confirmReopen}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
