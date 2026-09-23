/**
 * Delivery of owner alerts (server-only).
 *
 * The database trigger writes every alert into `owner_notifications` with the
 * channels it wants attempted. This drain turns those pending rows into an
 * email (all alerts) and a text message (P1 only). Channels that are not
 * configured yet are marked "skipped" with the reason, never retried forever.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { ownerNotificationText } from "./owner-notification";
import {
  ownerEmailVariantFor,
  renderOwnerEmail,
  type OwnerEmailCopy,
} from "./owner-email-copy";
import { ticketAlertRecipient } from "./owner-ticket-alert.server";

type Client = SupabaseClient<Database>;

const APP_URL = "https://smart-stay-support.lovable.app/owner";

// Texting is handled by people, not an SMS provider. When an alert asks for a
// text we raise an internal "reach this homeowner" task instead.

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  ticketRef?: number | null,
  ticketId?: string | null,
  // The wording wrapper the onboarding director controls. The facts stay ours.
  copy?: { copy: OwnerEmailCopy; ownerName: string | null } | null,
) {
  const { sendEmail: send, emailShell } = await import("./email.server");
  const { refTag } = await import("./intake.server");
  const rendered = copy
    ? renderOwnerEmail(copy.copy, { title: subject, body, ownerName: copy.ownerName })
    : { subject, body, actionLabel: "Open your owner portal" };
  // The tag lets an owner's reply land back on the ticket instead of an inbox.
  const taggedSubject = ticketRef ? `${rendered.subject} ${refTag(ticketRef)}` : rendered.subject;
  return send({
    to,
    subject: taggedSubject,
    html: emailShell(
      rendered.subject,
      rendered.body,
      { label: rendered.actionLabel, url: APP_URL },
      "owner",
    ),
    purpose: "owner_alert",
    ticketId: ticketId ?? null,
  });
}

/** True when the channel is live. Texting is a human task, never automated. */
export function channelStatus() {
  // Loaded lazily so this module stays import-light for callers that only read status.
  const configured = Boolean(
    process.env["LOVABLE_API_KEY"] && process.env["MICROSOFT_OUTLOOK_API_KEY"],
  );
  return { email: configured, sms: false as const };
}

/** Sends every alert still waiting on a channel. Safe to run on a schedule. */
export async function drainOwnerAlerts(supabase: Client, limit = 50) {
  const { data, error } = await supabase
    .from("owner_notifications")
    .select(
      "id, kind, review_id, title, body, priority, ticket_id, sms_status, email_status, program_id, owner_user_id, is_demo, owner_programs(owner_email, owner_phone, owner_name)",
    )
    .or("email_status.eq.pending,sms_status.eq.pending")
    .order("created_at")
    .limit(limit);
  if (error) throw error;

  // One read for the whole drain: the director's wording for every alert sent.
  const { loadOwnerEmailCopy } = await import("./owner-email-copy.server");
  const copyConfig = await loadOwnerEmailCopy(supabase);

  let emailed = 0;
  let escalated = 0;
  const notes: string[] = [];

  for (const row of data ?? []) {
    const safeText = ownerNotificationText(row);
    // Hard safety guard: demo notifications must never reach a real channel.
    if (row.is_demo) {
      await supabase
        .from("owner_notifications")
        .update({
          email_status: "skipped",
          sms_status: "skipped",
          delivery_error: "Demo notification — external delivery blocked.",
        })
        .eq("id", row.id);
      continue;
    }

    let program = row.owner_programs as unknown as {
      owner_email: string | null;
      owner_phone: string | null;
      owner_name: string | null;
    } | null;

    let ticketRef: number | null = null;
    if (row.ticket_id || row.kind.startsWith("ticket_")) {
      try {
        if (!row.ticket_id) throw new Error("Ticket alert source is missing.");
        const recipient = await ticketAlertRecipient(supabase, {
          ...row,
          ticket_id: row.ticket_id,
        });
        program = recipient;
        ticketRef = recipient.ticketRef;
      } catch {
        // Do not retry or route an old alert using free-text program contact snapshots.
        const blocked = await supabase
          .from("owner_notifications")
          .update({
            email_status: "skipped",
            sms_status: "skipped",
            delivery_error:
              "Ticket alert delivery blocked: canonical Owner, Property and enrollment must be verified by staff.",
          })
          .eq("id", row.id);
        if (blocked.error) throw blocked.error;
        notes.push("A Ticket alert requires canonical relationship review before delivery.");
        continue;
      }
    }

    const patch: Database["public"]["Tables"]["owner_notifications"]["Update"] = {};

    if (row.email_status === "pending") {
      if (!program?.owner_email) {
        patch.email_status = "skipped";
        patch.delivery_error = "No owner email on file.";
      } else {
        const result = await sendEmail(
          program.owner_email,
          safeText.title,
          safeText.body,
          ticketRef,
          row.ticket_id,
          {
            copy: copyConfig[ownerEmailVariantFor(row.kind)],
            ownerName: program.owner_name ?? null,
          },
        );
        patch.email_status = result.status;
        if (result.error) patch.delivery_error = result.error;
        if (result.status === "sent") emailed++;
        else if (result.error) notes.push(result.error);
      }
    }

    // A text request becomes an internal task: a teammate calls or texts the
    // homeowner personally. We never auto-send an SMS.
    if (row.sms_status === "pending") {
      const { error: alertError } = await supabase.from("owner_contact_alerts").insert({
        program_id: row.program_id,
        notification_id: row.id,
        ticket_id: row.ticket_id ?? null,
        priority: row.priority,
        owner_name: program?.owner_name ?? null,
        owner_phone: program?.owner_phone ?? null,
        owner_email: program?.owner_email ?? null,
        title: safeText.title,
        body: safeText.body,
        reason: program?.owner_phone
          ? "Urgent ticket at this owner's home — text or call them now."
          : "Urgent ticket at this owner's home, and we have no phone number on file — reach them by email and collect a number.",
      });
      if (alertError) {
        notes.push(alertError.message);
      } else {
        patch.sms_status = "escalated";
        escalated++;
      }
    }

    patch.delivered_at = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("owner_notifications")
      .update(patch)
      .eq("id", row.id);
    if (updateError) notes.push(updateError.message);
  }

  return {
    ok: true as const,
    considered: (data ?? []).length,
    emailed,
    escalated,
    notes: Array.from(new Set(notes)).slice(0, 5),
  };
}
