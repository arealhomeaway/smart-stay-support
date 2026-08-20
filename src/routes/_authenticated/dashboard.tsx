import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [tickets, properties] = await Promise.all([
        supabase
          .from("tickets")
          .select("*, properties(name, nickname)")
          .order("reported_at", { ascending: false })
          .limit(200),
        supabase.from("properties").select("id", { count: "exact", head: true }),
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
  const overdue = open.filter((t) => t.due_at && new Date(t.due_at).getTime() < Date.now());
  const awaiting = open.filter((t) => t.status === "awaiting_guest");
  const resolvedWeek = data.tickets.filter(
    (t) => t.resolved_at && Date.now() - new Date(t.resolved_at).getTime() < 7 * 864e5,
  );

  const stats = [
    { label: "Open tickets", value: open.length, tone: "text-foreground" },
    { label: "Overdue", value: overdue.length, tone: "text-danger" },
    { label: "Awaiting guest confirmation", value: awaiting.length, tone: "text-warning-foreground" },
    { label: "Resolved this week", value: resolvedWeek.length, tone: "text-success" },
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

      <Card>
        <CardHeader>
          <CardTitle>Needs attention now</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {open.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No open tickets. <Link to="/tickets/new" className="text-primary hover:underline">Log one</Link>.
            </p>
          )}
          {open
            .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
            .slice(0, 10)
            .map((t) => {
              const due = dueLabel(t.due_at, t.status);
              return (
                <Link
                  key={t.id}
                  to="/tickets/$ticketId"
                  params={{ ticketId: t.id }}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
                >
                  <Badge variant="outline" className={priorityTone(t.priority)}>
                    {t.priority}
                  </Badge>
                  <span className="font-medium">{t.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {t.properties?.nickname ?? t.properties?.name ?? "Unassigned property"}
                  </span>
                  <Badge variant="outline" className={statusTone(t.status)}>
                    {labelFor(STATUSES, t.status)}
                  </Badge>
                  <span className="ml-auto text-sm text-muted-foreground">
                    {due ? (
                      <span className={due.overdue ? "font-medium text-danger" : ""}>{due.text}</span>
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
