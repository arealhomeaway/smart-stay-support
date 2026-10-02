import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Push a Work Order to Breezeway — only after vendor acceptance and a current
 * authorization. The uncertain intent is saved before the external call
 * (`runHandoffAttempt`), so a timeout never allows a second create.
 * Demo Work Orders are simulated and never reach Breezeway.
 */
export const pushWorkOrderToBreezeway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workOrderId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: staff } = await sb.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Only the internal team can hand work to Breezeway.");
    const { breezewayPushEligibility, vendorChannels, runHandoffAttempt } = await import("./vendor-sourcing");

    const { data: woRow, error } = await sb.from("work_orders").select("*").eq("id", data.workOrderId).maybeSingle();
    if (error || !woRow) throw new Error("Work Order not found.");
    const wo = woRow as typeof woRow & import("./vendor-sourcing").DispatchWorkOrder;
    if (wo.breezeway_handoff_status === "sent" || wo.breezeway_handoff_status === "simulated") {
      return { status: wo.breezeway_handoff_status, ref: wo.breezeway_task_ref, message: "Already handed off — no second task created." };
    }
    if (wo.breezeway_handoff_status === "uncertain") {
      return { status: "uncertain", ref: wo.breezeway_task_ref, message: "The last attempt is uncertain. Reconcile it with Breezeway before another create." };
    }
    const { data: accepted } = await sb.from("work_order_vendor_candidates")
      .select("vendor_org_id, vendor_orgs:vendor_org_id (dispatch_method, breezeway_person_id, telegram_status)")
      .eq("work_order_id", wo.id).eq("status", "accepted").maybeSingle();
    const vendor = (accepted as unknown as { vendor_orgs: Parameters<typeof vendorChannels>[0] } | null)?.vendor_orgs ?? null;
    const elig = breezewayPushEligibility({
      wo, hasAcceptedVendor: !!accepted, vendorUsesBreezeway: vendorChannels(vendor).breezeway,
      handoffStatus: wo.breezeway_handoff_status === "failed" ? "not_sent" : wo.breezeway_handoff_status,
    });
    if (!elig.allowed) throw new Error(elig.reasons.join(" "));

    const now = new Date().toISOString();
    if (wo.is_demo) {
      const ref = `DEMO-${wo.id.slice(0, 8)}`;
      const { error: e } = await sb.from("work_orders").update({
        breezeway_handoff_status: "simulated", breezeway_request_key: `work_order:${wo.id}`, breezeway_task_ref: ref,
        breezeway_handoff_at: now, breezeway_handoff_error: null,
      }).eq("id", wo.id);
      if (e) throw new Error(e.message);
      return { status: "simulated", ref, message: "Demo handoff simulated. Nothing was sent to Breezeway." };
    }

    if (!wo.ticket_id) throw new Error("This Work Order has no Ticket to hand off.");
    const ticketId = wo.ticket_id;
    const { createOutboundTask } = await import("./breezeway-outbound.server");
    const r = await runHandoffAttempt({
      workOrderId: wo.id, status: wo.breezeway_handoff_status, priorKey: wo.breezeway_request_key,
      save: async (patch) => {
        const { error: e } = await sb.from("work_orders").update({ ...patch, breezeway_handoff_at: now }).eq("id", wo.id);
        if (e) throw new Error(e.message);
      },
      create: (requestKey) => createOutboundTask({
        sourceType: "ticket", sourceId: ticketId, requestKey,
        title: wo.title ?? "Work Order", description: wo.scope ?? null, department: "maintenance",
        priority: wo.priority ?? null, scheduledDate: null, scheduledTime: null,
      }, context.userId),
    });
    return { status: r.status, ref: r.ref, message: r.message };
  });

/**
 * Reconcile an uncertain handoff. Either a Breezeway task id was found (→ sent)
 * or staff confirm, with a note of what they checked, that no task exists (→ failed,
 * a new create may start with a fresh request key). Re-reads the outbound record first.
 */
export const reconcileWorkOrderHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    workOrderId: z.string().uuid(),
    outcome: z.enum(["found", "not_created"]),
    taskRef: z.string().trim().max(40).optional(),
    note: z.string().trim().min(10).max(500),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: staff } = await sb.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Only the internal team can reconcile Breezeway handoffs.");
    const { data: wo } = await sb.from("work_orders").select("id, breezeway_handoff_status, breezeway_request_key, breezeway_task_ref").eq("id", data.workOrderId).maybeSingle();
    if (!wo) throw new Error("Work Order not found.");
    if (wo.breezeway_handoff_status !== "uncertain") throw new Error("This handoff is not uncertain.");
    if (data.outcome === "found") {
      const ref = data.taskRef || wo.breezeway_task_ref;
      if (!ref) throw new Error("Enter the Breezeway task ID you found.");
      const { error } = await sb.from("work_orders").update({ breezeway_handoff_status: "sent", breezeway_task_ref: wo.breezeway_task_ref ?? ref, breezeway_handoff_error: `Reconciled: ${data.note}` }).eq("id", wo.id);
      if (error) throw new Error(error.message);
      return { status: "sent" };
    }
    // The outbound record must not show a created task.
    if (wo.breezeway_request_key) {
      const { data: row } = await sb.from("breezeway_outbound_tasks").select("status, breezeway_task_id").eq("request_key", wo.breezeway_request_key).maybeSingle();
      if (row && (row.status === "created" || row.status === "synced" || row.breezeway_task_id != null)) {
        throw new Error("Resolve's record shows Breezeway created this task. Use “Task found” with its ID instead.");
      }
    }
    const { error } = await sb.from("work_orders").update({ breezeway_handoff_status: "failed", breezeway_handoff_error: `Reconciled — no task in Breezeway: ${data.note}` }).eq("id", wo.id);
    if (error) throw new Error(error.message);
    return { status: "failed" };
  });
