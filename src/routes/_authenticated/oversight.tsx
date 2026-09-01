import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";
import { OnCallNowCard } from "@/components/OnCallNowCard";
import { OvernightHandoffPanel } from "@/components/OvernightHandoffPanel";

export const Route = createFileRoute("/_authenticated/oversight")({
  head: () => ({
    meta: [
      { title: "Oversight queue — Resolve Operations" },
      {
        name: "description",
        content:
          "The supervisor exception queue: unacknowledged P1s, stalled work, waiting tickets with no review date, and reopened issues.",
      },
      { property: "og:title", content: "Oversight queue — Resolve Operations" },
      { property: "og:description", content: "Exceptions only — the tickets that need a supervisor's eyes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <SupervisorOnly>
      <Oversight />
    </SupervisorOnly>
  ),
});

type Row = {
  id: string;
  ref: number;
  title: string;
  status: string;
  priority: string;
  reported_at: string;
  properties?: { name: string; nickname: string | null } | null;
};

function Oversight() {
  const { data, isLoading } = useQuery({
    queryKey: ["oversight"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("*, properties(name, nickname)")
        // Demo records never appear in oversight.
        .eq("is_demo", false)
        // Archived tickets are out of the active queue and raise no exceptions.
        .is("archived_at", null)
        .order("reported_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const open = data.filter((t) => OPEN_STATUSES.includes(t.status));

  const unackedP1 = open.filter((t) => t.priority === "p1" && !t.acknowledged_at);
  const unacked = open.filter(
    (t) => t.priority !== "p1" && !t.acknowledged_at && slaState(t).response?.breached,
  );
  const notStarted = open.filter((t) => t.acknowledged_at && !t.action_started_at && slaState(t).action?.breached);
  const pendingHandoffs = open.filter((t) => t.handoff_status === "pending");
  const waitingNoReview = open.filter((t) => t.status === "waiting" && !t.next_review_at);
  const reviewOverdue = open.filter(
    (t) => t.next_review_at && new Date(t.next_review_at).getTime() < Date.now(),
  );
  const reopened = data.filter((t) => (t.reopen_count ?? 0) > 0 && OPEN_STATUSES.includes(t.status));
  const closureQa = data.filter(
    (t) => t.status === "resolved" && t.closure_qa_result === "not_reviewed",
  );

  const sections = [
    {
      title: "P1 not acknowledged",
      description: "Escalation ladder is running. Someone must respond now.",
      rows: unackedP1,
      tone: "danger" as const,
    },
    {
      title: "Response overdue",
      description: "Acknowledge window passed without a reply.",
      rows: unacked,
      tone: "danger" as const,
    },
    {
      title: "Acknowledged but not started",
      description: "Someone replied but no work has begun inside the target.",
      rows: notStarted,
      tone: "warning" as const,
    },
    {
      title: "Handoffs waiting to be accepted",
      description: "Ownership has not transferred yet — the original owner is still accountable.",
      rows: pendingHandoffs,
      tone: "warning" as const,
    },
    {
      title: "Waiting with no review date",
      description: "These will silently disappear. Give each one a date.",
      rows: waitingNoReview,
      tone: "warning" as const,
    },
    {
      title: "Review date passed",
      description: "The promised check-in never happened.",
      rows: reviewOverdue,
      tone: "warning" as const,
    },
    {
      title: "Reopened tickets",
      description: "Closed too early, or the fix did not hold. Worth a look at the playbook.",
      rows: reopened,
      tone: "warning" as const,
    },
    {
      title: "Closure QA pending",
      description: "Resolved tickets that have not been quality-checked yet.",
      rows: closureQa,
      tone: "neutral" as const,
    },
  ];

  const totalExceptions = sections
    .filter((s) => s.tone !== "neutral")
    .reduce((n, s) => n + s.rows.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Oversight queue</h1>
        <p className="mt-1 text-muted-foreground">
          Exceptions only. {totalExceptions === 0 ? "Nothing is slipping right now." : `${totalExceptions} ticket${totalExceptions === 1 ? "" : "s"} need${totalExceptions === 1 ? "s" : ""} attention.`}
        </p>
        <ReportingBaselineNote className="mt-3 max-w-2xl" />
      </div>

      <OnCallNowCard className="max-w-2xl" />

      <OvernightHandoffPanel />


      {sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {section.title}
              <Badge
                variant="outline"
                className={
                  section.rows.length === 0
                    ? "border-success/30 bg-success/10 text-success"
                    : section.tone === "danger"
                      ? "border-danger/40 bg-danger/10 text-danger"
                      : "border-warning/40 bg-warning/10"
                }
              >
                {section.rows.length}
              </Badge>
            </CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          {section.rows.length > 0 && (
            <CardContent className="space-y-2">
              {section.rows.map((t) => (
                <ExceptionRow key={t.id} ticket={t as Row} />
              ))}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function ExceptionRow({ ticket }: { ticket: Row }) {
  return (
    <Link
      to="/tickets/$ticketId"
      params={{ ticketId: ticket.id }}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary"
    >
      <Badge variant="outline" className={priorityTone(ticket.priority)}>
        {priorityMeta(ticket.priority).short}
      </Badge>
      <span className="font-medium">{ticket.title}</span>
      <span className="text-sm text-muted-foreground">
        {ticket.properties?.nickname ?? ticket.properties?.name ?? "No property"}
      </span>
      <Badge variant="outline" className={statusTone(ticket.status)}>
        {labelFor(STATUSES, ticket.status)}
      </Badge>
      <span className="ml-auto text-sm text-muted-foreground">{relativeTime(ticket.reported_at)}</span>
    </Link>
  );
}
