/**
 * Work orders — action first.
 *
 * The page answers "which home is still broken, and what is the next move?".
 * Every bucket is derived from quotes, approvals, warranty state, vendor
 * commitments and evidence — nobody maintains a status by hand.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  LoadingRows,
  PageHeader,
  SectionCard,
  StatTile,
  SegmentedControl,
} from "@/components/ui/page";
import { usDate } from "@/lib/dates";
import {
  WorkOrderRowCard,
  useWorkOrderPropertyNames,
  useWorkOrderPropertyPhotos,
  useWorkOrderRequirements,
  useWorkOrders,
} from "@/components/workorders/WorkOrderList";
import { WorkOrderDrawer } from "@/components/workorders/WorkOrderDrawer";
import { useAmbientOrigin } from "@/components/nav/NavContext";
import { displayName, useStaffDirectory, type TeamMember } from "@/hooks/useTeam";
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
  validateSearch: (raw: Record<string, unknown>) => ({
    view: raw["view"] === "scheduled" ? ("scheduled" as const) : undefined,
    open: typeof raw["open"] === "string" ? raw["open"] : undefined,
    from: typeof raw["from"] === "string" ? raw["from"] : undefined,
  }),
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
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const view = search.view === "scheduled" ? "scheduled" : "action";
  const workOrders = useWorkOrders();
  const requirements = useWorkOrderRequirements();
  const propertyNames = useWorkOrderPropertyNames();
  const propertyPhotos = useWorkOrderPropertyPhotos().data ?? new Map<string, string | null>();
  const people = useStaffDirectory().data ?? [];
  const originToken = useAmbientOrigin("Work Orders");
  const { readOnly } = useRole();

  const reqMap = requirements.data ?? new Map<string, RequirementLike[]>();
  const nameFor = (id: string | null) =>
    id ? displayName(people.find((p: TeamMember) => p.id === id)) : "Unassigned";

  // The drawer's identity lives at the page, not inside a bucket section:
  // recording a checkpoint (e.g. "Vendor says complete") can move a work
  // order into a different bucket and empty out the section it was opened
  // from. A drawer owned by that section would unmount with it — this one
  // doesn't, because it is looked up from the full, unfiltered list.
  const [openId, setOpenId] = useState<string | null>(search.open ?? null);
  const lastOpen = useRef<WorkOrderRow | null>(null);
  const fromAll = (workOrders.data ?? []).find((w) => w.id === openId) ?? null;
  if (fromAll) lastOpen.current = fromAll;
  const openWorkOrder = openId ? (fromAll ?? lastOpen.current) : null;
  useEffect(() => {
    if (!openId) lastOpen.current = null;
  }, [openId]);

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
  }, [workOrders.data]);

  const open = (workOrders.data ?? []).filter(isOpenWorkOrder);
  const committed = open.reduce((sum, w) => sum + (w.approved_amount ?? w.quote_amount ?? 0), 0);
  const scheduled = useMemo(() => {
    const rows = (workOrders.data ?? [])
      .filter((row) => isOpenWorkOrder(row) && (row.scheduled_for || row.vendor_eta_at))
      .sort((a, b) =>
        (a.scheduled_for ?? a.vendor_eta_at ?? "").localeCompare(
          b.scheduled_for ?? b.vendor_eta_at ?? "",
        ),
      );
    const dates = new Map<string, WorkOrderRow[]>();
    for (const row of rows) {
      const date = (row.scheduled_for ?? row.vendor_eta_at ?? "").slice(0, 10);
      dates.set(date, [...(dates.get(date) ?? []), row]);
    }
    return dates;
  }, [workOrders.data]);

  const renderRow = (row: WorkOrderRow) => (
    <WorkOrderRowCard
      key={row.id}
      workOrder={row}
      requirements={reqMap.get(row.id) ?? []}
      propertyName={propertyNames.data?.get(row.property_id ?? "") ?? "Property unlinked"}
      propertyPhotoUrl={propertyPhotos.get(row.property_id ?? "") ?? null}
      ownerName={nameFor(row.assigned_to)}
      canEdit={!readOnly}
      onOpen={() => setOpenId(row.id)}
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work Orders"
        description="Today's queue — maintenance execution, ordered by what is still unresolved. Work Orders start on the ticket where the issue was reported."
      />

      <SegmentedControl
        ariaLabel="Work order view"
        value={view}
        onChange={(value) =>
          void navigate({
            search: { ...search, view: value === "scheduled" ? "scheduled" : undefined },
            replace: true,
          })
        }
        options={[
          { value: "action", label: "Action list" },
          { value: "scheduled", label: "Scheduled work" },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Needs action"
          value={buckets.get("needs_action")?.length ?? 0}
          tone="critical"
        />
        <StatTile label="Waiting on owner" value={buckets.get("waiting_owner")?.length ?? 0} />
        <StatTile label="Open Work Orders" value={open.length} />
        <StatTile label="Committed spend, open" value={money(committed)} />
      </div>

      {workOrders.isError ? (
        <EmptyState
          title="Work Orders could not be loaded"
          hint="Try again before relying on this schedule."
          action={<Button onClick={() => void workOrders.refetch()}>Try again</Button>}
        />
      ) : workOrders.isLoading ? (
        <LoadingRows />
      ) : open.length === 0 && (buckets.get("closed")?.length ?? 0) === 0 ? (
        <EmptyState
          title="No Work Orders open"
          hint="Create one from the ticket where the maintenance issue was reported."
        />
      ) : view === "scheduled" ? (
        scheduled.size === 0 ? (
          <EmptyState
            title="No Work Orders scheduled"
            hint="Set a schedule or vendor arrival time on an open Work Order to see it here."
          />
        ) : (
          [...scheduled.entries()].map(([date, rows]) => (
            <SectionCard
              key={date}
              title={usDate(date)}
              description={`${rows.length} Work Order${rows.length === 1 ? "" : "s"}`}
            >
              <div className="space-y-2">{rows.map(renderRow)}</div>
            </SectionCard>
          ))
        )
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
              <div className="space-y-2">{rows.map(renderRow)}</div>
            </SectionCard>
          );
        })
      )}

      <WorkOrderDrawer
        key={openWorkOrder?.id ?? "none"}
        workOrder={openWorkOrder}
        people={people}
        canEdit={!readOnly}
        propertyName={
          openWorkOrder
            ? (propertyNames.data?.get(openWorkOrder.property_id ?? "") ?? "Property unlinked")
            : ""
        }
        propertyPhotoUrl={
          openWorkOrder ? (propertyPhotos.get(openWorkOrder.property_id ?? "") ?? null) : null
        }
        originToken={originToken}
        onClose={() => setOpenId(null)}
      />

      <p className="text-xs text-muted-foreground">{MAINTENANCE_POLICY_VERSION}</p>
    </div>
  );
}
