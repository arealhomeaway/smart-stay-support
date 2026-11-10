/**
 * Server functions for the Breezeway bridge (register T15, C4, C5, C6).
 * Every one runs as the signed-in user; the database functions decide Admin access.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Loose = { rpc: (f: string, a?: unknown) => Promise<{ data: unknown; error: { message: string } | null }> };

function uuid(value: unknown, label: string) {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

async function assertStaff(supabase: unknown, userId: string) {
  const { data, error } = await (supabase as Loose).rpc("is_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can link Breezeway work orders.");
}

export type BridgeStatus = {
  enabled: boolean;
  start_line: string | null;
  sweep_found: boolean;
  sweep_active: boolean;
  last_switch: { status: string; at: string | null; by: string | null } | null;
  last_processed_at: string | null;
  tickets_created: number;
  reviews_created: number;
  skipped: number;
  skipped_by_reason: Record<string, number>;
  bridge_failed: number;
  other_homes_since_start: number;
  failed_lookups: number;
  mirror_failures: number;
  second_escalations: number;
  recent: {
    created_at: string;
    kind: string;
    outcome: string;
    reason: string;
    breezeway_task_id: number;
    breezeway_home_id: string | null;
    ticket_id: string | null;
    routine_id: string | null;
    home: string | null;
  }[];
  recent_failures: {
    created_at: string;
    operation: string;
    status: string;
    external_id: string | null;
    error_message: string | null;
  }[];
};

/** Admin only (checked in the database): the bridge's true state. */
export const breezewayBridgeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as unknown as Loose).rpc("breezeway_bridge_status");
    if (error) throw new Error(error.message);
    return data as BridgeStatus;
  });

/**
 * The one way to turn the bridge on or off (Admin only). On moves the start line forward to
 * that moment and starts the safety sweep in the same database step; off stops both.
 */
export const setBreezewayBridge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => ({ enabled: input?.enabled === true }))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await (context.supabase as unknown as Loose).rpc(
      "set_breezeway_bridge",
      { _enabled: data.enabled },
    );
    if (error) throw new Error(error.message);
    return result as { enabled: boolean; changed: boolean; start_line: string | null; sweep: boolean };
  });

/** The ticket's linked Breezeway work orders and the home's others to pick from (mirror only). */
export const ticketBreezewayOrdersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string }) => ({ ticketId: uuid(input?.ticketId, "ticket") }))
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { ticketBreezewayOrders } = await import("./breezeway-bridge.server");
    return ticketBreezewayOrders(context.supabase, data.ticketId);
  });

/** Links a Breezeway work order to the ticket: picked from the home's list, or by its number. */
export const linkTicketBreezewayOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; workOrderId?: string | null; taskNumber?: string | number | null }) => {
    const ticketId = uuid(input?.ticketId, "ticket");
    const workOrderId = input?.workOrderId ? uuid(input.workOrderId, "work order") : null;
    const digits = String(input?.taskNumber ?? "").replace(/[^0-9]/g, "");
    const taskNumber = digits && digits.length <= 12 ? Number(digits) : null;
    if (!workOrderId && !taskNumber) throw new Error("Pick a Breezeway work order or paste its number.");
    return { ticketId, workOrderId, taskNumber };
  })
  .handler(async ({ context, data }) => {
    await assertStaff(context.supabase, context.userId);
    const { linkTicketBreezewayOrder } = await import("./breezeway-bridge.server");
    return linkTicketBreezewayOrder(context.supabase, context.userId, data);
  });
