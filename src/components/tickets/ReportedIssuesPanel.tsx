import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BreezewayRepairLink } from "@/components/workorders/BreezewayRepairLink";
import { TicketDueLabel } from "./TicketDueLabel";
import { useRole } from "@/hooks/useRole";

const Workspace = lazy(() => import("@/routes/_authenticated/tickets.$ticketId").then((m) => ({ default: m.TicketWorkspace })));

/** Every issue remains a canonical Ticket, with one group-level mirror-link action. */
export function ReportedIssuesPanel({ ticketIds, onClose }: { ticketIds: string[]; onClose?: () => void }) {
  const role = useRole();
  const [selected, setSelected] = useState(ticketIds[0] ?? "");
  const q = useQuery({
    queryKey: ["reported-issue-group", ticketIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("tickets").select("id, ref, title, description, priority, status, property_id, external_source, due_on, due_locked").in("id", ticketIds).is("archived_at", null);
      if (error) throw error;
      if (data.length !== ticketIds.length || data.some((t) => t.external_source !== "breezeway" || t.property_id !== data[0]?.property_id)) throw new Error("These issues could not be opened together.");
      return data;
    },
  });
  if (q.isPending) return <Skeleton className="h-72 w-full" />;
  if (q.error) return <p role="alert">{q.error.message}</p>;
  return <div className="space-y-5" data-testid="reported-issues-panel">
    <section aria-label="Reported issues" className="space-y-2">
      <h2 className="text-xl font-semibold">{q.data.length} reported issues</h2>
      {q.data.map((t) => <div key={t.id} className="border-b border-border py-2">
        <Button variant={selected === t.id ? "secondary" : "ghost"} className="min-h-11 h-auto w-full justify-start whitespace-normal text-left" onClick={() => setSelected(t.id)}>#{t.ref} {t.title}</Button>
        <p className="break-words text-sm text-muted-foreground">{t.description}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs"><span>{t.priority.toUpperCase()}</span><span>{t.status.replace(/_/g, " ")}</span><TicketDueLabel dueOn={t.due_on} locked={t.due_locked} /></div>
      </div>)}
    </section>
    {ticketIds[0] ? <BreezewayRepairLink ticketId={ticketIds[0]} ticketIds={ticketIds} hasHome={Boolean(q.data[0]?.property_id)} readOnly={role.readOnly || !role.can("work_orders_internal")} /> : null}
    <Suspense fallback={<Skeleton className="h-72 w-full" />}><Workspace key={selected} ticketId={selected} {...(onClose ? { onClose } : {})} /></Suspense>
  </div>;
}