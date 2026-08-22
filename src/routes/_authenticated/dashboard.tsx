import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OPEN_STATUSES,
  STATUSES,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
  statusTone,
} from "@/lib/tickets";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations dashboard — Resolve" },
      { name: "description", content: "Open guest issues, overdue tickets, and today's workload at a glance." },
      { property: "og:title", content: "Operations dashboard — Resolve" },
      { property: "og:description", content: "Open guest issues and overdue tickets at a glance." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { demoMode } = useDemo();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", demoMode],
    queryFn: async () => {
      const [tickets, properties] = await Promise.all([
        supabase
          .from("tickets")
          .select("*, properties(name, nickname)")
          .eq("is_demo", demoMode)
          .order("reported_at", { ascending: false })
          .limit(200),
        supabase
          .from("properties")
          .select("id", { count: "exact", head: true })
          .eq("is_demo", demoMode),
      ]);
      if (tickets.error) throw tickets.error;
      return { tickets: tickets.data ?? [], propertyCount: properties.count ?? 0 };
    },
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const open = data.tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const breached = open.filter((t) => slaState(t).breached);
  const escalated = open.filter((t) => slaState(t).escalation);
  const unacked = open.filter((t) => !t.acknowledged_at);
  const resolvedWeek = data.tickets.filter(
    (t) => t.resolved_at && Date.now() - new Date(t.resolved_at).getTime() < 7 * 864e5,
  );

  const stats = [
    { label: "Open matters", value: open.length, tone: "text-foreground" },
    { label: "SLA breached", value: breached.length, tone: "text-danger" },
    { label: "Not yet acknowledged", value: unacked.length, tone: "text-warning-foreground" },
    { label: "Closed this week", value: resolvedWeek.length, tone: "text-success" },
  ];


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Operations dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          {data.propertyCount} properties · {open.length} live issues
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <p className={`text-3xl font-semibold ${s.tone}`}>{s.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {escalated.length > 0 && (
        <Card className="border-danger/40 bg-danger/5">
          <CardHeader>
            <CardTitle className="text-danger">Escalated right now</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {escalated.map((t) => (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/30 bg-card p-3 transition-colors hover:bg-secondary"
              >
                <Badge variant="outline" className={priorityTone(t.priority)}>
                  {priorityMeta(t.priority).short}
                </Badge>
                <span className="font-medium">{t.title}</span>
                <span className="ml-auto text-sm text-danger">{slaState(t).escalation?.who}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Needs attention now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {open.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nothing open. <Link to="/tickets/new" className="text-primary hover:underline">Log a matter</Link>.
            </p>
          )}
          {open
            .slice()
            .sort((a, b) => (a.response_due_at ?? a.action_due_at ?? "").localeCompare(b.response_due_at ?? b.action_due_at ?? ""))
            .slice(0, 10)
            .map((t) => {
              const sla = slaState(t);
              const live = sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;
              return (
                <Link
                  key={t.id}
                  to="/tickets/$ticketId"
                  params={{ ticketId: t.id }}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
                >
                  <Badge variant="outline" className={priorityTone(t.priority)}>
                    {priorityMeta(t.priority).short}
                  </Badge>
                  <span className="font-medium">{t.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {t.properties?.nickname ?? t.properties?.name ?? "Unassigned property"}
                  </span>
                  <Badge variant="outline" className={statusTone(t.status)}>
                    {labelFor(STATUSES, t.status)}
                  </Badge>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {live ? (
                      <span className={live.breached ? "font-medium text-danger" : ""}>{live.label}</span>
                    ) : (
                      relativeTime(t.reported_at)
                    )}
                  </span>
                </Link>
              );
            })}
        </CardContent>
      </Card>

    </div>
  );
}
