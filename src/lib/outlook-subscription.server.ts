/**
 * Microsoft Graph change notifications for the team inbox (server-only).
 *
 * Resolve asks Graph to tell it when a message in the one authorised Inbox is
 * created or updated — applying a category is an update — instead of polling
 * hard. Delegated subscriptions expire within about three days, so the
 * subscription is renewed on the same schedule that runs the reconciliation
 * sweep. The sweep stays as the safety net for anything a notification missed.
 *
 * The notification itself is never trusted for content: it carries an id, and
 * Resolve reads the message back through the allowlisted mailbox path.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { authorizedMailbox, mailboxRoot } from "./mailbox-allowlist.server";

type Db = SupabaseClient<Database>;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";
const SYSTEM = "outlook_subscription";
const OPERATION = "graph_subscription";
/** Delegated message subscriptions max out just under three days. */
const LIFETIME_MS = 4230 * 60 * 1000;
/** Renew when less than this is left, so a late cron run never drops coverage. */
const RENEW_WINDOW_MS = 12 * 60 * 60 * 1000;

function config() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["MICROSOFT_OUTLOOK_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

/** The shared secret Graph echoes back on every notification. */
export function clientState() {
  return process.env["LOVABLE_CRON_SECRET"] ?? "";
}

/** Where Graph should post notifications. */
export function notificationUrl() {
  const base = (process.env["PUBLIC_SITE_URL"] ?? "https://smart-stay-support.lovable.app").replace(/\/$/, "");
  return `${base}/api/public/hooks/outlook/messages`;
}

async function graph(path: string, init?: RequestInit) {
  const cfg = config();
  if (!cfg) throw new Error("The Microsoft mailbox is not connected.");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${cfg.lovableKey}`,
      "X-Connection-Api-Key": cfg.connectionKey,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Graph subscription [${res.status}]: ${detail.slice(0, 300)}`);
  }
  return res;
}

export type SubscriptionRecord = {
  id: string;
  external_id: string | null;
  status: string;
  next_attempt_at: string | null;
  error_message: string | null;
  request_payload?: { resource?: string; mailbox?: string; notificationUrl?: string } | null;
};

export async function currentSubscription(db: Db): Promise<SubscriptionRecord | null> {
  const { data } = await db
    .from("integration_events")
    .select("id, external_id, status, next_attempt_at, error_message")
    .eq("system", SYSTEM)
    .eq("operation", OPERATION)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0] as SubscriptionRecord | undefined) ?? null;
}

/** True when the notification carries our secret and nothing else. */
export function isTrustedNotification(state: string | null | undefined) {
  const expected = clientState();
  return Boolean(expected) && state === expected;
}

/**
 * Creates the subscription if there is none, renews it when it is close to
 * expiring, and records the result either way. Safe to call on every cron run.
 */
export async function ensureSubscription(db: Db): Promise<{ ok: boolean; action: string; expiresAt?: string | undefined; error?: string | undefined }> {
  if (!config()) return { ok: false, action: "skipped", error: "The Microsoft mailbox is not connected." };
  if (!clientState()) return { ok: false, action: "skipped", error: "No notification secret is configured." };

  const existing = await currentSubscription(db);
  const expiry = existing?.next_attempt_at ? new Date(existing.next_attempt_at).getTime() : 0;
  const expiresSoon = expiry - Date.now() < RENEW_WINDOW_MS;

  // A subscription created against the old Inbox-only resource must be
  // replaced, not renewed, or folder-routed mail stays invisible.
  const existingResource =
    ((existing as { request_payload?: { resource?: string } } | null)?.request_payload?.resource ?? "") || "";
  const wrongResource = Boolean(existing?.external_id) && existingResource !== `${mailboxRoot()}/messages`;

  if (existing?.external_id && existing.status === "active" && !expiresSoon && !wrongResource) {
    return { ok: true, action: "healthy", expiresAt: existing.next_attempt_at ?? undefined };
  }

  const expirationDateTime = new Date(Date.now() + LIFETIME_MS).toISOString();

  if (existing?.external_id && existing.status === "active" && !wrongResource) {
    try {
      await graph(`/subscriptions/${encodeURIComponent(existing.external_id)}`, {
        method: "PATCH",
        body: JSON.stringify({ expirationDateTime }),
      });
      await db
        .from("integration_events")
        .update({ next_attempt_at: expirationDateTime, error_message: null, resolved_at: new Date().toISOString() })
        .eq("id", existing.id);
      return { ok: true, action: "renewed", expiresAt: expirationDateTime };
    } catch (err) {
      // Renewal failed (usually because it already expired) — fall through and
      // create a fresh one rather than leaving the mailbox unwatched.
      console.error("Outlook subscription renewal failed:", err instanceof Error ? err.message : err);
      await db.from("integration_events").update({ status: "expired" }).eq("id", existing.id);
    }
  }

  try {
    const res = await graph(`/subscriptions`, {
      method: "POST",
      body: JSON.stringify({
        changeType: "created,updated",
        notificationUrl: notificationUrl(),
        // The whole mailbox, not one folder: Outlook rules move a message
        // into its owning team folder, and a category applied there must
        // still reach Resolve.
        resource: `${mailboxRoot()}/messages`,
        expirationDateTime,
        clientState: clientState(),
      }),
    });
    const body = (await res.json()) as { id?: string };
    await db.from("integration_events").insert({
      system: SYSTEM,
      direction: "inbound",
      operation: OPERATION,
      external_id: body.id ?? null,
      status: "active",
      next_attempt_at: expirationDateTime,
      resolved_at: new Date().toISOString(),
      request_payload: {
        mailbox: authorizedMailbox(),
        notificationUrl: notificationUrl(),
        resource: `${mailboxRoot()}/messages`,
      },
    });
    return { ok: true, action: "created", expiresAt: expirationDateTime };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create the subscription.";
    await db.from("integration_events").insert({
      system: SYSTEM,
      direction: "inbound",
      operation: OPERATION,
      status: "failed",
      error_message: message,
    });
    return { ok: false, action: "failed", error: message };
  }
}
