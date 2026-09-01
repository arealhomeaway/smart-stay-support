import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { Badge } from "@/components/ui/badge";
import { EmptyState, LoadingPage, PageHeader, PriorityRail, SectionCard, StatTile } from "@/components/ui/page";

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
          .is("archived_at", null)
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
    return <LoadingPage tiles={4} />;
  }

  const open = data.tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const breached = open.filter((t) => slaState(t).breached);
  const escalated = open.filter((t) => slaState(t).escalation);
  const unacked = open.filter((t) => !t.acknowledged_at);
  const resolvedWeek = data.tickets.filter(
    (t) => t.resolved_at && Date.now() - new Date(t.resolved_at).getTime() < 7 * 864e5,
  );

  const stats = [
    { label: "Open tickets", value: open.length, tone: "neutral" as const, hint: "Live across the portfolio" },
    { label: "Past its clock", value: breached.length, tone: "critical" as const, hint: "Response or action overdue" },
    { label: "Not acknowledged", value: unacked.length, tone: "attention" as const, hint: "Nobody has picked these up" },
    { label: "Closed this week", value: resolvedWeek.length, tone: "positive" as const, hint: "Last seven days" },
  ];

  const attention = open
    .slice()
    .sort((a, b) =>
      (a.response_due_at ?? a.action_due_at ?? "").localeCompare(b.response_due_at ?? b.action_due_at ?? ""),
    )
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Keep calm. Check Resolve."
        title="Operations dashboard"
        description={`Your new favourite place to find things — ${data.propertyCount} properties, ${open.length} live issues.`}
        actions={
          <Link
            to="/tickets/new"
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Log a ticket
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} tone={s.tone} hint={s.hint} />
        ))}
      </div>

      {escalated.length > 0 && (
        <SectionCard
          tone="critical"
          title="Escalated right now"
          description="These have passed their escalation point and someone senior is expected to step in."
          bodyClassName="space-y-2"
        >
          {escalated.map((t) => (
            <Link
              key={t.id}
              to="/tickets/$ticketId"
              params={{ ticketId: t.id }}
              className="surface-row relative flex flex-wrap items-center gap-3 border-danger/30 py-2.5 pl-5 pr-3"
            >
              <PriorityRail priority={t.priority} />
              <Badge variant="outline" className={priorityTone(t.priority)}>
                {priorityMeta(t.priority).short}
              </Badge>
              <span className="min-w-0 truncate font-medium">{t.title}</span>
              <span className="ml-auto shrink-0 text-sm font-medium text-danger">{slaState(t).escalation?.who}</span>
            </Link>
          ))}
        </SectionCard>
      )}

      <SectionCard
        title="Needs attention now"
        description="Open tickets, soonest clock first."
        bodyClassName="space-y-2"
      >
        {attention.length === 0 ? (
          <EmptyState
            title="Nothing open right now."
            hint="Every ticket in the portfolio is resolved or waiting on someone outside the team."
            action={
              <Link to="/tickets/new" className="text-sm font-medium text-primary hover:underline">
                Log a ticket
              </Link>
            }
          />
        ) : (
          attention.map((t) => {
            const sla = slaState(t);
            const live = sla.response?.met === false ? sla.response : sla.action?.met === false ? sla.action : null;
            return (
              <Link
                key={t.id}
                to="/tickets/$ticketId"
                params={{ ticketId: t.id }}
                className="surface-row relative flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 pl-5 pr-3"
              >
                <PriorityRail priority={t.priority} />
                <Badge variant="outline" className={priorityTone(t.priority)}>
                  {priorityMeta(t.priority).short}
                </Badge>
                <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {t.properties?.nickname ?? t.properties?.name ?? "Unassigned property"}
                </span>
                <Badge variant="outline" className={statusTone(t.status)}>
                  {labelFor(STATUSES, t.status)}
                </Badge>
                <span className="numeric ml-auto shrink-0 text-sm text-muted-foreground">
                  {live ? (
                    <span className={live.breached ? "font-medium text-danger" : ""}>{live.label}</span>
                  ) : (
                    relativeTime(t.reported_at)
                  )}
                </span>
              </Link>
            );
          })
        )}
      </SectionCard>
    </div>
  );
}

