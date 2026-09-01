/** My leads — the same opportunities, filtered to the person looking. */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard, SegmentedControl } from "@/components/ui/page";
import { LeadListSection, useLeads, useLeadsWithProperties } from "@/components/leads/LeadList";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { QUEUE_LABELS, QUEUE_ORDER, isOpen, leadSort, queueBucket, type QueueBucket } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/leads/my-leads")({
  component: MyLeads,
});

type Filter = "open" | "closed";

function MyLeads() {
  const leads = useLeads();
  const linked = useLeadsWithProperties();
  const userId = useCurrentUserId();
  const { readOnly } = useRole();
  const [filter, setFilter] = useState<Filter>("open");

  const mine = useMemo(
    () => (leads.data ?? []).filter((l) => l.assigned_to === userId),
    [leads.data, userId],
  );
  const open = mine.filter((l) => isOpen(l.stage)).sort(leadSort);
  const closed = mine.filter((l) => !isOpen(l.stage));
  const withProperties = linked.data ?? new Set<string>();

  const grouped = useMemo(() => {
    const map = new Map<QueueBucket, typeof open>();
    for (const bucket of QUEUE_ORDER) map.set(bucket, []);
    for (const lead of open) {
      const b = queueBucket(lead);
      if (b) map.get(b)!.push(lead);
    }
    return map;
  }, [open]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenant leads"
        title="My leads"
        description="Everything assigned to you, grouped by when it needs attention."
        actions={
          <SegmentedControl
            ariaLabel="Lead filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "open", label: "Open", count: open.length },
              { value: "closed", label: "Closed", count: closed.length },
            ]}
          />
        }
      />

      {leads.isLoading ? (
        <LoadingRows rows={4} />
      ) : filter === "closed" ? (
        closed.length === 0 ? (
          <EmptyState title="Nothing closed yet" hint="Converted and lost leads land here." />
        ) : (
          <SectionCard title="Closed leads">
            <LeadListSection leads={closed} withProperties={withProperties} canEdit={!readOnly} />
          </SectionCard>
        )
      ) : open.length === 0 ? (
        <EmptyState title="No open leads assigned to you" hint="Pick one up from Today." />
      ) : (
        QUEUE_ORDER.map((bucket) => {
          const rows = grouped.get(bucket) ?? [];
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
