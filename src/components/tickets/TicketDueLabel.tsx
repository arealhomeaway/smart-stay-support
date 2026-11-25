import { Lock } from "lucide-react";
import { dueDateLabel } from "@/lib/ticket-due-date";

/** Read-only due date shared by ticket lists. */
export function TicketDueLabel({ dueOn, locked }: { dueOn?: string | null | undefined; locked?: boolean | null | undefined }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
    {locked ? <Lock className="size-3 shrink-0" aria-label="Locked" /> : null}
    {dueOn ? `Due ${dueDateLabel(dueOn)}` : "No due date"}
  </span>;
}