/**
 * Work orders — action first.
 *
 * The page answers "which home is still broken, and what is the next move?".
 * Every bucket is derived from quotes, approvals, warranty state, vendor
 * commitments and evidence — nobody maintains a status by hand.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import {
  WorkOrderListSection,
  useWorkOrderPropertyNames,
  useWorkOrderRequirements,
  useWorkOrders,
} from "@/components/workorders/WorkOrderList";
import { useRole } from "@/hooks/useRole";
import type { RequirementLike } from "@/lib/claims";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  MAINTENANCE_POLICY_VERSION,
  isOpenWorkOrder,
  money,
  recentlyCompleted,
  workOrderBucket,
  workOrderSort,
  type WorkOrderBucket,
} from "@/lib/work-orders";
import type { WorkOrderRow } from "@/lib/work-order-types";

export const Route = createFileRoute("/_authenticated/work-orders/")({
  component: WorkOrdersHome,
});

const BUCKET_HELP: Record<WorkOrderBucket, string> = {
  needs_action: "Nobody has moved this on, or a vendor commitment has been missed.",
  waiting_quote: "The cost is unknown, so authority cannot be decided yet.",
  waiting_owner: "Above the ARHA owner threshold — waiting on the owner's decision.",
  warranty_pending: "The warranty route is open. Do not pay for covered work.",
  waiting_vendor: "Scheduled with a vendor. Watch the acknowledgment and arrival checkpoints.",
  evidence_missing: "Work is done but the record is not — photos, report or invoice.",
  permanent_pending: "Mitigated only. The home still needs the permanent repair.",
  closed: "Closed in the last 30 days.",
};

function WorkOrdersHome() {
  const workOrders = useWorkOrders();
  const requirements = useWorkOrderRequirements();
  const propertyNames = useWorkOrderPropertyNames();
  const { readOnly } = useRole();

  const reqMap = requirements.data ?? new Map<string, RequirementLike[]>();

  const buckets = useMemo(() => {
    const rows = [...(workOrders.data ?? [])].sort(workOrderSort);
    const map = new Map<WorkOrderBucket, WorkOrderRow[]>();
    for (const b of BUCKET_ORDER) map.set(b, []);
    for (const row of rows) {
      if (row.closed_at && !recentlyCompleted(row)) continue;
      const bucket = workOrderBucket(row);
      map.get(bucket)?.push(row);
    }
    return map;
  }, [workOrders.data, reqMap]);

  const open = (workOrders.data ?? []).filter(isOpenWorkOrder);
  const committed = open.reduce((sum, w) => sum + (w.approved_amount ?? w.quote_amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work orders"
        title="Today"
        description="Maintenance execution, ordered by what is still unresolved. Work orders start on the ticket where the issue was reported."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Needs action"
          value={buckets.get("needs_action")?.length ?? 0}
          tone="critical"
        />
        <StatTile label="Waiting on owner" value={buckets.get("waiting_owner")?.length ?? 0} />
        <StatTile label="Open work orders" value={open.length} />
        <StatTile label="Committed spend, open" value={money(committed)} />
      </div>

      {workOrders.isLoading ? (
        <LoadingRows />
      ) : open.length === 0 && (buckets.get("closed")?.length ?? 0) === 0 ? (
        <EmptyState
          title="No work orders open"
          hint="Create one from the ticket where the maintenance issue was reported."
        />
      ) : (
        BUCKET_ORDER.map((bucket) => {
          const rows = buckets.get(bucket) ?? [];
          if (rows.length === 0) return null;
          return (
            <SectionCard
              key={bucket}
              title={BUCKET_LABELS[bucket]}
              description={BUCKET_HELP[bucket]}
            >
              <WorkOrderListSection
                workOrders={rows}
                requirements={reqMap}
                propertyNames={propertyNames.data ?? new Map()}
                canEdit={!readOnly}
              />
            </SectionCard>
          );
        })
      )}

      <p className="text-xs text-muted-foreground">{MAINTENANCE_POLICY_VERSION}</p>
    </div>
  );
}
