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

type Client = SupabaseClient<Database>;

const APP_URL = "https://smart-stay-support.lovable.app/owner";

function emailConfig() {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["OWNER_ALERT_FROM_EMAIL"];
  if (!key || !from) return null;
  return { key, from };
}

// Texting is handled by people, not an SMS provider. When an alert asks for a
// text we raise an internal "reach this homeowner" task instead.

async function sendEmail(to: string, subject: string, body: string) {
  const cfg = emailConfig();
  if (!cfg) return { status: "skipped" as const, error: "Email sending is not configured yet." };

  const html = `<div style="font-family:Helvetica,Arial,sans-serif;line-height:1.55;color:#1f2933">
    <h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>
    <p style="white-space:pre-wrap;margin:0 0 20px">${escapeHtml(body)}</p>
    <p><a href="${APP_URL}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open your owner portal</a></p>
    <p style="color:#6b7280;font-size:12px;margin-top:24px">A Real Home Away — Active Owner Participation Program</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: cfg.from, to: [to], subject, html }),
    });
    if (!res.ok) return { status: "failed" as const, error: `Email provider: ${res.status}` };
    return { status: "sent" as const, error: null };
  } catch (err) {
    return { status: "failed" as const, error: err instanceof Error ? err.message : "Email failed" };
  }
}

async function sendSms(to: string, body: string) {
  const cfg = smsConfig();
  if (!cfg) return { status: "skipped" as const, error: "Text messaging is not configured yet." };

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${cfg.sid}:${cfg.token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: cfg.from, Body: body.slice(0, 320) }),
    });
    if (!res.ok) return { status: "failed" as const, error: `Text provider: ${res.status}` };
    return { status: "sent" as const, error: null };
  } catch (err) {
    return { status: "failed" as const, error: err instanceof Error ? err.message : "Text failed" };
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

/** True when the channel has credentials in place. Surfaced to supervisors. */
export function channelStatus() {
  return { email: Boolean(emailConfig()), sms: Boolean(smsConfig()) };
}

/** Sends every alert still waiting on a channel. Safe to run on a schedule. */
export async function drainOwnerAlerts(supabase: Client, limit = 50) {
  const { data, error } = await supabase
    .from("owner_notifications")
    .select(
      "id, title, body, priority, sms_status, email_status, program_id, owner_programs(owner_email, owner_phone, owner_name)",
    )
    .or("email_status.eq.pending,sms_status.eq.pending")
    .order("created_at")
    .limit(limit);
  if (error) throw error;

  let emailed = 0;
  let texted = 0;
  const notes: string[] = [];

  for (const row of data ?? []) {
    const program = row.owner_programs as unknown as {
      owner_email: string | null;
      owner_phone: string | null;
      owner_name: string | null;
    } | null;

    const patch: Database["public"]["Tables"]["owner_notifications"]["Update"] = {};

    if (row.email_status === "pending") {
      if (!program?.owner_email) {
        patch.email_status = "skipped";
        patch.delivery_error = "No owner email on file.";
      } else {
        const result = await sendEmail(program.owner_email, row.title, row.body);
        patch.email_status = result.status;
        if (result.error) patch.delivery_error = result.error;
        if (result.status === "sent") emailed++;
        else if (result.error) notes.push(result.error);
      }
    }

    if (row.sms_status === "pending") {
      if (!program?.owner_phone) {
        patch.sms_status = "skipped";
      } else {
        const result = await sendSms(program.owner_phone, `${row.title}\n\n${row.body}\n\n${APP_URL}`);
        patch.sms_status = result.status;
        if (result.error) patch.delivery_error = result.error;
        if (result.status === "sent") texted++;
        else if (result.error) notes.push(result.error);
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
    texted,
    notes: Array.from(new Set(notes)).slice(0, 5),
  };
}
