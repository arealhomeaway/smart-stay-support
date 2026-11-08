/**
 * Direct Bookings email (server-only). Replies go out from the one authorised
 * mailbox, inside the partner's original thread when there is one, after the
 * shared email safety check. When the mailbox is not connected the caller
 * gets "not_connected" and the screen offers Copy reply and "I sent it".
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mailboxGraph, mailboxReadEnabled } from "./mailbox.server";
import { mailboxMessagesPath, mailboxRoot } from "./mailbox-allowlist.server";
import { verifyEmailSafety } from "./email-safety.server";

export type OutgoingReply = { to: string; cc: string[]; subject: string; body: string };
export type SendOutcome = { sent: true } | { sent: false; reason: "not_connected" | "blocked" | "failed"; detail: string };

const recipients = (list: string[]) =>
  list.map((a) => a.trim()).filter(Boolean).map((address) => ({ emailAddress: { address } }));

function htmlBody(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,sans-serif;font-size:14px">${esc.replace(/\n/g, "<br>")}</div>`;
}

export async function sendDirectBookingEmail(
  db: SupabaseClient,
  input: OutgoingReply & { leadId: string; threadMessageId: string | null; isDemo: boolean; sentBy: string },
): Promise<SendOutcome> {
  if (!mailboxReadEnabled()) return { sent: false, reason: "not_connected", detail: "The team mailbox is not connected." };
  // The database guard has no "lead" record type, so naming one would refuse
  // every send. The demo check runs here from the saved lead (isDemo, read by
  // the caller, which refuses when the lead is missing); the database guard
  // still checks every recipient and the sender.
  const blocked = await verifyEmailSafety(
    { to: input.to, cc: input.cc, isDemo: input.isDemo, entity: null, sentBy: input.sentBy },
    db,
  );
  if (blocked) return { sent: false, reason: "blocked", detail: blocked };
  try {
    const message = {
      subject: input.subject,
      toRecipients: recipients([input.to]),
      ccRecipients: recipients(input.cc),
      body: { contentType: "HTML", content: htmlBody(input.body) },
    };
    if (input.threadMessageId) {
      // Same thread: create the reply draft, fill it, then send it.
      const draft = await mailboxGraph(mailboxMessagesPath(`/${encodeURIComponent(input.threadMessageId)}/createReply`), {
        method: "POST",
        body: JSON.stringify({}),
      });
      const { id } = (await draft.json()) as { id: string };
      await mailboxGraph(mailboxMessagesPath(`/${encodeURIComponent(id)}`), { method: "PATCH", body: JSON.stringify(message) });
      await mailboxGraph(mailboxMessagesPath(`/${encodeURIComponent(id)}/send`), { method: "POST", body: "{}" });
    } else {
      await mailboxGraph(`${mailboxRoot()}/sendMail`, { method: "POST", body: JSON.stringify({ message, saveToSentItems: true }) });
    }
    return { sent: true };
  } catch (error) {
    console.error("Direct booking email failed:", error instanceof Error ? error.message : error);
    return { sent: false, reason: "failed", detail: "The email did not send." };
  }
}
