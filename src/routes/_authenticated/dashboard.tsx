import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/BrandLogo";
import heroImage from "@/assets/home-hero.jpg";
import {
  EmptyState,
  LoadingPage,
  PriorityRail,
  SectionCard,
  StatTile,
} from "@/components/ui/page";
import { ArrowRight, Building2, ClipboardList, PackageCheck, Users } from "lucide-react";

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
      { title: "Home — Resolve Operations" },
      { name: "description", content: "Open guest issues, overdue tickets, and today's workload at a glance." },
      { property: "og:title", content: "Home — Resolve Operations" },
      { property: "og:description", content: "Open guest issues and overdue tickets at a glance." },
    ],
  }),
  component: Dashboard,
});

/** Morning / afternoon / evening in the reader's own clock. */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { demoMode } = useDemo();
  const role = useRole();
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
  const mine = role.userId
    ? open.filter((t) => t.current_action_owner === role.userId || t.assigned_to === role.userId)
    : [];

  // Leadership sees the whole portfolio's health first. A coordinator sees
  // their own workload first. Same data, ordered for the person reading it.
  const stats = role.isSupervisor
    ? [
        { label: "Open tickets", value: open.length, tone: "neutral" as const, hint: "Live across the portfolio" },
        { label: "Past its clock", value: breached.length, tone: "critical" as const, hint: "Response or action overdue" },
        { label: "Not acknowledged", value: unacked.length, tone: "attention" as const, hint: "Nobody has picked these up" },
        { label: "Closed this week", value: resolvedWeek.length, tone: "positive" as const, hint: "Last seven days" },
      ]
    : [
        { label: "Assigned to you", value: mine.length, tone: "neutral" as const, hint: "Your open tickets" },
        { label: "Past its clock", value: breached.length, tone: "critical" as const, hint: "Response or action overdue" },
        { label: "Waiting to be claimed", value: unacked.length, tone: "attention" as const, hint: "Nobody has picked these up" },
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
      {/* Branded entry point: who you are, what today looks like, and the two
          or three things you actually came here to do. */}
      <section className="plate relative overflow-hidden">
        <img
          src={heroImage}
          alt=""
          aria-hidden="true"
          width={1920}
          height={720}
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-20"
        />
        <div className="relative grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div className="min-w-0 space-y-4">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-9" />
              <span className="eyebrow text-sidebar-foreground/70">Resolve Operations</span>
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                {greeting()}. Keep calm — check Resolve.
              </h1>
              <p className="max-w-xl text-sm text-sidebar-foreground/75">
                {role.isSupervisor
                  ? `${data.propertyCount} properties, ${open.length} live tickets and ${escalated.length} escalated right now.`
                  : `You have ${mine.length} open ${mine.length === 1 ? "ticket" : "tickets"}. ${unacked.length} more are waiting to be claimed.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/tickets/new"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-sidebar-primary px-4 text-sm font-semibold text-sidebar-primary-foreground transition-opacity hover:opacity-90"
              >
                Log a ticket
              </Link>
              <Link
                to="/tickets"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sidebar-border px-4 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
              >
                Open the queue <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <HeroLink to="/tickets" icon={<ClipboardList className="size-4" />} label="Tickets" hint={`${open.length} open`} />
            {role.can("properties") && (
              <HeroLink to="/properties" icon={<Building2 className="size-4" />} label="Properties" hint={`${data.propertyCount} in the portfolio`} />
            )}
            {role.can("onboarding_workspace") && (
              <HeroLink to="/onboarding" icon={<PackageCheck className="size-4" />} label="Onboarding" hint="Projects and tasks" />
            )}
            {role.can("user_management") && (
              <HeroLink to="/team" icon={<Users className="size-4" />} label="Team & coverage" hint="Seats, shifts, on-call" />
            )}
          </div>
        </div>
      </section>

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


/** One shortcut tile in the hero: where to go, and why you would. */
function HeroLink({
  to,
  icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      // Static destinations only; all of these routes exist in the nav.
      to={to as never}
      className="group flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-3.5 py-2.5 transition-colors hover:bg-sidebar-accent"
    >
      <span className="text-sidebar-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-sidebar-foreground/65">{hint}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-sidebar-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
