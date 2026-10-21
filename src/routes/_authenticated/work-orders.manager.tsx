/**
 * Manager oversight for Work Orders.
 *
 * Operational oversight, not analytics: each filter is a list of jobs a
 * supervisor may need to act on today, plus homes showing a pattern.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { RequireCapability } from "@/components/RequireCapability";
import {
  WorkOrderListSection,
  useWorkOrderPropertyNames,
  useWorkOrderRequirements,
  useWorkOrders,
} from "@/components/workorders/WorkOrderList";
import { useRole } from "@/hooks/useRole";
import type { RequirementLike } from "@/lib/claims";
import {
  MAINTENANCE_POLICY_VERSION,
  MANAGER_FILTER_LABELS,
  matchesManagerFilter,
  repeatMaintenanceProperties,
  workOrderSort,
  type WorkOrderManagerFilter,
} from "@/lib/work-orders";

export const Route = createFileRoute("/_authenticated/work-orders/manager")({
  component: () => (
    <RequireCapability capability="claims_oversight" title="Work order oversight">
      <WorkOrderManager />
    </RequireCapability>
  ),
});

const FILTERS = Object.keys(MANAGER_FILTER_LABELS) as WorkOrderManagerFilter[];

function WorkOrderManager() {
  const workOrders = useWorkOrders();
  const requirements = useWorkOrderRequirements();
  const propertyNames = useWorkOrderPropertyNames();
  const { readOnly } = useRole();
  const [filter, setFilter] = useState<WorkOrderManagerFilter>("owner_approval_pending");

  const rows = useMemo(
    () =>
      [...(workOrders.data ?? [])]
        .filter((w) => matchesManagerFilter(w, filter))
        .sort(workOrderSort),
    [workOrders.data, filter],
  );

  const repeats = useMemo(
    () => repeatMaintenanceProperties(workOrders.data ?? []),
    [workOrders.data],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work Orders"
        title="Manager"
        description="Approvals still outstanding, vendors who missed their commitment, and homes mitigated but never permanently repaired."
      />

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={f === filter ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {MANAGER_FILTER_LABELS[f]}
          </Button>
        ))}
      </div>

      {workOrders.isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing in this view" hint="Nothing currently matches this filter." />
      ) : (
        <WorkOrderListSection
          workOrders={rows}
          requirements={requirements.data ?? new Map<string, RequirementLike[]>()}
          propertyNames={propertyNames.data ?? new Map()}
          canEdit={!readOnly}
          originLabel="Work order oversight"
        />
      )}

      {repeats.length > 0 ? (
        <SectionCard
          title="Homes with repeat maintenance"
          description="More than one Work Order on the same home in 90 days — usually a property problem, not a one-off."
        >
          <ul className="space-y-1 text-sm">
            {repeats.map((r) => (
              <li key={r.property_id}>
                {propertyNames.data?.get(r.property_id) ?? "Property"} — {r.count} Work Orders
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <p className="text-xs text-muted-foreground">{MAINTENANCE_POLICY_VERSION}</p>
    </div>
  );
}
