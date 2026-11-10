/**
 * The Operations Supervisor's spending decision on a Work Order, as one shared
 * set of writes. Moved out of WorkOrderDrawer unchanged so Home's Needs you now
 * side panel records the decision exactly the same way (same rows, same order,
 * same history line). Who may decide is still checked by the caller with
 * my_spending_approval_authority, as before.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SupervisorDecisionWorkOrder = {
  id: string;
  supervisor_approval_id?: string | null;
  is_demo?: boolean | null;
};

export async function recordWorkOrderSupervisorDecision(
  supabase: SupabaseClient<Database>,
  input: { workOrder: SupervisorDecisionWorkOrder; outcome: "approved" | "declined"; note: string; userId: string | null },
): Promise<void> {
  const { workOrder, outcome, note, userId } = input;
  const decidedAt = new Date().toISOString();
  if (workOrder.supervisor_approval_id) {
    const { error } = await supabase
      .from("approvals")
      .update({ status: outcome, decision_note: note, decided_at: decidedAt })
      .eq("id", workOrder.supervisor_approval_id as string);
    if (error) throw error;
  }
  const { error } = await supabase
    .from("work_orders")
    .update({
      supervisor_approval_status: outcome,
      supervisor_approval_note: note,
      supervisor_approval_decided_at: decidedAt,
    } as never)
    .eq("id", workOrder.id);
  if (error) throw error;

  await supabase.from("work_order_events").insert({
    work_order_id: workOrder.id,
    author_id: userId,
    event_type: `supervisor_${outcome}`,
    body: `Supervisor ${outcome} — ${note}`,
    is_demo: workOrder.is_demo,
  } as never);
}
