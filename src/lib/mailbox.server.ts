/**
 * Inbox reader (server-only).
 *
 * Reads exactly one mailbox — the address in EMAIL_SOURCE_MAILBOX, verified
 * against the server-side allowlist before every request — and turns real work
 * emails into matters in the operations queue.
 *
 * Hard rules:
 *
 *  1. Only `/users/<authorised mailbox>/mailFolders/Inbox/messages` is read.
 *     No user enumeration, no /me/*, no dynamic mailbox selection, and no sent
 *     items, drafts, deleted items or archive folders.
 *  2. No historical import. A checkpoint is stamped the first time the reader
 *     runs, and only mail received after that point is ever processed.
 *  3. Nothing is created twice. Both the Graph message id and the
 *     internetMessageId are recorded in `integration_events`, so a re-run or a
 *     redelivery can't duplicate a matter.
 *  4. Only mail a coordinator would actually action becomes a matter. Anything
 *     that looks like a newsletter, a calendar response or an automated
 *     no-reply notice is skipped and recorded as skipped.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createIntakeMatter, REF_TAG, type IntakeResult } from "./intake.server";
import { authorizedMailbox, inboxMessagesPath } from "./mailbox-allowlist.server";
import {
  alreadyTagged,
  categoriesAfterClose,
  categoriesAfterCreate,
  hasTag,
  requestsTicket,
  COMPLETED_TAG,
} from "./mail-categories";

type Db = SupabaseClient<Database>;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";
const SYSTEM = "outlook_inbox";
const CHECKPOINT_KEY = "processing_checkpoint";

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
  internetMessageId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  webLink?: string | null;
  /** Outlook categories — the intake protocol lives here. */
  categories?: string[] | null;
  from?: { emailAddress?: { name?: string | null; address?: string | null } | null } | null;
  body?: { content?: string | null; contentType?: string | null } | null;
  internetMessageHeaders?: { name?: string | null; value?: string | null }[] | null;
  "@odata.type"?: string;
};

/**
 * Writes the message's categories back.
 *
 * Never throws: re-categorising is bookkeeping, and a failure here must not
 * undo a ticket that already saved. The next pass tries again.
 */
async function setCategories(messageId: string, categories: string[]) {
  try {
    await graph(inboxMessagesPath(`/${messageId}`), {
      method: "PATCH",
      body: JSON.stringify({ categories }),
    });
    return true;
  } catch (err) {
    console.error("Could not update mail categories:", err instanceof Error ? err.message : err);
    return false;
  }
}

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
 * The point in time after which mail is processed.
 *
 * The first run stamps "now" and processes nothing, so reactivating the
 * automation never sweeps in the mailbox's history.
 */
export async function readCheckpoint(db: Db): Promise<string | null> {
  const { data } = await db
    .from("integration_events")
    .select("external_id")
    .eq("system", SYSTEM)
    .eq("operation", CHECKPOINT_KEY)
    .maybeSingle();
  return (data?.external_id as string | undefined) ?? null;
}

async function writeCheckpoint(db: Db, iso: string) {
  const existing = await readCheckpoint(db);
  if (existing === null) {
    await db.from("integration_events").insert({
      system: SYSTEM,
      direction: "inbound",
      operation: CHECKPOINT_KEY,
      external_id: iso,
      status: "checkpoint",
      resolved_at: new Date().toISOString(),
    });
    return;
  }
  if (new Date(iso) <= new Date(existing)) return;
  await db
    .from("integration_events")
    .update({ external_id: iso, resolved_at: new Date().toISOString() })
    .eq("system", SYSTEM)
    .eq("operation", CHECKPOINT_KEY);
}

/**
 * Reads new Inbox mail from the one authorised mailbox.
 * The path is built by the allowlist, so an unauthorised mailbox throws before
 * any network call is made.
 */
async function fetchInbox(limit: number, since: string) {
  const query =
    `?$filter=receivedDateTime gt ${since}&$top=${limit}&$orderby=receivedDateTime asc` +
    `&$select=id,internetMessageId,subject,bodyPreview,receivedDateTime,isRead,webLink,from,body,internetMessageHeaders,categories`;
  const path = inboxMessagesPath(query);
  const res = await graph(path);
  return ((await res.json()).value ?? []) as GraphMessage[];
}


/** Senders and subjects that are never operational work. */
const NOISE_SENDER =
  /(no-?reply|do-?not-?reply|newsletter|notifications?@|marketing|mailer-daemon|postmaster|billing@|invoice@|calendar-notification|@(members|email|mail|e|news|info|updates|shared\d*)\.|ccsend\.com|mailchimp|sendgrid\.net|hubspot|constantcontact|salesforce|substack|linkedin\.com|indeed\.com|zillow|stocktwits)/i;
