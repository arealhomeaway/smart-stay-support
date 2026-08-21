/**
 * Outbound email (server-only).
 *
 * Mail is sent from the connected ARHA Microsoft 365 mailbox through the
 * Lovable connector gateway, so no mail credentials ever live in the app.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

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

/** Wraps plain text in the ARHA email shell. */
export function emailShell(heading: string, body: string, action?: { label: string; url: string }) {
  return `<div style="font-family:Helvetica,Arial,sans-serif;line-height:1.55;color:#1f2933">
    <h2 style="margin:0 0 12px">${escapeHtml(heading)}</h2>
    <div style="white-space:pre-wrap;margin:0 0 20px">${escapeHtml(body)}</div>
    ${
      action
        ? `<p><a href="${action.url}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${escapeHtml(
            action.label,
          )}</a></p>`
        : ""
    }
    <p style="color:#6b7280;font-size:12px;margin-top:24px">A Real Home Away</p>
  </div>`;
}

export type SendEmailResult =
  | { status: "sent"; error: null }
  | { status: "skipped" | "failed"; error: string };

/** Sends one message from the connected mailbox. Never throws. */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  cc?: string[];
  replyTo?: string;
}): Promise<SendEmailResult> {
  const cfg = mailConfig();
  if (!cfg) return { status: "skipped", error: "The Microsoft mailbox is not connected yet." };

  try {
    const res = await fetch(`${GATEWAY_URL}/me/sendMail`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.lovableKey}`,
        "X-Connection-Api-Key": cfg.connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: "HTML", content: input.html },
          toRecipients: [{ emailAddress: { address: input.to } }],
          ...(input.cc?.length
            ? { ccRecipients: input.cc.map((address) => ({ emailAddress: { address } })) }
            : {}),
          ...(input.replyTo
            ? { replyTo: [{ emailAddress: { address: input.replyTo } }] }
            : {}),
        },
        saveToSentItems: true,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`Outlook sendMail failed [${res.status}]: ${detail}`);
      return { status: "failed", error: `Mail provider [${res.status}]: ${detail.slice(0, 300)}` };
    }
    return { status: "sent", error: null };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : "Email failed" };
  }
}
