import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { helpBulkSchema, type HelpBulkReceipt } from "./help-ticket-bulk";

export const bulkUpdateHelpTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => helpBulkSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: receipt, error } = await context.supabase.rpc("bulk_update_help_tickets" as never, {
      _batch_id: data.batchId, _tickets: data.tickets, _status: data.status, _note: data.note, _notify: data.notify,
    } as never);
    if (error) throw new Error(error.code === "PGRST202" ? "Bulk updates are not available yet. Nothing was changed." : error.message);
    const saved = receipt as unknown as HelpBulkReceipt;
    let delivery = { sent: 0, failed: 0 }; let deliveryUnconfirmed = false;
    if (saved.notify) {
      try {
        const { sendHelpBulkNotifications } = await import("./help-ticket-bulk.server");
        delivery = await sendHelpBulkNotifications(saved, context.supabase, context.userId);
      } catch (error) { console.error("Help ticket bulk notification could not finish", error); deliveryUnconfirmed = true; }
    }
    return { count: saved.count, status: saved.status, ...delivery, deliveryUnconfirmed };
  });