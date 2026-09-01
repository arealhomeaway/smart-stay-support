import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sunrise } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OPEN_STATUSES, STATUSES, labelFor, priorityMeta, priorityTone, statusTone } from "@/lib/tickets";
import { lastAfterHoursWindow, windowLabel, type CoverageConfig } from "@/lib/coverage";

/**
 * Morning handoff: what came out of the last after-hours window still needing
 * daytime Operations. It reads the Ticket record itself — no separate written
 * overnight report is required, because the ticket activity already documents
 * what happened.
 *
 * The view only exists once the coverage window is configured; without hours
 * there is no defined overnight period to report on.
 */
type Row = {
  id: string;
  title: string;
  status: string;
  priority: string;
  reported_at: string;
  vendor_status: string | null;
  vendor_dispatched_at: string | null;
  vendor_completed_at: string | null;
  next_review_at: string | null;
  handoff_status: string | null;
  guest_in_residence: boolean | null;
  assignment_note: string | null;
  properties?: { name: string; nickname: string | null } | null;
};

/** Why this ticket is on the morning list — plain reasons, not internal codes. */
function reasons(t: Row) {
  const out: string[] = [];
  if (t.priority === "p1" || t.priority === "p2") out.push(`Unresolved ${priorityMeta(t.priority).short}`);
  if (t.vendor_dispatched_at && !t.vendor_completed_at) out.push("Vendor action pending");
  if (t.next_review_at) out.push("Promised follow-up");
  if (t.handoff_status === "pending") out.push("Handed into Operations — not accepted");
  if (t.guest_in_residence) out.push("Guest in residence");
  if (t.status === "waiting") out.push("Waiting on someone");
  return out;
}

export function OvernightHandoffPanel({ className }: { className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["overnight-handoff"],
    queryFn: async () => {
      const { data: cfg } = await supabase
        .from("coverage_config")
        .select("after_hours_start_minute, after_hours_end_minute, timezone")
        .maybeSingle();

      const window = lastAfterHoursWindow(cfg as CoverageConfig | null);
      if (!window) return { cfg: (cfg ?? null) as CoverageConfig | null, window: null, rows: [] as Row[] };

      const { data: rows, error } = await supabase
        .from("tickets")
        .select(
          "id, title, status, priority, reported_at, vendor_status, vendor_dispatched_at, vendor_completed_at, next_review_at, handoff_status, guest_in_residence, assignment_note, properties(name, nickname)",
        )
        .eq("is_demo", false)
        .is("archived_at", null)
        .gte("reported_at", window.startsAt.toISOString())
        .lte("reported_at", window.endsAt.toISOString())
        .order("priority")
        .limit(200);
      if (error) throw error;

      const open = ((rows ?? []) as unknown as Row[]).filter((t) => OPEN_STATUSES.includes(t.status));
      return { cfg: (cfg ?? null) as CoverageConfig | null, window, rows: open };
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !data) return <Skeleton className={className ?? "h-48 w-full"} />;

  const label = windowLabel(data.cfg);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sunrise className="size-4" /> Overnight handoff
          <Badge
            variant="outline"
            className={data.rows.length === 0 ? "border-success/30 bg-success/10 text-success" : "border-warning/40 bg-warning/10"}
          >
            {data.rows.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {data.window
            ? `Unresolved work from the ${label} window that started ${data.window.rosterDate}. The Ticket record is the report — nothing separate needs writing up.`
            : "Not available until the after-hours coverage window is configured."}
        </CardDescription>
      </CardHeader>
      {data.window && (
        <CardContent className="space-y-2 text-sm">
          {data.rows.length === 0 ? (
            <p className="text-muted-foreground">Nothing from the overnight window is still open.</p>
          ) : (
            data.rows.map((t) => (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
              >
                <Badge variant="outline" className={priorityTone(t.priority)}>
                  {priorityMeta(t.priority).short}
                </Badge>
                <span className="font-medium">{t.title}</span>
                <span className="text-muted-foreground">
                  {t.properties?.nickname ?? t.properties?.name ?? "No property"}
                </span>
                <Badge variant="outline" className={statusTone(t.status)}>
                  {labelFor(STATUSES, t.status)}
                </Badge>
                <span className="ml-auto flex flex-wrap gap-1">
                  {reasons(t).map((r) => (
                    <Badge key={r} variant="outline" className="font-normal">
                      {r}
                    </Badge>
                  ))}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      )}
    </Card>
  );
}
