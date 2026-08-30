/**
 * Outbound email (server-only).
 *
 * Every message is sent from the one authorised mailbox
 * (EMAIL_SOURCE_MAILBOX) through the Lovable connector gateway, so no mail
 * credentials ever live in the app. The sending mailbox and the From/Sender
 * address are fixed server-side: they can never be supplied by the browser, a
 * ticket, a profile row or an API request, and no individual employee mailbox
 * is ever used. There is no /me/sendMail path and no fallback mailbox.
 *
 * Every attempt is written to `email_log` so a failed owner alert is visible
 * instead of silent, and throttles/outages are retried with backoff.
 */

import { authorizedMailbox, sendMailPath } from "./mailbox-allowlist.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

/** The single authorised mailbox everything sends from. Replies land in the team inbox. */
export const SHARED_MAILBOX = authorizedMailbox();


const BRAND = {
  ink: "#20282B",
  teal: "#13747A",
  accent: "#03A7B2",
  ivory: "#F7F5F0",
  muted: "#6B7280",
  logo: "https://smart-stay-support.lovable.app/__l5e/assets-v1/17169db2-e619-4906-bd3d-b31447c9855c/arha-resolve-logo.png",
};

function mailConfig() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["MICROSOFT_OUTLOOK_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

/** True when the Microsoft mailbox is connected and able to send. */
export function emailEnabled() {
  return Boolean(mailConfig());
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
export function isEmailAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

export type Audience = "staff" | "owner" | "vendor";

const FOOTER: Record<Audience, string> = {
  staff: "You're receiving this because you're on the A Real Home Away operations team in Resolve.",
  owner: "You're receiving this as a homeowner working with A Real Home Away. Reply to this email and a coordinator will pick it up.",
  vendor: "You're receiving this as an A Real Home Away service partner. Reply to this email to reach the coordinator on duty.",
};

/** Wraps plain text in the ARHA email shell. */
export function emailShell(
  heading: string,
  body: string,
  action?: { label: string; url: string },
  audience: Audience = "staff",
) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND.ivory}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.ivory};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid rgba(32,40,43,0.08)">
        <tr><td style="background:${BRAND.ink};padding:18px 24px">
          <img src="${BRAND.logo}" alt="A Real Home Away" height="28" style="height:28px;display:block;border:0" />
        </td></tr>
        <tr><td style="padding:24px;font-family:Calibri,Carlito,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:${BRAND.ink}">
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:${BRAND.teal}">${escapeHtml(heading)}</h1>
          <div style="white-space:pre-wrap;margin:0 0 20px">${escapeHtml(body)}</div>
          ${
            action
              ? `<p style="margin:0 0 8px"><a href="${action.url}" style="background:${BRAND.teal};color:#ffffff;padding:11px 20px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">${escapeHtml(
                  action.label,
                )}</a></p>`
              : ""
          }
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid rgba(32,40,43,0.08);font-family:Calibri,Carlito,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted}">
          <strong style="color:${BRAND.ink}">A Real Home Away</strong><br/>
          ${escapeHtml(FOOTER[audience])}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Plain-text alternative built from the same content. Improves inbox placement. */
export function emailText(heading: string, body: string, action?: { label: string; url: string }) {
  return [heading, "", body, action ? `\n${action.label}: ${action.url}` : "", "", "— A Real Home Away"]
    .filter((line) => line !== null)
    .join("\n");
}

export type SendEmailResult =
  | { status: "sent"; error: null }
  | { status: "skipped" | "failed"; error: string };

type SendInput = {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  replyTo?: string;
  /** What this message is for — shows in the delivery log. */
  purpose?: string;
  ticketId?: string | null;
};

const MAX_ATTEMPTS = 3;
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function logDelivery(entry: {
  recipient: string;
  subject: string;
  purpose: string;
  replyTo: string | null;
  ticketId: string | null;
  status: string;
  attempts: number;
  error: string | null;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("email_log").insert({
      recipient: entry.recipient,
      subject: entry.subject.slice(0, 300),
      purpose: entry.purpose,
      sender: SHARED_MAILBOX,
      reply_to: entry.replyTo,
      ticket_id: entry.ticketId,
      status: entry.status,
      attempts: entry.attempts,
      error_message: entry.error ? entry.error.slice(0, 500) : null,
      sent_at: entry.status === "sent" ? new Date().toISOString() : null,
    });
  } catch (err) {
    console.error("Could not write to email_log:", err);
  }
}

