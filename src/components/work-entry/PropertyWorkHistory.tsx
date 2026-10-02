import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { History, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { usDateTime } from "@/lib/dates";
import { useTicketDrawer } from "@/components/nav/TicketDrawer";
import { ACTIVITY_CATEGORIES, MAINTENANCE_CATEGORIES, labelOf } from "@/lib/work-entry";

type Row = {
  key: string;
  at: string;
  type: "activity" | "ops" | "maintenance" | "legacy" | "ticket";
  title: string;
  detail: string | null;
  ticketId?: string;
};

const TYPE_LABEL: Record<Row["type"], string> = {
  activity: "Property Activity",
  ops: "Ops Ticket",
  maintenance: "Maintenance",
  legacy: "Legacy one-touch activity",
  ticket: "Ticket",
};

/**
 * One property timeline that keeps the record types apart: history-only
 * Property Activity, Ops Tickets, Maintenance and legacy one-touch records.
 * Open counts elsewhere read Tickets only; Activity never counts as work.
 */
export function PropertyWorkHistory({ propertyId }: { propertyId: string }) {
  const drawer = useTicketDrawer();
  const { data: rows = [] } = useQuery({
    queryKey: ["property-activity", propertyId],
    queryFn: async (): Promise<Row[]> => {
      const [acts, tix] = await Promise.all([
        supabase
          .from("property_activity_log")
          .select("id, occurred_at, category, what_happened, outcome, involved, logged_by")
          .eq("property_id", propertyId)
          .order("occurred_at", { ascending: false })
          .limit(50),
        supabase
          .from("tickets")
          .select("id, ref, title, status, reported_at, record_type, entry_kind, maintenance_category, resolution_notes")
          .eq("property_id", propertyId)
          .is("archived_at", null)
          .order("reported_at", { ascending: false })
          .limit(50),
      ]);
      const ids = [...new Set((acts.data ?? []).map((a) => a.logged_by))];
      const { data: people } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
      const out: Row[] = [];
      for (const a of (acts.data ?? []) as unknown as {
        id: string; occurred_at: string; category: string; what_happened: string; outcome: string;
        involved: string | null; logged_by: string;
      }[]) {
        const p = people?.find((x) => x.id === a.logged_by);
        const who = p?.full_name || p?.email || "Teammate";
        out.push({
          key: `a-${a.id}`,
          at: a.occurred_at,
          type: "activity",
          title: `${labelOf(ACTIVITY_CATEGORIES, a.category)} — ${a.what_happened}`,
          detail: `Outcome: ${a.outcome}${a.involved ? ` · Involved: ${a.involved}` : ""} · logged by ${who}`,
        });
      }
      for (const t of tix.data ?? []) {
        const type: Row["type"] =
          t.record_type === "completed_interaction"
            ? "legacy"
            : t.entry_kind === "maintenance"
              ? "maintenance"
              : t.entry_kind === "ops"
                ? "ops"
                : "ticket";
        out.push({
          key: `t-${t.id}`,
          at: t.reported_at ?? "",
          type,
          title: `ARHA-${t.ref} ${t.title}`,
          detail:
            type === "legacy"
              ? t.resolution_notes
              : `${t.status.replace(/_/g, " ")}${t.maintenance_category ? ` · ${labelOf(MAINTENANCE_CATEGORIES, t.maintenance_category)}` : ""}`,
          ticketId: t.id,
        });
      }
      return out.sort((x, y) => y.at.localeCompare(x.at));
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" /> Property history
          </CardTitle>
          <CardDescription>Activity logged, Ops Tickets and Maintenance, newest first.</CardDescription>
        </div>
        {drawer && (
          <Button size="sm" variant="outline" onClick={() => drawer.openNewTicket({ property: propertyId, from: "property_hub" })}>
            <Plus className="size-4" /> Record work
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.length === 0 && <p className="text-muted-foreground">Nothing recorded for this home yet.</p>}
        {rows.map((r) => {
          const body = (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Chip className={stateChip(r.type === "activity" || r.type === "legacy" ? "info" : "active")}>
                  {TYPE_LABEL[r.type]}
                </Chip>
                <span className="min-w-0 flex-1 font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">{r.at ? usDateTime(r.at) : ""}</span>
              </div>
              {r.detail && <p className="pt-1 text-xs text-muted-foreground">{r.detail}</p>}
            </>
          );
          return r.ticketId ? (
            <Link key={r.key} to="/tickets/$ticketId" params={{ ticketId: r.ticketId }} className="block border-b border-border/50 pb-2 last:border-0 hover:text-primary">
              {body}
            </Link>
          ) : (
            <div key={r.key} className="border-b border-border/50 pb-2 last:border-0">{body}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
