import type { Database } from "@/integrations/supabase/types";
import type { ApprovalStatus, WorkOrderPhase } from "@/lib/work-orders";

type RawWorkOrder = Database["public"]["Tables"]["work_orders"]["Row"];

/**
 * The database stores the maintenance vocabulary as constrained text, so the
 * generated row widens it to `string`. Narrowing here keeps every screen
 * honest about the closed sets.
 */
export type WorkOrderRow = Omit<RawWorkOrder, "phase" | "approval_status"> & {
  phase: WorkOrderPhase;
  approval_status: ApprovalStatus;
};

export type WorkOrderUpdate = Database["public"]["Tables"]["work_orders"]["Update"];
export type WorkOrderEventRow = Database["public"]["Tables"]["work_order_events"]["Row"];

/**
 * The one query key for a ticket's Work Orders — used by both
 * `useTicketWorkOrders()` (TicketWorkOrderPanel.tsx, and the Ticket
 * workspace's own stage derivation) and `WorkOrderDrawer`'s save mutation.
 * Both hand-typed the same `["work-orders-for-ticket", ticketId]` tuple
 * separately, which is exactly how a Ticket page once ended up reading a
 * cache the Work Order drawer never invalidated. Importing this function
 * instead of retyping the tuple makes that kind of drift impossible.
 */
export function ticketWorkOrdersQueryKey(ticketId: string | null | undefined) {
  return ["work-orders-for-ticket", ticketId] as const;
}