const NOISE_SUBJECT =
  /^(re: )?(declined|accepted|tentative|canceled|cancelled):|unsubscribe|your (daily|weekly) |newsletter|webinar|invitation:|out of office|automatic reply|market digest|% off|sale ends|just for you|availability|price list|rate sheet|weekly (update|round-?up|list)/i;
const CALENDAR_TYPE = /eventMessage/i;

export type SkipReason =
  | "automated"
  | "calendar"
  | "bulk"
  | "not categorised"
  | "already handled"
  | "empty";

function isBulk(msg: GraphMessage) {
  for (const h of msg.internetMessageHeaders ?? []) {
    const name = (h.name ?? "").toLowerCase();
    const value = (h.value ?? "").toLowerCase();
    if (name === "list-unsubscribe" || name === "list-id" || name === "x-campaign-id") return true;
    if (name === "precedence" && /bulk|list|junk/.test(value)) return true;
    if (name === "auto-submitted" && value !== "no") return true;
  }
  return false;
}

/**
 * Decides whether a message is coordinator work.
 *
 * Anything from an ARHA address, a reply on one of our matters, or a message
 * that clearly describes work at a home is kept. Everything else is left in
 * the inbox for a human — Resolve would rather miss a matter than fill the
 * queue with marketing.
 */
function classify(msg: GraphMessage, knownSender: boolean): SkipReason | null {
  if (CALENDAR_TYPE.test(msg["@odata.type"] ?? "")) return "calendar";
  const from = msg.from?.emailAddress?.address ?? "";
  const subject = msg.subject ?? "";
  const preview = msg.bodyPreview ?? "";
  if (!subject.trim() && !preview.trim()) return "empty";

  // The category protocol comes first, before any guesswork. A person marks a
  // message "Resolve: create task" and only then does a ticket open.
  if (alreadyTagged(msg.categories)) return "already handled";
  if (requestsTicket(msg.categories)) return null;

  if (isBulk(msg)) return "bulk";
  if (NOISE_SENDER.test(from) || NOISE_SUBJECT.test(subject)) return "automated";

  const text = `${subject}\n${preview}`;
  // A reply on an existing matter still threads without a category, so a
  // conversation never breaks in half.
  if (REF_TAG.test(text)) return null;
  return "not categorised";
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

/** Every email address Resolve already knows: staff, vendor contacts, programme owners. */
async function knownSenders(db: Db) {
  const addresses = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (value && value.includes("@")) addresses.add(value.trim().toLowerCase());
  };
  const [staff, contacts, orgs, owners] = await Promise.all([
    db.from("profiles").select("email"),
    db.from("vendor_contacts").select("email"),
    db.from("vendor_orgs").select("primary_contact_email"),
    db.from("owner_programs").select("owner_email"),
  ]);
  (staff.data ?? []).forEach((r) => add(r.email));
  (contacts.data ?? []).forEach((r) => add(r.email));
  (orgs.data ?? []).forEach((r) => add(r.primary_contact_email));
  (owners.data ?? []).forEach((r) => add(r.owner_email));
  return addresses;
}

