/**
 * The field work booked for a home during onboarding, in one list.
 *
 * Two places hold it today: jobs pushed to Breezeway (our dispatch system for
 * the crews who work there) and jobs tracked in Resolve for vendors who are
 * not in Breezeway. Onboarding needs to see both, and to see at a glance which
 * is which — that is the whole point of this shaping.
 *
 * Pure: no database, no clock beyond what the caller passes in.
 */

export type WorkOrderRoute = "breezeway" | "vendor";

export type OnboardingWorkOrder = {
  id: string;
  route: WorkOrderRoute;
  /** Plain-language label of where this job is tracked. */
  routeLabel: string;
  title: string;
  status: string;
  statusLabel: string;
  who: string | null;
  scheduledFor: string | null;
  /** The onboarding step this job came from, when we know it. */
  fromStepId: string | null;
  /** True when the job is finished and needs no more attention. */
  done: boolean;
  createdAt: string;
};

export type BreezewayRow = {
  id: string;
  title: string | null;
  status: string | null;
  scheduled_date: string | null;
  assignee_names: string[] | null;
  onboarding_task_id: string | null;
  created_at: string;
};

export type VendorRow = {
  id: string;
  title: string;
  phase: string | null;
  vendor_name: string | null;
  scheduled_for: string | null;
  closed_at: string | null;
  created_at: string;
};

const BREEZEWAY_DONE = new Set(["completed", "complete", "finished", "closed"]);

function breezewayStatusLabel(status: string | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "queued":
      return "Waiting to send";
    case "sent":
    case "synced":
      return "Sent to Breezeway";
    case "in_progress":
      return "Crew working";
    case "completed":
    case "complete":
      return "Finished";
    case "failed":
      return "Did not send";
    default:
      return status ? status.replace(/_/g, " ") : "Unknown";
  }
}

function vendorStatusLabel(row: VendorRow): string {
  if (row.closed_at) return "Finished";
  switch ((row.phase ?? "").toLowerCase()) {
    case "intake":
      return "Being set up";
    case "quote":
      return "Waiting on a quote";
    case "approval":
      return "Waiting on approval";
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "Vendor working";
    default:
      return row.phase ? row.phase.replace(/_/g, " ") : "Open";
  }
}

export function shapeBreezewayOrder(row: BreezewayRow): OnboardingWorkOrder {
  const status = (row.status ?? "").toLowerCase();
  return {
    id: row.id,
    route: "breezeway",
    routeLabel: "Breezeway",
    title: row.title ?? "Untitled job",
    status,
    statusLabel: breezewayStatusLabel(row.status),
    who: (row.assignee_names ?? []).join(", ") || null,
    scheduledFor: row.scheduled_date,
    fromStepId: row.onboarding_task_id,
    done: BREEZEWAY_DONE.has(status),
    createdAt: row.created_at,
  };
}

export function shapeVendorOrder(row: VendorRow): OnboardingWorkOrder {
  return {
    id: row.id,
    route: "vendor",
    routeLabel: "Vendor (tracked here)",
    title: row.title,
    status: row.closed_at ? "closed" : (row.phase ?? "open"),
    statusLabel: vendorStatusLabel(row),
    who: row.vendor_name,
    scheduledFor: row.scheduled_for,
    fromStepId: null,
    done: Boolean(row.closed_at),
    createdAt: row.created_at,
  };
}

/** Newest first, with anything still open ahead of anything finished. */
export function mergeWorkOrders(
  breezeway: BreezewayRow[],
  vendor: VendorRow[],
): OnboardingWorkOrder[] {
  return [...breezeway.map(shapeBreezewayOrder), ...vendor.map(shapeVendorOrder)].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export function workOrderCounts(orders: OnboardingWorkOrder[]) {
  return {
    total: orders.length,
    breezeway: orders.filter((o) => o.route === "breezeway").length,
    vendor: orders.filter((o) => o.route === "vendor").length,
    open: orders.filter((o) => !o.done).length,
  };
}
