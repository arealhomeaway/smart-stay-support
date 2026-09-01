/**
 * Manager view — oversight and real-data analytics.
 *
 * Every number is computed from what happened: no targets, no scoring of
 * individual staff, no invented revenue.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import { LeadListSection, useLeads, useLeadsWithProperties } from "@/components/leads/LeadList";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { displayName, useStaffDirectory } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import {
  attentionFlags,
  followUpBucket,
  formatMoney,
  isOpen,
  leadAnalytics,
  leadSort,
} from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/leads/manager")({
  component: () => (
    <SupervisorOnly>
      <Manager />
    </SupervisorOnly>
  ),
});

function pct(v: number | null) {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function Manager() {
  const leads = useLeads();
  const linked = useLeadsWithProperties();
  const people = useStaffDirectory().data ?? [];
  const { readOnly } = useRole();

  const rows = leads.data ?? [];
  const withProperties = linked.data ?? new Set<string>();
  const analytics = useMemo(() => leadAnalytics(rows as never[]), [rows]);

  const needsAttention = rows
    .filter(
      (l) =>
        isOpen(l.stage) &&
        (followUpBucket(l) === "overdue" ||
          attentionFlags(l, { hasProperty: withProperties.has(l.id) }).some(
            (f) => f.tone === "critical",
          )),
    )
    .sort(leadSort);

  const unassigned = rows.filter((l) => isOpen(l.stage) && !l.assigned_to);

  const byOwner = useMemo(() => {
    const map = new Map<string | null, { open: number; overdue: number; converted: number }>();
    for (const l of rows) {
      const key = l.assigned_to;
      const row = map.get(key) ?? { open: 0, overdue: 0, converted: 0 };
      if (isOpen(l.stage)) {
        row.open += 1;
        if (followUpBucket(l) === "overdue") row.overdue += 1;
      }
      if (l.stage === "converted") row.converted += 1;
      map.set(key, row);
    }
    return [...map.entries()].sort((a, b) => b[1].open - a[1].open);
  }, [rows]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenant leads"
        title="Manager view"
        description="Where the pipeline is leaking, who is carrying what, and what the data actually shows."
      />

      {leads.isLoading ? (
        <LoadingRows rows={4} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Leads received" value={analytics.received} />
            <StatTile label="Open" value={analytics.open} />
            <StatTile label="Converted" value={analytics.converted} tone="positive" />
            <StatTile
              label="Conversion rate"
              value={pct(analytics.conversionRate)}
              hint="Converted ÷ received"
            />
            <StatTile
              label="Follow-up compliance"
              value={pct(analytics.followUpCompliance)}
              hint="Open leads not overdue"
              tone={
                analytics.followUpCompliance !== null && analytics.followUpCompliance < 0.8
                  ? "attention"
                  : "neutral"
              }
            />
            <StatTile
              label="Avg days to conversion"
              value={
                analytics.avgDaysToConversion === null ? "—" : analytics.avgDaysToConversion.toFixed(1)
              }
            />
            <StatTile label="Quoted revenue converted" value={formatMoney(analytics.convertedRevenue)} />
            <StatTile label="Unassigned" value={unassigned.length} tone={unassigned.length ? "critical" : "neutral"} />
          </div>

          <SectionCard
            title="Needs a manager's eyes"
            description="Overdue follow-ups, unassigned leads and approaching move-ins with no property match."
            tone={needsAttention.length ? "critical" : "default"}
          >
            {needsAttention.length === 0 ? (
              <EmptyState title="Nothing flagged" hint="Every open lead is inside its follow-up window." />
            ) : (
              <LeadListSection leads={needsAttention} withProperties={withProperties} canEdit={!readOnly} />
            )}
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Workload" description="Open, overdue and converted per coordinator.">
              <ul className="space-y-1.5 text-sm">
                {byOwner.map(([id, v]) => (
                  <li key={id ?? "unassigned"} className="flex justify-between gap-3 border-b border-border/40 pb-1">
                    <span>{id ? displayName(people.find((p) => p.id === id)) : "Unassigned"}</span>
                    <span className="text-muted-foreground">
                      {v.open} open · {v.overdue} overdue · {v.converted} converted
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Where leads come from" description="Volume and conversions by source.">
              <ul className="space-y-1.5 text-sm">
                {analytics.bySource.map((s) => (
                  <li key={s.key} className="flex justify-between gap-3 border-b border-border/40 pb-1">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground">
                      {s.count} leads · {s.converted} converted
                    </span>
                  </li>
                ))}
                {analytics.bySource.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
              </ul>
            </SectionCard>

            <SectionCard title="Markets" description="Demand by area requested.">
              <ul className="space-y-1.5 text-sm">
                {analytics.byMarket.map((m) => (
                  <li key={m.key} className="flex justify-between gap-3 border-b border-border/40 pb-1">
                    <span>{m.key}</span>
                    <span className="text-muted-foreground">
                      {m.count} leads · {m.converted} converted
                    </span>
                  </li>
                ))}
                {analytics.byMarket.length === 0 && <li className="text-muted-foreground">No data yet.</li>}
              </ul>
            </SectionCard>

            <SectionCard title="Why we lose" description="Loss reasons recorded at close.">
              <ul className="space-y-1.5 text-sm">
                {analytics.lossReasons.map((r) => (
                  <li key={r.key} className="flex justify-between gap-3 border-b border-border/40 pb-1">
                    <span>{r.label}</span>
                    <span className="text-muted-foreground">{r.count}</span>
                  </li>
                ))}
                {analytics.lossReasons.length === 0 && (
                  <li className="text-muted-foreground">Nothing closed as lost yet.</li>
                )}
              </ul>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