export type MailboxSyncResult = {
  ok: boolean;
  scanned: number;
  created: number;
  threaded: number;
  skipped: number;
  failed: number;
  /** Messages moved from "create task" to "task created" after the ticket saved. */
  recategorised: number;
  /** Messages moved to "task completed" because their ticket is now closed. */
  completedTagged: number;
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
    recategorised: 0,
    completedTagged: 0,
    mailbox: authorizedMailbox(),
    items: [],
  };

  if (!mailboxReadEnabled()) {
    return { ...base, ok: false, error: "The Microsoft mailbox is not connected." };
  }

  // First run ever: stamp the checkpoint and stop. Nothing historical is imported.
  let checkpoint = await readCheckpoint(db);
  if (!checkpoint) {
    const now = new Date().toISOString();
    if (!dryRun) await writeCheckpoint(db, now);
    return {
      ...base,
      ok: true,
      error: dryRun
        ? "No checkpoint set yet — the first live run will start from that moment."
        : `Checkpoint set to ${now}. Only mail received after this point will be processed.`,
    };
  }

  let messages: GraphMessage[] = [];
  try {
    messages = await fetchInbox(limit, checkpoint);
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : "Could not read the inbox." };
  }

  const known = await knownSenders(db);
  // A broadcast that lands 13 times is still one thing. Never open the same
  // subject from the same sender twice, in this run or within the last week.
  const seen = new Set<string>();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: recentTickets } = await db
    .from("tickets")
    .select("title, source_reference")
    .eq("external_source", "email")
    .gte("created_at", since);
  for (const row of recentTickets ?? []) {
    seen.add(`${(row.title ?? "").toLowerCase()}|${(row.source_reference ?? "").toLowerCase()}`);
  }
  base.scanned = messages.length;

  let highWater = checkpoint;

  for (const msg of messages) {
    const subject = (msg.subject ?? "").trim() || "(no subject)";
    const from = msg.from?.emailAddress?.address ?? "unknown sender";
    const messageIds = [msg.id, msg.internetMessageId ?? ""].filter(Boolean);
    if (msg.receivedDateTime && new Date(msg.receivedDateTime) > new Date(highWater)) {
      highWater = msg.receivedDateTime;
    }

    // Same message seen twice — a re-run, a redelivery, or a Graph id we've
    // already handled under its internet id. Never open a second matter.
    if (await alreadyProcessed(db, messageIds)) {
      base.skipped++;
      base.items.push({ subject, from, outcome: "skipped", reason: "already processed" });
      continue;
    }

    const skip = classify(msg, known.has(from.toLowerCase()));
    if (skip) {
      base.skipped++;
      base.items.push({ subject, from, outcome: "skipped", reason: skip });
      if (!dryRun) await recordEvent(db, msg, "skipped", skip, null);
      continue;
    }

    const dupeKey = `${subject.toLowerCase()}|${from.toLowerCase()}`;
    if (seen.has(dupeKey)) {
      base.skipped++;
      base.items.push({ subject, from, outcome: "skipped", reason: "duplicate of an existing matter" });
      if (!dryRun) await recordEvent(db, msg, "skipped", "duplicate", null);
      continue;
    }
    seen.add(dupeKey);

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
      await recordEvent(db, msg, result.threaded ? "threaded" : "created", null, result.ticketId);
      // Only now — the ticket exists and is saved. A failure to re-categorise
      // never rolls back the ticket; the next pass retries the tag.
      if (!result.threaded && requestsTicket(msg.categories)) {
        const tagged = await setCategories(msg.id, categoriesAfterCreate(msg.categories));
        if (tagged) base.recategorised++;
      }
    } catch (err) {
      base.failed++;
      const message = err instanceof Error ? err.message : "Intake failed";
      base.items.push({ subject, from, outcome: "failed", reason: message });
      await recordEvent(db, msg, "failed", message, null);
    }
  }

  // Advance the checkpoint only for mail we actually looked at, so a failure
  // never silently skips the next run past unread work.
  if (!dryRun && highWater !== checkpoint) await writeCheckpoint(db, highWater);

  // Tickets closed since the last pass get their message re-categorised.
  if (!dryRun) base.completedTagged = await tagClosedTickets(db);

  return base;
}


/** True when any of this message's ids has already been recorded. */
async function alreadyProcessed(db: Db, messageIds: string[]) {
  if (!messageIds.length) return false;
  const { data } = await db
    .from("integration_events")
    .select("id")
    .eq("system", SYSTEM)
    .eq("operation", "mailbox_message")
    .in("external_id", messageIds)
    .limit(1);
  return Boolean(data?.length);
}

async function recordEvent(
  db: Db,
  msg: GraphMessage,
  status: string,
  error: string | null,
  ticketId: string | null,
) {
  // Both ids are recorded so neither a Graph id change nor a redelivery under
  // the same internet id can produce a second matter.
  const ids = Array.from(new Set([msg.id, msg.internetMessageId ?? ""].filter(Boolean)));
  const rows = ids.map((external_id) => ({
    system: SYSTEM,
    direction: "inbound",
    operation: "mailbox_message",
    external_id,
    entity_type: ticketId ? "ticket" : null,
    entity_id: ticketId,
    status,
    error_message: error,
    resolved_at: status === "failed" ? null : new Date().toISOString(),
  }));
  const { error: insertError } = await db.from("integration_events").insert(rows);
  if (insertError) console.error("Could not record mailbox event:", insertError.message);
}


/** The last few inbox messages Resolve acted on, newest first. */
export async function recentMailboxEvents(db: Db, limit = 20) {
  const { data, error } = await db
    .from("integration_events")
    .select("id, status, error_message, created_at, entity_id, external_id")
    .eq("system", SYSTEM)
    .eq("operation", "mailbox_message")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}
