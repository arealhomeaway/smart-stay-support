import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState, SectionCard } from "@/components/ui/page";
import { listArchivedTickets } from "@/lib/scorecard-capture.functions";
import { usDateTime } from "@/lib/dates";

/** Admin: archived tickets, newest first. Open one to restore it. */
export function ArchivedTicketsPanel() {
  const listFn = useServerFn(listArchivedTickets);
  const q = useQuery({ queryKey: ["archived-tickets"], queryFn: () => listFn() });
  const rows = q.data ?? [];
  return (
    <SectionCard title="Archived tickets" description="Open a ticket to restore it.">
      {rows.length === 0 ? (
        <EmptyState title="No archived tickets" hint="Archived tickets show here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
              <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="font-medium hover:underline">
                #{t.ref} {t.title}
              </Link>
              {t.archive_reason && <span className="text-muted-foreground">{t.archive_reason}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{usDateTime(t.archived_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
