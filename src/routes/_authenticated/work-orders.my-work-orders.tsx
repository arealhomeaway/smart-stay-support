/** The Work Orders this employee is responsible for right now. */
import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui/page";
import {
  WorkOrderListSection,
  useWorkOrderPropertyNames,
  useWorkOrderRequirements,
  useWorkOrders,
} from "@/components/workorders/WorkOrderList";
import { useRole } from "@/hooks/useRole";
import { useCurrentUserId } from "@/hooks/useTeam";
import type { RequirementLike } from "@/lib/claims";
import { isOpenWorkOrder, workOrderSort } from "@/lib/work-orders";

export const Route = createFileRoute("/_authenticated/work-orders/my-work-orders")({
  component: MyWorkOrders,
});

function MyWorkOrders() {
  const workOrders = useWorkOrders();
  const requirements = useWorkOrderRequirements();
  const propertyNames = useWorkOrderPropertyNames();
  const { readOnly } = useRole();
  const userId = useCurrentUserId();

  const rows = [...(workOrders.data ?? [])]
    // Ownership only moves when a handoff is accepted, never because a vendor
    // or an owner is the one we are waiting on.
    .filter((w) => w.assigned_to === userId && isOpenWorkOrder(w))
    .sort(workOrderSort);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Work Orders"
        title="Mine"
        description="Work Orders you own. Waiting on a vendor, an owner or a warranty does not hand this to anyone else."
      />
      {workOrders.isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing assigned to you" hint="Pick one up from Today." />
      ) : (
        <WorkOrderListSection
          workOrders={rows}
          requirements={requirements.data ?? new Map<string, RequirementLike[]>()}
          propertyNames={propertyNames.data ?? new Map()}
          canEdit={!readOnly}
          originLabel="My Work Orders"
        />
      )}
    </div>
  );
}
