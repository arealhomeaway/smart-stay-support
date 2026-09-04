/**
 * Leads Home — action first.
 *
 * The question this page answers is "who needs me right now?", not "what rows
 * exist?". Buckets are derived from stage and last contact; nothing here is a
 * stored status somebody must remember to update.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import { LeadListSection, useLeads, useLeadsWithProperties } from "@/components/leads/LeadList";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import {
  QUEUE_LABELS,
  QUEUE_ORDER,
  isOpen,
  leadSort,
  queueBucket,
  type QueueBucket,
} from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/leads/")({
  component: LeadsHome,
});

function LeadsHome() {
  const leads = useLeads();
  const linked = useLeadsWithProperties();
  const userId = useCurrentUserId();
  const { readOnly } = useRole();

  const buckets = useMemo(() => {
    const rows = (leads.data ?? []).filter((l) => isOpen(l.stage)).sort(leadSort);
    const map = new Map<QueueBucket, typeof rows>();
    for (const bucket of QUEUE_ORDER) map.set(bucket, []);
    for (const lead of rows) {
      const b = queueBucket(lead);
      if (b) map.get(b)!.push(lead);
    }
    return map;
  }, [leads.data]);

  const mine = (leads.data ?? []).filter((l) => isOpen(l.stage) && l.assigned_to === userId);
  const withProperties = linked.data ?? new Set<string>();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenant leads"
        title="Today"
        description="Direct and non-OTA booking opportunities, ordered by what needs a response first."
        actions={
          !readOnly ? (
            <Button asChild className="resolve-press">
              <Link to="/leads/new">
                <Plus className="size-4" aria-hidden="true" /> New lead
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Overdue follow-ups"
          value={buckets.get("overdue")?.length ?? 0}
          tone="critical"
        />
        <StatTile label="Due today" value={buckets.get("today")?.length ?? 0} tone="attention" />
        <StatTile label="New, unanswered" value={buckets.get("new")?.length ?? 0} />
        <StatTile label="My open leads" value={mine.length} hint="Assigned to you" />
      </div>

      {leads.isLoading ? (
        <LoadingRows rows={5} />
      ) : (leads.data ?? []).filter((l) => isOpen(l.stage)).length === 0 ? (
        <EmptyState
          title="No open leads"
          hint="New enquiries appear here the moment they are logged."
          action={
            !readOnly ? (
              <Button asChild size="sm" className="resolve-press">
                <Link to="/leads/new">Log the first lead</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        QUEUE_ORDER.map((bucket) => {
          const rows = buckets.get(bucket) ?? [];
          if (rows.length === 0) return null;
          return (
            <SectionCard
              key={bucket}
              title={QUEUE_LABELS[bucket]}
              description={`${rows.length} lead${rows.length === 1 ? "" : "s"}`}
              tone={bucket === "overdue" ? "critical" : "default"}
            >
              <LeadListSection leads={rows} withProperties={withProperties} canEdit={!readOnly} />
            </SectionCard>
          );
        })
      )}
    </div>
  );
}
