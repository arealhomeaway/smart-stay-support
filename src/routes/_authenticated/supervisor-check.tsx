import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/RequireCapability";
import { QueueOpenLogger } from "@/components/scorecard/QueueOpenLogger";
import { RatingChannelsCard } from "@/components/scorecard/RatingChannelsCard";
import { WeeklyRepeatList } from "@/components/work-entry/HomeRepeatFlags";
import { SectionCard } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "@/components/DemoProvider";
import { usDateTime } from "@/lib/dates";
import { groupSupervisorCheck, type CheckTicket } from "@/lib/supervisor-check";

export const Route = createFileRoute("/_authenticated/supervisor-check")({
  head: () => ({
    meta: [
      { title: "Supervisor check — Resolve" },
      {
        name: "description",
        content:
          "Read-only daily check: the last 24 hours of tickets, overdue and unassigned work, and refunds waiting on approval.",
      },
      { property: "og:title", content: "Supervisor check — Resolve" },
      { property: "og:description", content: "One read-only page for the daily supervisor check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="oversight" title="Oversight">
      <SupervisorCheck />
    </RequireCapability>
  ),
});

type Row = CheckTicket & { ref: number | null };
type Refund = { id: string; ticket_id: string | null; approval_status: string | null; proposed_amount: number | null; created_at: string };

const KIND_LABEL = { created: "New", changed: "Changed", closed: "Closed" } as const;

function SupervisorCheck() {
  const { demoMode } = useDemo();
  const q = useQuery({
    queryKey: ["supervisor-check", demoMode],
    queryFn: async () => {
      const [t, r] = await Promise.all([
        supabase
          .from("tickets")
          .select("id, ref, title, status, created_at, updated_at, resolved_at, assigned_to, next_action_due_at, external_source, external_status, reported_at, import_hold")
          .eq("is_demo", demoMode)
          .is("archived_at", null)
          .order("updated_at", { ascending: false })
          .limit(1000),
        supabase
          .from("guest_recovery")
          .select("id, ticket_id, approval_status, proposed_amount, created_at")
          .eq("is_demo", demoMode)
          .eq("approval_status", "pending")
          .order("created_at"),
      ]);
      if (t.error) throw t.error;
      if (r.error) throw r.error;
      const tickets = (t.data ?? []).map((x) => ({ ...x, closed_at: (x as { resolved_at: string | null }).resolved_at })) as unknown as Row[];
      return { tickets, refunds: (r.data ?? []) as Refund[] };
    },
  });

  if (q.isPending) return <Skeleton className="h-96 w-full" />;
  if (q.error) return <p role="alert">Could not load the supervisor check. Please try again.</p>;
  const g = groupSupervisorCheck(q.data.tickets, Date.now());

  const list = (rows: Row[], empty: string) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">{empty}</p>
    ) : (
      <ul className="divide-y divide-border">
        {rows.map((t) => (
          <li key={t.id} className="py-2 text-sm">
            <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="font-medium underline-offset-2 hover:underline">
              {t.ref ? `#${t.ref} ` : ""}{t.title ?? "Ticket"}
            </Link>
            <span className="ml-2 text-muted-foreground">{t.status.replace(/_/g, " ")}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="space-y-6">
      <QueueOpenLogger source="supervisor_check" />
      <header>
        <h1 className="font-display text-2xl font-semibold">Supervisor check</h1>
        <p className="text-sm text-muted-foreground">
          Read only. Open any item to act on it there. Live exceptions stay on{" "}
          <Link to="/oversight" className="underline">Oversight</Link>.
        </p>
      </header>

      <SectionCard title={`Last 24 hours (${g.last24h.length})`}>
        {g.last24h.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing was created, changed or closed in the last 24 hours.</p>
        ) : (
          <ul className="divide-y divide-border">
            {g.last24h.map(({ ticket: t, kind }) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="rounded bg-muted px-2 py-0.5 text-xs">{KIND_LABEL[kind]}</span>
                <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="font-medium hover:underline">
                  {(t as Row).ref ? `#${(t as Row).ref} ` : ""}{t.title ?? "Ticket"}
                </Link>
                <span className="text-muted-foreground">{usDateTime(t.updated_at ?? t.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={`Overdue (${g.overdue.length})`}>{list(g.overdue as Row[], "Nothing is overdue.")}</SectionCard>
      <SectionCard title={`Unassigned (${g.unassigned.length})`}>{list(g.unassigned as Row[], "Everything open has an owner.")}</SectionCard>

      <SectionCard title={`Refunds waiting on approval (${q.data.refunds.length})`}>
        {q.data.refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No refunds or credits are waiting on approval.</p>
        ) : (
          <ul className="divide-y divide-border">
            {q.data.refunds.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <Link to="/recovery" search={{ open: r.id } as never} className="font-medium hover:underline">
                  {r.proposed_amount != null ? `$${r.proposed_amount}` : "Refund or credit"}
                </Link>
                <span className="ml-2 text-muted-foreground">logged {usDateTime(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <WeeklyRepeatList />
      <RatingChannelsCard />
    </div>
  );
}
