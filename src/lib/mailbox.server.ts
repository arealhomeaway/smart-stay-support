/**
 * Inbox reader (server-only).
 *
 * Reads the shared ARHA mailbox through the Microsoft connector gateway and
 * turns real work emails into matters in the operations queue. Two hard rules
 * shape this file:
 *
 *  1. Only mail a coordinator would actually action becomes a matter. Anything
 *     that looks like a newsletter, a calendar response or an automated
 *     no-reply notice is skipped and recorded as skipped, never opened.
 *  2. Nothing is ever created twice. Replies carrying [ARHA-123] land on the
 *     existing matter's timeline, and every message id is written to
 *     `integration_events` so a re-run can't duplicate it.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createIntakeMatter, type IntakeResult } from "./intake.server";
import { SHARED_MAILBOX } from "./email.server";

type Db = SupabaseClient<Database>;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";
const SYSTEM = "outlook_inbox";

function mailConfig() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["MICROSOFT_OUTLOOK_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

/** True when Resolve is allowed to read the team inbox. */
export function mailboxReadEnabled() {
  return Boolean(mailConfig());
}

type GraphMessage = {
  id: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  webLink?: string | null;
  from?: { emailAddress?: { name?: string | null; address?: string | null } | null } | null;
  body?: { content?: string | null; contentType?: string | null } | null;
  "@odata.type"?: string;
};

async function graph(path: string, init?: RequestInit) {
  const cfg = mailConfig();
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
    console.error(`Outlook read failed [${res.status}] ${path}: ${detail}`);
    throw new Error(`Mail provider [${res.status}]: ${detail.slice(0, 300)}`);
  }
  return res;
}

/**
 * Reads unread inbox mail. Mailbox-level access is preferred; if Send/Read As
 * on the shared mailbox has not been granted we read the connected user's own
 * inbox, which is where forwarded coordinator mail lands today.
 */
async function fetchUnread(limit: number) {
  const query =
    `?$filter=isRead eq false&$top=${limit}&$orderby=receivedDateTime desc` +
    `&$select=id,subject,bodyPreview,receivedDateTime,isRead,webLink,from,body`;
  const shared = `/users/${encodeURIComponent(SHARED_MAILBOX)}/mailFolders/inbox/messages${query}`;
  try {
    const res = await graph(shared);
    return { scope: shared.split("/mailFolders")[0]!, messages: ((await res.json()).value ?? []) as GraphMessage[] };
  } catch {
    const res = await graph(`/me/mailFolders/inbox/messages${query}`);
    return { scope: "/me", messages: ((await res.json()).value ?? []) as GraphMessage[] };
  }
}

async function markRead(scope: string, id: string) {
  try {
    await graph(`${scope}/messages/${id}`, { method: "PATCH", body: JSON.stringify({ isRead: true }) });
  } catch (err) {
    console.error("Could not mark mail read:", err);
  }
}

/** Senders and subjects that are never operational work. */
const NOISE_SENDER =
  /(no-?reply|do-?not-?reply|newsletter|notifications?@|marketing|mailer-daemon|postmaster|billing@|invoice@|calendar-notification)/i;
const NOISE_SUBJECT =
  /^(re: )?(declined|accepted|tentative|canceled|cancelled):|unsubscribe|your (daily|weekly) |newsletter|webinar|invitation:|out of office|automatic reply/i;
const CALENDAR_TYPE = /eventMessage/i;

export type SkipReason = "automated" | "calendar" | "self" | "empty";

function classify(msg: GraphMessage): SkipReason | null {
  if (CALENDAR_TYPE.test(msg["@odata.type"] ?? "")) return "calendar";
  const from = msg.from?.emailAddress?.address ?? "";
  const subject = msg.subject ?? "";
  if (NOISE_SENDER.test(from) || NOISE_SUBJECT.test(subject)) return "automated";
  if (!subject.trim() && !(msg.bodyPreview ?? "").trim()) return "empty";
  return null;
}

function plainText(msg: GraphMessage) {
  const raw = msg.body?.content ?? msg.bodyPreview ?? "";
  const text =
    msg.body?.contentType === "html"
      ? raw
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n\n")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
      : raw;
  // Drop the quoted history so the matter shows the new message, not the thread.
  return text
    .split(/\n-{3,}\s*Original Message|\nFrom: .*\nSent: /)[0]!
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 4000);
}

