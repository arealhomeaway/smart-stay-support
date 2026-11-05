import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyHelpBulk, HELP_STATUS_LABEL, type HelpBulkReceipt } from "./help-ticket-bulk";
import { submitterEmail } from "./help-ticket-response.functions";
import { sendEmail, emailShell } from "./email.server";
import { verifyEmailSafety } from "./email-safety.server";

export async function sendHelpBulkNotifications(receipt: HelpBulkReceipt, db: SupabaseClient, userId: string) {
  return notifyHelpBulk(receipt, {
    claim: async () => {
      const { data, error } = await db.rpc("claim_help_bulk_notifications" as never, { _batch_id: receipt.batchId } as never);
      if (error) throw new Error("Could not confirm notification permission.");
      return data === true;
    },
    recipient: submitterEmail,
    send: async (tickets, recipient) => {
      const first = tickets[0]; if (!first) return "failed";
      // A grouped message must pass safety for every included ticket, not only its first one.
      for (const ticket of tickets) {
        const blocked = await verifyEmailSafety({ to: recipient ?? "", entity: { type: "help_ticket", id: ticket.id }, sentBy: userId });
        if (blocked) return "skipped";
      }
      const label = receipt.status === "closed" ? "Closed" : HELP_STATUS_LABEL[receipt.status] ?? receipt.status;
      const subject = `Resolve Help tickets: ${tickets.length} set to ${label}`;
      const body = tickets.map((ticket) => `Help Ticket #${ticket.ticket_number}\nStatus: ${label}\nYour feedback: ${ticket.description}`).join("\n\n") + (receipt.note ? `\n\nNote from ARHA:\n${receipt.note}` : "");
      const result = await sendEmail({ to: recipient ?? "", subject, html: emailShell(subject, body), bodyText: body,
        purpose: "help_ticket_response", entity: { type: "help_ticket", id: first.id }, sentBy: userId, singleAttempt: true });
      return result.status;
    },
    record: async (eventIds, recipient, status) => {
      const { error } = await db.rpc("record_help_bulk_delivery" as never, { _batch_id: receipt.batchId, _event_ids: eventIds, _recipient: recipient, _status: status } as never);
      if (error) throw new Error("Could not record notification delivery. Check ticket history before retrying.");
    },
  });
}