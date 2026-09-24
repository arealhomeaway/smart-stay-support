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

const APP_ORIGIN = "https://smart-stay-support.lovable.app";
const APP_URL = `${APP_ORIGIN}/owner`;

/** Only owner-portal paths are ever linked; anything else falls back to the portal. */
function ownerLink(actionPath: string | null | undefined) {
  if (actionPath && actionPath.startsWith("/owner")) return `${APP_ORIGIN}${actionPath}`;
  return APP_URL;
}

/** The home a notification is about, read from its owner-portal link. */
function homeIdFrom(actionPath: string | null | undefined) {
  const m = actionPath?.match(/[?&]home=([0-9a-f-]{36})/i);
  return m ? m[1]! : null;
}

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
  context?: { url: string; propertyName: string | null; item: string | null },
) {
  const { sendEmail: send, emailShell } = await import("./email.server");
  const { refTag } = await import("./intake.server");
  const rendered = copy
    ? renderOwnerEmail(copy.copy, { title: subject, body, ownerName: copy.ownerName })
    : { subject, body, actionLabel: "Open your owner portal" };
  // Every property-related email names the item and the home in the subject.
  const parts = [rendered.subject];
  if (context?.item && !rendered.subject.includes(context.item)) parts.push(context.item);
  if (context?.propertyName && !parts.join(" ").includes(context.propertyName))
    parts.push(context.propertyName);
  const fullSubject = parts.join(" — ");
  const bodyText = context?.propertyName
    ? `Property: ${context.propertyName}\n\n${rendered.body}`
    : rendered.body;
  const actionLabel = context?.item && subject.toLowerCase().includes("opportunity")
    ? "View Opportunity"
    : rendered.actionLabel;
  // The tag lets an owner's reply land back on the ticket instead of an inbox.
  const taggedSubject = ticketRef ? `${fullSubject} ${refTag(ticketRef)}` : fullSubject;
  return send({
    to,
    subject: taggedSubject,
    html: emailShell(
      fullSubject,
      bodyText,
      { label: actionLabel, url: context?.url ?? APP_URL },
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

/**
 * Sends every alert still waiting on a channel. Safe to run on a schedule.
 * Pass `onlyId` to deliver one notification the moment it is created.
 */
export async function drainOwnerAlerts(supabase: Client, limit = 50, onlyId?: string) {
  let query = supabase
    .from("owner_notifications")
    .select(
      "id, kind, review_id, title, body, priority, ticket_id, sms_status, email_status, program_id, owner_user_id, is_demo, action_path, owner_programs(owner_email, owner_phone, owner_name)",
    )
    .or("email_status.eq.pending,sms_status.eq.pending");
  if (onlyId) query = query.eq("id", onlyId);
  const { data, error } = await query.order("created_at").limit(limit);
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
      // Claim the row first so one notification can only ever produce one email,
      // even when the instant dispatch and a scheduled pass overlap.
      const claim = await supabase
        .from("owner_notifications")
        .update({ email_status: "sending" })
        .eq("id", row.id)
        .eq("email_status", "pending")
        .select("id");
      const claimed = !claim.error && (claim.data ?? []).length === 1;

      // Non-ticket alerts go to the owner's own sign-in email; the program
      // contact is only a fallback for owners without an account email.
      let to = program?.owner_email ?? null;
      if (claimed && !row.ticket_id && row.owner_user_id) {
        const account = await supabase.auth.admin.getUserById(row.owner_user_id);
        const accountEmail = account.data?.user?.email ?? null;
        if (accountEmail) to = accountEmail;
      }

      if (!claimed) {
        // Another pass already owns this email.
        if (row.sms_status !== "pending") continue;
      } else if (!to) {
        patch.email_status = "skipped";
        patch.delivery_error = "No owner email on file.";
      } else {
        const homeId = homeIdFrom(row.action_path);
        let propertyName: string | null = null;
        if (homeId) {
          const { data: home } = await supabase
            .from("properties")
            .select("nickname, name, address_line1")
            .eq("id", homeId)
            .maybeSingle();
          propertyName = home?.nickname || home?.name || home?.address_line1 || null;
        }
        const segments = safeText.body.split(" · ");
        const item = segments.length === 2 && safeText.body.length <= 200 ? segments[0]!.trim() : null;
        try {
          const result = await sendEmail(
            to,
            safeText.title,
            safeText.body,
            ticketRef,
            row.ticket_id,
            {
              copy: copyConfig[ownerEmailVariantFor(row.kind)],
              ownerName: program?.owner_name ?? null,
            },
            { url: ownerLink(row.action_path), propertyName, item },
          );
          patch.email_status = result.status;
          if (result.error) patch.delivery_error = result.error;
          if (result.status === "sent") emailed++;
          else if (result.error) notes.push(result.error);
        } catch (err) {
          // Delivery never undoes the notification; the failure stays visible.
          patch.email_status = "failed";
          patch.delivery_error = err instanceof Error ? err.message : "Email delivery failed.";
          notes.push(patch.delivery_error);
        }
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