export type MailboxSyncResult = {
  ok: boolean;
  scanned: number;
  created: number;
  threaded: number;
  skipped: number;
  failed: number;
  mailbox: string;
  items: {
    subject: string;
    from: string;
    outcome: "created" | "threaded" | "skipped" | "failed";
    ref?: number;
    priority?: string;
    reason?: string;
  }[];
  error?: string;
};

/**
 * One pass over the unread inbox.
 *
 * `markProcessed` writes the mail back as read so the next run starts clean —
 * the dry-run path leaves the mailbox untouched so a supervisor can preview
 * exactly what would be opened.
 */
export async function syncMailbox(
  db: Db,
  options: { limit?: number; dryRun?: boolean } = {},
): Promise<MailboxSyncResult> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 50);
  const dryRun = options.dryRun ?? false;
  const base: MailboxSyncResult = {
    ok: true,
    scanned: 0,
    created: 0,
    threaded: 0,
    skipped: 0,
    failed: 0,
    mailbox: SHARED_MAILBOX,
    items: [],
  };

  if (!mailboxReadEnabled()) {
    return { ...base, ok: false, error: "The Microsoft mailbox is not connected." };
  }

  let scope = "/me";
  let messages: GraphMessage[] = [];
  try {
    const read = await fetchUnread(limit);
    scope = read.scope;
    messages = read.messages;
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : "Could not read the inbox." };
  }

  base.scanned = messages.length;
  base.mailbox = scope === "/me" ? "connected mailbox" : SHARED_MAILBOX;

  for (const msg of messages) {
    const subject = (msg.subject ?? "").trim() || "(no subject)";
    const from = msg.from?.emailAddress?.address ?? "unknown sender";
    const skip = classify(msg);

    if (skip) {
      base.skipped++;
      base.items.push({ subject, from, outcome: "skipped", reason: skip });
      if (!dryRun) {
        await recordEvent(db, msg.id, "skipped", skip, null);
        await markRead(scope, msg.id);
      }
      continue;
    }

    if (!dryRun && (await alreadyProcessed(db, msg.id))) {
      base.skipped++;
      base.items.push({ subject, from, outcome: "skipped", reason: "already processed" });
      continue;
    }

    if (dryRun) {
      base.created++;
      base.items.push({ subject, from, outcome: "created" });
      continue;
    }

    try {
      const result: IntakeResult = await createIntakeMatter(db, {
        subject,
        body: plainText(msg),
        from,
        source: "email",
        externalId: msg.id,
        externalUrl: msg.webLink ?? null,
      });
      if (result.threaded) {
        base.threaded++;
        base.items.push({ subject, from, outcome: "threaded", ref: result.ref });
      } else {
        base.created++;
        base.items.push({ subject, from, outcome: "created", ref: result.ref, priority: result.priority });
      }
      await recordEvent(db, msg.id, result.threaded ? "threaded" : "created", null, result.ticketId);
      await markRead(scope, msg.id);
    } catch (err) {
      base.failed++;
      const message = err instanceof Error ? err.message : "Intake failed";
      base.items.push({ subject, from, outcome: "failed", reason: message });
      await recordEvent(db, msg.id, "failed", message, null);
    }
  }

  return base;
}

async function alreadyProcessed(db: Db, messageId: string) {
  const { data } = await db
    .from("integration_events")
    .select("id")
    .eq("system", SYSTEM)
    .eq("external_id", messageId)
    .maybeSingle();
  return Boolean(data);
}

async function recordEvent(
  db: Db,
  messageId: string,
  status: string,
  error: string | null,
  ticketId: string | null,
) {
  const { error: insertError } = await db.from("integration_events").insert({
    system: SYSTEM,
    direction: "inbound",
    operation: "mailbox_message",
    external_id: messageId,
    entity_type: ticketId ? "ticket" : null,
    entity_id: ticketId,
    status,
    error_message: error,
    resolved_at: status === "failed" ? null : new Date().toISOString(),
  });
  if (insertError) console.error("Could not record mailbox event:", insertError.message);
}

/** The last few inbox messages Resolve acted on, newest first. */
export async function recentMailboxEvents(db: Db, limit = 20) {
  const { data, error } = await db
    .from("integration_events")
    .select("id, status, error_message, created_at, entity_id, external_id")
    .eq("system", SYSTEM)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
