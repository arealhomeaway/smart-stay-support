/**
 * Server functions for the Breezeway Work Order mirror.
 *
 * Every one runs as the signed-in user and re-checks Resolve staff status.
 * Homeowners and vendors can never reach these; the UI gate is cosmetic.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertStaff(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can work with Breezeway work orders.");
}

function uuid(value: unknown, label = "record") {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

/** Mirrored work orders for one property, optionally refreshed from Breezeway first. */
export const propertyWorkOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string; refresh?: boolean }) => ({
    propertyId: uuid(input?.propertyId, "property"),
    refresh: Boolean(input?.refresh),
  }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const mod = await import("@/lib/breezeway-workorders.server");
    let notice: string | null = null;
    if (data.refresh) {
      const res = await mod.syncPropertyWorkOrders(data.propertyId);
      if (!res.ok) notice = res.message ?? "Could not refresh from Breezeway.";
    }
    const { propertyWriteEligibility } = await import("@/lib/breezeway-mapping.server");
    const gate = await propertyWriteEligibility(data.propertyId);
    return {
      workOrders: await mod.listPropertyWorkOrders(data.propertyId),
      writable: gate.eligible,
      mappingState: gate.state,
      notice,
    };
  });

/** Comment thread for one work order, pulled fresh from Breezeway. */
export const workOrderComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; refresh?: boolean }) => ({
    workOrderId: uuid(input?.workOrderId, "work order"),
    refresh: input?.refresh !== false,
  }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const mod = await import("@/lib/breezeway-workorders.server");
    let notice: string | null = null;
    if (data.refresh) {
      const res = await mod.syncWorkOrderComments(data.workOrderId);
      if (!res.ok) notice = res.message ?? "Could not load the newest comments.";
    }
    return { comments: await mod.listWorkOrderComments(data.workOrderId), notice };
  });

export const replyToWorkOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; body: string }) => ({
    workOrderId: uuid(input?.workOrderId, "work order"),
    body: String(input?.body ?? "").trim().slice(0, 4000),
  }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { replyToWorkOrder } = await import("@/lib/breezeway-workorders.server");
    return replyToWorkOrder(
      data.workOrderId,
      data.body,
      (profile as { full_name: string | null } | null)?.full_name ?? "ARHA",
      context.userId,
    );
  });

/** close / reopen / approve / acknowledge on the Breezeway work order only. */
export const workOrderLifecycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { workOrderId: string; action: string }) => {
    const action = String(input?.action ?? "");
    if (!["close", "reopen", "approve", "acknowledge"].includes(action)) {
      throw new Error("Unknown work order action.");
    }
    return { workOrderId: uuid(input?.workOrderId, "work order"), action };
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const mod = await import("@/lib/breezeway-workorders.server");
    switch (data.action) {
      case "close":
        return mod.closeWorkOrder(data.workOrderId);
      case "reopen":
        return mod.reopenWorkOrder(data.workOrderId);
      case "approve":
        return mod.approveWorkOrder(data.workOrderId);
      default:
        return mod.acknowledgeWorkOrder(data.workOrderId);
    }
  });

export const updateWorkOrderFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      workOrderId: string;
      name?: string;
      description?: string;
      priority?: string;
      scheduledDate?: string | null;
    }) => ({
      workOrderId: uuid(input?.workOrderId, "work order"),
      name: input?.name ? String(input.name).slice(0, 200) : undefined,
      description: input?.description ? String(input.description).slice(0, 4000) : undefined,
      priority: input?.priority ? String(input.priority).slice(0, 40) : undefined,
      scheduledDate: input?.scheduledDate ? String(input.scheduledDate).slice(0, 10) : undefined,
    }),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { updateWorkOrder } = await import("@/lib/breezeway-workorders.server");
    const { workOrderId, ...rest } = data;
    // exactOptionalPropertyTypes: drop the keys the caller did not send.
    const patch = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
    return updateWorkOrder(workOrderId, patch);
  });
