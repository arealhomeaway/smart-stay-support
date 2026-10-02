import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Push a Work Order to Breezeway — only after vendor acceptance and a current
 * authorization. One request key per Work Order, so retries never create a
 * second external task. Demo Work Orders are simulated and never reach Breezeway.
 */
export const pushWorkOrderToBreezeway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ workOrderId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    const { data: staff } = await sb.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("Only the internal team can hand work to Breezeway.");
    const { breezewayPushEligibility, vendorChannels } = await import("./vendor-sourcing");

    const { data: wo, error } = await sb.from("work_orders").select("*").eq("id", data.workOrderId).maybeSingle();
    if (error || !wo) throw new Error("Work Order not found.");
    if (wo.breezeway_handoff_status === "sent" || wo.breezeway_handoff_status === "simulated") {
      return { status: wo.breezeway_handoff_status, ref: wo.breezeway_task_ref, message: "Already handed off — no second task created." };
    }
    if (wo.breezeway_handoff_status === "uncertain") {
      return { status: "uncertain", ref: wo.breezeway_task_ref, message: "The last attempt is uncertain. Check Breezeway before retrying." };
    }
    const { data: accepted } = await sb.from("work_order_vendor_candidates")
      .select("vendor_org_id, vendor_orgs:vendor_org_id (dispatch_method, breezeway_person_id, uses_telegram)")
      .eq("work_order_id", wo.id).eq("status", "accepted").maybeSingle();
    const vendor = (accepted as unknown as { vendor_orgs: Parameters<typeof vendorChannels>[0] } | null)?.vendor_orgs ?? null;
    const elig = breezewayPushEligibility({
      wo, hasAcceptedVendor: !!accepted, vendorUsesBreezeway: vendorChannels(vendor).breezeway, handoffStatus: wo.breezeway_handoff_status,
    });
    if (!elig.allowed) throw new Error(elig.reasons.join(" "));

    const requestKey = `work_order:${wo.id}`;
    const now = new Date().toISOString();
    if (wo.is_demo) {
      const ref = `DEMO-${wo.id.slice(0, 8)}`;
      const { error: e } = await sb.from("work_orders").update({
        breezeway_handoff_status: "simulated", breezeway_request_key: requestKey, breezeway_task_ref: ref,
        breezeway_handoff_at: now, breezeway_handoff_error: null,
      }).eq("id", wo.id);
      if (e) throw new Error(e.message);
      return { status: "simulated", ref, message: "Demo handoff simulated. Nothing was sent to Breezeway." };
    }

    if (!wo.ticket_id) throw new Error("This Work Order has no Ticket to hand off.");
    const { createOutboundTask } = await import("./breezeway-outbound.server");
    const res = await createOutboundTask({
      sourceType: "ticket", sourceId: wo.ticket_id, requestKey,
      title: wo.title ?? "Work Order", description: wo.scope ?? null, department: "maintenance",
      priority: wo.priority ?? null, scheduledDate: null, scheduledTime: null,
    }, context.userId);
    const ref = res.link?.breezewayTaskId != null ? String(res.link.breezewayTaskId) : null;
    const status = res.ok ? "sent" : res.link ? "uncertain" : "failed";
    await sb.from("work_orders").update({
      breezeway_handoff_status: status, breezeway_request_key: requestKey,
      ...(ref && !wo.breezeway_task_ref ? { breezeway_task_ref: ref } : {}),
      breezeway_handoff_at: now, breezeway_handoff_error: res.ok ? null : res.message,
    }).eq("id", wo.id);
    return { status, ref, message: res.ok ? "Sent to Breezeway." : res.message };
  });