/**
 * Sends one message from the shared mailbox. Never throws.
 * Retries throttles and provider outages with backoff, then records the outcome.
 */
export async function sendEmail(input: SendInput): Promise<SendEmailResult> {
  const purpose = input.purpose ?? "general";
  const to = input.to?.trim() ?? "";

  if (!isEmailAddress(to)) {
    const error = "That is not a valid email address.";
    await logDelivery({
      recipient: to || "(missing)",
      subject: input.subject,
      purpose,
      replyTo: input.replyTo ?? null,
      ticketId: input.ticketId ?? null,
      status: "skipped",
      attempts: 0,
      error,
    });
    return { status: "skipped", error };
  }

  const cfg = mailConfig();
  if (!cfg) {
    const error = "The Microsoft mailbox is not connected yet.";
    await logDelivery({
      recipient: to,
      subject: input.subject,
      purpose,
      replyTo: input.replyTo ?? null,
      ticketId: input.ticketId ?? null,
      status: "skipped",
      attempts: 0,
      error,
    });
    return { status: "skipped", error };
  }

  // Replies always come back to the shared inbox, even when a matter is owned
  // by an individual coordinator. Their name may appear in the signature; the
  // address never changes.
  if (isEmailAddress(input.replyTo) && input.replyTo.trim().toLowerCase() !== SHARED_MAILBOX) {
    console.warn(`Ignoring requested reply-to ${input.replyTo.trim()} — replies are pinned to ${SHARED_MAILBOX}.`);
  }
  const replyTo = SHARED_MAILBOX;
  const message = {
    subject: input.subject,
    body: { contentType: "HTML", content: input.html },
    toRecipients: [{ emailAddress: { address: to } }],
    ...(input.cc?.filter(isEmailAddress).length
      ? { ccRecipients: input.cc.filter(isEmailAddress).map((address) => ({ emailAddress: { address } })) }
      : {}),
    // From and Sender are fixed server-side and are not caller-supplied.
    from: { emailAddress: { address: SHARED_MAILBOX } },
    sender: { emailAddress: { address: SHARED_MAILBOX } },
    replyTo: [{ emailAddress: { address: replyTo } }],
  };

  let attempts = 0;
  let lastError = "Email failed";
  // The allowlist builds this path. There is no fallback mailbox and no /me.
  let path: string;
  try {
    path = sendMailPath();
  } catch (err) {
    const error = err instanceof Error ? err.message : "unauthorized mailbox request";
    await logDelivery({
      recipient: to,
      subject: input.subject,
      purpose,
      replyTo: SHARED_MAILBOX,
      ticketId: input.ticketId ?? null,
      status: "blocked",
      attempts: 0,
      error,
    });
    return { status: "failed", error };
  }

  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      const res = await fetch(`${GATEWAY_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.lovableKey}`,
          "X-Connection-Api-Key": cfg.connectionKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, saveToSentItems: true }),
      });


      if (res.ok) {
        await logDelivery({
          recipient: to,
          subject: input.subject,
          purpose,
          replyTo,
          ticketId: input.ticketId ?? null,
          status: "sent",
          attempts,
          error: null,
        });
        return { status: "sent", error: null };
      }

      const detail = await res.text();
      console.error(`Outlook sendMail failed [${res.status}] ${path}: ${detail}`);
      lastError = `Mail provider [${res.status}]: ${detail.slice(0, 300)}`;

      if (!RETRYABLE.has(res.status) || attempts >= MAX_ATTEMPTS) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** (attempts - 1));



    } catch (err) {
      lastError = err instanceof Error ? err.message : "Email failed";
      if (attempts >= MAX_ATTEMPTS) break;
      await sleep(500 * 2 ** (attempts - 1));
    }
  }

  await logDelivery({
    recipient: to,
    subject: input.subject,
    purpose,
    replyTo,
    ticketId: input.ticketId ?? null,
    status: "failed",
    attempts,
    error: lastError,
  });
  return { status: "failed", error: lastError };
}
