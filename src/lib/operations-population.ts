import type { WorkOrderRow } from "@/lib/work-order-types";
import type { TeamQueueTicket } from "@/lib/team-queue";

export type OperationsProperty = {
  id: string;
  name: string;
  nickname: string | null;
  market: string | null;
  city: string | null;
  state: string | null;
};

export type StandaloneOperationsOrder = TeamQueueTicket & {
  kind: "work_order";
  id: string;
  ref: null;
  title: string;
  properties: OperationsProperty;
  workOrder: WorkOrderRow;
  reported_at: string;
  next_action_due_at: string | null;
  assigned_to: string | null;
  vendor_name: string | null;
  work_type_id: string | null;
  dispatchState: string | null;
  dispatchSyncedAt: string | null;
};

/** A linked Work Order belongs to its active Ticket; an unfinished order with no active Ticket remains visible. */
export function standaloneOperationsOrders(
  orders: WorkOrderRow[],
  properties: OperationsProperty[],
  dispatches: { work_order_id: string | null; status: string; last_synced_at?: string | null }[],
  activeTicketIds: ReadonlySet<string> = new Set(),
): StandaloneOperationsOrder[] {
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const dispatchByOrder = new Map(dispatches.filter((row) => row.work_order_id).map((row) => [row.work_order_id, row]));
  return orders.filter((order) =>
    order.property_id && propertyById.has(order.property_id) &&
    (!order.ticket_id || (!order.closed_at && !activeTicketIds.has(order.ticket_id))),
  )
    .map((order) => ({
      kind: "work_order" as const,
      id: order.id,
      ref: null,
      title: order.title,
      description: order.scope,
      priority: order.priority,
      status: order.closed_at ? "closed" : order.scheduled_for ? "waiting" : "in_progress",
      property_id: order.property_id,
      properties: propertyById.get(order.property_id!)!,
      work_type_id: order.service_category,
      work_types: order.service_category ? { name: order.service_category } : null,
      reported_at: order.created_at,
      next_action_due_at: order.vendor_eta_at ?? order.scheduled_for,
      next_review_at: order.vendor_eta_at ?? order.scheduled_for,
      waiting_on: order.scheduled_for ? "vendor" : null,
      assigned_to: order.assigned_to,
      action_started_at: order.vendor_contacted_at,
      vendor_name: order.vendor_name,
      vendor_status: null,
      workOrder: order,
      dispatchState: dispatchByOrder.get(order.id)?.status ?? null,
      dispatchSyncedAt: dispatchByOrder.get(order.id)?.last_synced_at ?? null,
    }));
}
