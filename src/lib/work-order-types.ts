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
