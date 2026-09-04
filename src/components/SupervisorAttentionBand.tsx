/**
 * The supervisor's first band on Home: only decisions, never statistics.
 *
 * Frontline Home stays exactly as it is beneath this. A supervisor is still a
 * person with their own work, so this sits above their personal sections
 * rather than replacing them, and every tile drills into the queue that owns
 * that work rather than opening a private mini-report.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { readPreviewSeat } from "@/lib/demo-mode";
import {
  attentionHeadline,
  supervisorAttention,
  type AttentionApproval,
  type AttentionEscalation,
  type AttentionTicket,
} from "@/lib/supervisor-home";

export function SupervisorAttentionBand({ isDirector }: { isDirector?: boolean }) {
  const { demoMode } = useDemo();

  const { data } = useQuery({
    queryKey: ["supervisor-attention", demoMode],
    staleTime: 30_000,
    queryFn: async () => {
      const [tickets, escalations, approvals] = await Promise.all([
        supabase
          .from("tickets")
          .select(
            "id, ref, title, status, priority, category, reported_at, acknowledged_at, action_started_at, next_review_at, response_due_at, action_due_at, assigned_to, current_action_owner, handoff_status, escalated_at, escalation_level, reopen_count, guest_in_residence, guest_impact, closure_qa_result",
          )
          .eq("is_demo", demoMode)
          .is("archived_at", null)
          .limit(500),
        supabase
          .from("escalations")
          .select(
            "id, ticket_id, escalated_to_role, escalated_by, urgency, status, reason, outcome, created_at, resolved_at",
          )
          .eq("is_demo", demoMode)
          .limit(200),
        supabase
          .from("approvals")
          .select("id, title, status, approver_role, entity_type, entity_id")
          .eq("status", "pending")
          .eq("is_demo", demoMode)
          .limit(200),
      ]);
      return {
        tickets: (tickets.data ?? []) as AttentionTicket[],
        escalations: (escalations.data ?? []) as AttentionEscalation[],
        approvals: (approvals.data ?? []) as AttentionApproval[],
      };
    },
  });

  const seatIsDirector =
    isDirector ?? (typeof window !== "undefined" && readPreviewSeat() === "director_ops");

  const buckets = supervisorAttention({
    tickets: data?.tickets ?? [],
    escalations: data?.escalations ?? [],
    approvals: data?.approvals ?? [],
    isDirector: Boolean(seatIsDirector),
  });

  return (
    <section
      aria-label="Needs my decision"
      className="rounded-xl border border-border bg-secondary/30 p-4"
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow text-muted-foreground">Needs my decision</p>
          <h2 className="text-lg font-semibold tracking-tight">{attentionHeadline(buckets)}</h2>
        </div>
        <Link to="/oversight" className="text-sm font-medium text-primary hover:underline">
          Open Oversight
        </Link>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map((b) => (
          <li key={b.key}>
            <Link
              to={b.to as never}
              search={(b.search ?? {}) as never}
              className={`flex h-full flex-col justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/60 ${
                b.count > 0 && b.tone === "critical"
                  ? "border-destructive/40"
                  : b.count > 0 && b.tone === "warning"
                    ? "border-primary/30"
                    : "border-border"
              }`}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">{b.title}</span>
                <span
                  className={`text-xl font-semibold tabular-nums ${
                    b.count === 0 ? "text-muted-foreground" : ""
                  }`}
                >
                  {b.count}
                </span>
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{b.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
