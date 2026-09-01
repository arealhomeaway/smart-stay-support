/**
 * Outlook → Resolve intake (server-only).
 *
 * Nothing in the inbox becomes work on its own. A person decides, in Outlook,
 * by applying one of two categories:
 *
 *   "Resolve: create ticket"                        → one Operations Ticket
 *   "Resolve: lead management- create a ticket"     → one Tenant Lead
 *
 * Resolve then owns the administrative half: it creates exactly one record,
 * keeps the email as provenance, swaps the trigger category for
 * "Resolve: ticket created", and later moves it to "Resolve: ticket closed"
 * when the record is settled (and back again if a Ticket is reopened).
 *
 * Hard rules:
 *
 *  1. Only the one authorised mailbox is ever read, through
 *     `/users/<authorised mailbox>/messages`. No user enumeration, no /me/*,
 *     and no dynamic mailbox selection. Folder location is deliberately not
 *     part of the decision: Outlook rules route mail into Team A, Team B,
 *     Accounting, Direct Bookings / Mid Term Leads, Deliveries and Needs
 *     Triage to say who owns it, and Resolve never moves a message.

 *  2. No record is ever created without a trigger category. Uncategorised mail
 *     is left completely alone.
 *  3. No historical import. A checkpoint is stamped the first time the reader
 *     runs, and only mail received after that point is ever processed.
 *  4. Nothing is created twice. Both the Graph message id and the
 *     internetMessageId are claimed in `integration_events` behind a unique
 *     index, and the conversation id links replies to the record that already
 *     exists for the thread.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createIntakeMatter, REF_TAG, type IntakeResult } from "./intake.server";
import { authorizedMailbox, mailboxMessagesPath } from "./mailbox-allowlist.server";
import { createLeadFromEmail } from "./outlook-lead.server";
import { plainTextBody, type OutlookSource } from "./outlook-email";
import {
  alreadyTagged,
  categoriesAfterClose,
  categoriesAfterCreate,
  categoriesAfterReopen,
  hasTag,
  requestsRecord,
  triggerKind,
  CLOSED_TAG,
  CREATED_TAG,
  CREATE_LEAD_TAG,
  CREATE_TICKET_TAG,
  type TriggerKind,
} from "./mail-categories";

type Db = SupabaseClient<Database>;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";
export const SYSTEM = "outlook_inbox";
export const OPERATION = "mailbox_message";
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

export type GraphMessage = {
  id: string;
  internetMessageId?: string | null;
  conversationId?: string | null;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  webLink?: string | null;
  hasAttachments?: boolean;
  /** Outlook categories — the intake protocol lives here. */
  categories?: string[] | null;
  from?: { emailAddress?: { name?: string | null; address?: string | null } | null } | null;
  toRecipients?: { emailAddress?: { address?: string | null } | null }[] | null;
  body?: { content?: string | null; contentType?: string | null } | null;
  "@odata.type"?: string;
};

const SELECT_FIELDS =
  "id,internetMessageId,conversationId,subject,bodyPreview,receivedDateTime,isRead,webLink,hasAttachments,from,toRecipients,body,categories";

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
    console.error(`Outlook request failed [${res.status}] ${path}: ${detail}`);
    throw new Error(`Mail provider [${res.status}]: ${detail.slice(0, 300)}`);
  }
  return res;
}

/**
 * Writes the message's categories back.
 *
 * Never throws: re-categorising is bookkeeping, and a failure here must not
 * undo a record that already saved. The next pass tries again.
 */
async function setCategories(messageId: string, categories: string[]) {
  try {
    await graph(mailboxMessagesPath(`/${messageId}`), {
      method: "PATCH",
      body: JSON.stringify({ categories }),
    });
    return true;
  } catch (err) {
    console.error("Could not update mail categories:", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Reads one message by id from the mailbox, whatever folder holds it.
 *
 * A Graph message id changes when Outlook moves a message between folders, so
 * a notification that arrives just before a rule fires can point at an id that
 * no longer resolves. In that case the message is found again by its stable
 * internetMessageId, which survives the move.
 */
export async function fetchMessage(messageId: string, internetMessageId?: string | null): Promise<GraphMessage | null> {
  try {
    const res = await graph(mailboxMessagesPath(`/${encodeURIComponent(messageId)}?$select=${SELECT_FIELDS}`));
    return (await res.json()) as GraphMessage;
  } catch {
    if (!internetMessageId) return null;
    return findByInternetMessageId(internetMessageId);
  }
}

/** Mailbox-wide lookup by the id that survives a folder move. */
export async function findByInternetMessageId(internetMessageId: string): Promise<GraphMessage | null> {
  try {
    const filter = `internetMessageId eq '${internetMessageId.replace(/'/g, "''")}'`;
    const res = await graph(
      mailboxMessagesPath(`?$filter=${encodeURIComponent(filter)}&$top=1&$select=${SELECT_FIELDS}`),
    );
    const rows = ((await res.json())?.value ?? []) as GraphMessage[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}


/** Attachment metadata only — no file bytes are copied into Resolve. */
async function attachmentMeta(messageId: string) {
  try {
    const res = await graph(
      mailboxMessagesPath(`/${encodeURIComponent(messageId)}/attachments?$select=name,contentType,size`),
    );
    const rows = ((await res.json())?.value ?? []) as { name?: string; contentType?: string; size?: number }[];
    return rows.slice(0, 20).map((a) => ({
      name: a.name ?? "attachment",
      contentType: a.contentType ?? null,
      size: typeof a.size === "number" ? a.size : null,
    }));
  } catch {
    return [];
  }
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
 * The recovery sweep: trigger-tagged mail only, from anywhere in the mailbox.
 *
 * Change notifications do the real work. This is the safety net, so it asks
 * Microsoft the narrowest possible question — "which messages carry a Resolve
 * trigger category?" — instead of downloading whole folders. One query per
 * trigger category, because Graph does not reliably combine two
 * `categories/any(...)` clauses with a sort.
 *
 * Mail received before the activation checkpoint is never eligible, so no
 * history is imported. Within that window the sweep is deliberately not
 * time-bounded beyond it: a message received yesterday and categorised this
 * morning must still be found. Re-seeing an already-handled message is free —
 * the durable per-message mapping settles it.
 */
async function fetchTriggerMail(limit: number, since: string) {
  const seen = new Map<string, GraphMessage>();
  for (const tag of [CREATE_TICKET_TAG, CREATE_LEAD_TAG]) {
    const filter = `receivedDateTime gt ${since} and categories/any(c:c eq '${tag.replace(/'/g, "''")}')`;
    const query =
      `?$filter=${encodeURIComponent(filter)}&$top=${limit}&$orderby=receivedDateTime asc&$select=${SELECT_FIELDS}`;
    const res = await graph(mailboxMessagesPath(query));
    for (const m of ((await res.json())?.value ?? []) as GraphMessage[]) {
      if (m?.id && !seen.has(m.id)) seen.set(m.id, m);
    }
  }
  return Array.from(seen.values()).slice(0, limit);
}


export type SkipReason =
  | "not categorised"
  | "already handled"
  | "already processed"
  | "claimed by another pass"
  | "linked to the existing record for this thread"
  | "filed on the existing ticket";

/** The full provenance record kept for a message. */
export async function sourceFor(msg: GraphMessage, trigger: TriggerKind): Promise<OutlookSource> {
  return {
    mailbox: authorizedMailbox(),
    messageId: msg.id,
    internetMessageId: msg.internetMessageId ?? null,
    conversationId: msg.conversationId ?? null,
    subject: (msg.subject ?? "").trim() || "(no subject)",
    fromName: msg.from?.emailAddress?.name ?? null,
    fromAddress: msg.from?.emailAddress?.address ?? null,
    toRecipients: (msg.toRecipients ?? [])
      .map((r) => r.emailAddress?.address ?? "")
      .filter(Boolean)
      .slice(0, 10),
    receivedAt: msg.receivedDateTime ?? null,
    webLink: msg.webLink ?? null,
    hasAttachments: Boolean(msg.hasAttachments),
    attachments: msg.hasAttachments ? await attachmentMeta(msg.id) : [],
    trigger,
  };
}

/**
 * Marker parked in `error_message` when a record saved but the Outlook
 * category could not be updated. It is the retry queue: the next pass finds
 * the row, re-tags the message, and clears the marker. It never causes a
 * second record, because the row itself is what suppresses re-creation.
 */
export const CATEGORY_PENDING = "recategorise_pending";

/** A claim older than this is assumed abandoned (crashed pass) and reclaimable. */
export const CLAIM_STALE_MS = 10 * 60 * 1000;

export type MailboxSyncResult = {
  ok: boolean;
  scanned: number;
  created: number;
  leadsCreated: number;
  threaded: number;
  skipped: number;
  failed: number;
  /** Messages moved from a trigger category to "ticket created". */
  recategorised: number;
  /** Category updates that failed earlier and succeeded on a later pass. */
  recategoriseRetried: number;
  /** Messages moved to "ticket closed" because their record is now settled. */
  completedTagged: number;
  /** Messages moved back to "ticket created" because their Ticket reopened. */
  reopenedTagged: number;
  mailbox: string;
  items: {
    subject: string;
    from: string;
    outcome: "created" | "lead" | "threaded" | "skipped" | "failed";
    ref?: number;
    priority?: string;
    reason?: string;
  }[];
  error?: string;
};

/**
 * One pass over the inbox since the checkpoint.
 *
 * `dryRun` previews what would happen without touching the mailbox or the
 * queue, so a supervisor can see exactly what a live run would create.
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
    leadsCreated: 0,
    threaded: 0,
    skipped: 0,
    failed: 0,
    recategorised: 0,
    recategoriseRetried: 0,
    completedTagged: 0,
    reopenedTagged: 0,
    mailbox: authorizedMailbox(),
    items: [],
  };

  if (!mailboxReadEnabled()) {
    return { ...base, ok: false, error: "The Microsoft mailbox is not connected." };
  }

  // First run ever: stamp the checkpoint and stop. Nothing historical is imported.
  const checkpoint = await readCheckpoint(db);
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
    messages = await fetchTriggerMail(limit, checkpoint);
  } catch (err) {
    return { ...base, ok: false, error: err instanceof Error ? err.message : "Could not read the mailbox." };
  }

  base.scanned = messages.length;

  for (const msg of messages) {
    const outcome = await processMessage(db, msg, dryRun);
    applyOutcome(base, outcome);
  }

  // The checkpoint is the activation line, not a read cursor: it stays where
  // it is so a message categorised days after it arrived is still eligible.


  if (!dryRun) {
    const settled = await syncTerminalStates(db);
    base.completedTagged = settled.closed;
    base.reopenedTagged = settled.reopened;
  }

  return base;
}

type MessageOutcome = MailboxSyncResult["items"][number] & { recategorised?: boolean; retried?: boolean };

function applyOutcome(base: MailboxSyncResult, o: MessageOutcome) {
  base.items.push(o);
  if (o.outcome === "created") base.created++;
  if (o.outcome === "lead") base.leadsCreated++;
  if (o.outcome === "threaded") base.threaded++;
  if (o.outcome === "skipped") base.skipped++;
  if (o.outcome === "failed") base.failed++;
  if (o.recategorised) base.recategorised++;
  if (o.retried) base.recategoriseRetried++;
}

/**
 * Everything that happens to one message.
 *
 * Shared by the scheduled sweep and the Graph change-notification handler, so
 * a webhook delivery and a sweep can never disagree about what to do.
 */
export async function processMessage(db: Db, msg: GraphMessage, dryRun = false): Promise<MessageOutcome> {
  const subject = (msg.subject ?? "").trim() || "(no subject)";
  const from = msg.from?.emailAddress?.address ?? "unknown sender";
  const messageIds = [msg.id, msg.internetMessageId ?? ""].filter(Boolean);

  // Same message seen twice — a re-run, a duplicate notification, or a Graph
  // id we already handled under its internet id. Never create a second record.
  const prior = await priorRecord(db, messageIds);
  const action = nextActionFor(prior);
  if (action !== "create") {
    if (action === "retag" && !dryRun && prior) {
      const done = await retryCategory(db, msg, prior);
      return {
        subject,
        from,
        outcome: "skipped",
        retried: done,
        reason: done ? "already processed · category retag retried" : "already processed · retag still failing",
      };
    }
    return { subject, from, outcome: "skipped", reason: "already processed" };
  }

  const trigger = triggerKind(msg.categories);
  if (!trigger) {
    // No category, no record — ever. The one exception is a reply that still
    // carries our [ARHA-123] tag: that is filed as a note on the ticket it
    // names, and cannot create anything.
    if (!alreadyTagged(msg.categories) && !dryRun) {
      const filed = await fileTaggedReply(db, msg);
      if (filed) return { subject, from, outcome: "threaded", ref: filed, reason: "filed on the existing ticket" };
    }
    return {
      subject,
      from,
      outcome: "skipped",
      reason: alreadyTagged(msg.categories) ? "already handled" : "not categorised",
    };
  }

  if (dryRun) {
    return { subject, from, outcome: trigger === "lead" ? "lead" : "created" };
  }

  // Claim the message BEFORE creating anything. Two passes racing here are
  // settled by the unique index: the loser walks away rather than opening a
  // twin record.
  if (!(await claimMessage(db, msg, isStaleClaim(prior ?? ({} as MailboxRecord)) ? prior : null))) {
    return { subject, from, outcome: "skipped", reason: "claimed by another pass" };
  }

  const body = plainTextBody(msg.body?.content ?? msg.bodyPreview ?? "", msg.body?.contentType);
  const source = await sourceFor(msg, trigger);

  // A reply on a thread that already produced work: link it, never duplicate.
  const threadMate = await conversationRecord(db, msg.conversationId ?? null, messageIds);
  if (threadMate?.entity_id) {
    await linkToExisting(db, threadMate, subject, body, from);
    const tagged = await setCategories(msg.id, categoriesAfterCreate(msg.categories));
    await settleClaim(db, messageIds, {
      status: "linked",
      entityType: threadMate.entity_type,
      entityId: threadMate.entity_id,
      error: tagged ? null : CATEGORY_PENDING,
      conversationId: msg.conversationId ?? null,
      source,
    });
    return {
      subject,
      from,
      outcome: "skipped",
      recategorised: tagged,
      reason: "linked to the existing record for this thread",
    };
  }

  try {
    if (trigger === "lead") {
      const lead = await createLeadFromEmail(db, { subject, body, source });
      const tagged = await setCategories(msg.id, categoriesAfterCreate(msg.categories));
      await settleClaim(db, messageIds, {
        status: "created",
        entityType: "lead",
        entityId: lead.leadId,
        error: tagged ? null : CATEGORY_PENDING,
        conversationId: msg.conversationId ?? null,
        source,
      });
      return { subject, from, outcome: "lead", recategorised: tagged };
    }

    const result: IntakeResult = await createIntakeMatter(db, {
      subject,
      body,
      from,
      source: "email",
      externalId: msg.id,
      externalUrl: msg.webLink ?? null,
    });
    const tagged = await setCategories(msg.id, categoriesAfterCreate(msg.categories));
    await settleClaim(db, messageIds, {
      status: result.threaded ? "linked" : "created",
      entityType: "ticket",
      entityId: result.ticketId,
      error: tagged ? null : CATEGORY_PENDING,
      conversationId: msg.conversationId ?? null,
      source,
    });
    return {
      subject,
      from,
      outcome: result.threaded ? "threaded" : "created",
      ref: result.ref,
      priority: result.priority,
      recategorised: tagged,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intake failed";
    await settleClaim(db, messageIds, {
      status: "failed",
      entityType: null,
      entityId: null,
      error: message,
      conversationId: msg.conversationId ?? null,
      source,
    });
    return { subject, from, outcome: "failed", reason: message };
  }
}

/**
 * A reply carrying [ARHA-123] is filed on that ticket's timeline.
 * It can only ever add a note — nothing here creates a ticket.
 */
async function fileTaggedReply(db: Db, msg: GraphMessage): Promise<number | null> {
  const text = `${msg.subject ?? ""}\n${msg.bodyPreview ?? ""}`;
  const tag = text.match(REF_TAG);
  if (!tag) return null;
  const { data: parent } = await db.from("tickets").select("id, ref").eq("ref", Number(tag[1])).maybeSingle();
  if (!parent) return null;
  const body = plainTextBody(msg.body?.content ?? msg.bodyPreview ?? "", msg.body?.contentType);
  await db.from("ticket_activity").insert({
    ticket_id: parent.id,
    kind: "note",
    event_type: "note",
    channel: "email",
    body: [`Emailed reply from ${msg.from?.emailAddress?.address ?? "unknown sender"}:`, body].join("\n\n"),
  });
  await recordEvent(db, msg, "linked", null, { entityType: "ticket", entityId: parent.id });
  return parent.ref;
}

/** Files the message on the Ticket or Lead the thread already produced. */
async function linkToExisting(db: Db, row: MailboxRecord, subject: string, body: string, from: string) {
  if (!row.entity_id) return;
  if (row.entity_type === "lead") {
    await db.from("lead_activity").insert({
      lead_id: row.entity_id,
      channel: "email",
      outcome: "Reply received",
      note: [`Reply on the same Outlook thread — ${subject}`, `From ${from}`, body.slice(0, 3000)]
        .filter(Boolean)
        .join("\n\n"),
    });
    return;
  }
  await db.from("ticket_activity").insert({
    ticket_id: row.entity_id,
    kind: "note",
    event_type: "note",
    channel: "email",
    body: [`Reply on the same Outlook thread — ${subject}`, `From ${from}`, body].filter(Boolean).join("\n\n"),
  });
}

/**
 * Moves the category on for records that have reached a terminal state, and
 * back again for Tickets that were reopened.
 *
 * Driven by the record's own status rather than by a hook on a button, so a
 * close made anywhere in Resolve is picked up and a re-run finds nothing left
 * to do.
 */
export async function syncTerminalStates(db: Db, limit = 25): Promise<{ closed: number; reopened: number }> {
  const { data: events } = await db
    .from("integration_events")
    .select("id, external_id, entity_id, entity_type, status")
    .eq("system", SYSTEM)
    .eq("operation", OPERATION)
    .in("status", ["created", "linked", "closed"])
    .not("entity_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!events?.length) return { closed: 0, reopened: 0 };

  const ticketIds = events.filter((e) => e.entity_type === "ticket").map((e) => e.entity_id!) as string[];
  const leadIds = events.filter((e) => e.entity_type === "lead").map((e) => e.entity_id!) as string[];

  const [tickets, leads] = await Promise.all([
    ticketIds.length
      ? db.from("tickets").select("id, status").in("id", Array.from(new Set(ticketIds)))
      : Promise.resolve({ data: [] as { id: string; status: string }[] }),
    leadIds.length
      ? db.from("leads").select("id, stage").in("id", Array.from(new Set(leadIds)))
      : Promise.resolve({ data: [] as { id: string; stage: string }[] }),
  ]);

  const ticketStatus = new Map((tickets.data ?? []).map((t) => [t.id, t.status]));
  const leadStage = new Map((leads.data ?? []).map((l) => [l.id, l.stage]));

  let closed = 0;
  let reopened = 0;
  for (const event of events) {
    if (closed + reopened >= limit) break;
    if (!event.entity_id) continue;
    // Both Converted and Lost are settled work: Outlook only answers "is this
    // still open?", and the reason lives in Resolve where anyone would look.
    const settled =
      event.entity_type === "lead"
        ? ["converted", "lost"].includes(leadStage.get(event.entity_id) ?? "")
        : ticketStatus.get(event.entity_id) === "closed";
    const alreadyClosed = event.status === "closed";
    if (settled === alreadyClosed) continue;

    const storedId = event.external_id as string | null;
    // Only the Graph id addresses a message; the internetMessageId row is a
    // duplicate guard, not something we can PATCH.
    if (!storedId || storedId.startsWith("<")) continue;

    let messageId = storedId;
    let current: string[] = [];
    try {
      const res = await graph(mailboxMessagesPath(`/${encodeURIComponent(messageId)}?$select=id,categories`));
      current = ((await res.json())?.categories ?? []) as string[];
    } catch {
      // The id no longer resolves — almost always because an Outlook rule moved
      // the message into a team folder. Find it again by the id that survives
      // the move rather than abandoning the category lifecycle.
      const twin = events.find(
        (e) => e.entity_id === event.entity_id && typeof e.external_id === "string" && e.external_id.startsWith("<"),
      );
      const relocated = twin?.external_id ? await findByInternetMessageId(twin.external_id as string) : null;
      if (!relocated) continue;
      messageId = relocated.id;
      current = (relocated.categories ?? []) as string[];
    }

    if (settled) {
      if (hasTag(current, CLOSED_TAG) || (await setCategories(messageId, categoriesAfterClose(current)))) {
        await db.from("integration_events").update({ status: "closed" }).eq("id", event.id);
        closed++;
      }
      continue;
    }
    // Reopened: the same mapping goes back to "ticket created". No new record.
    if (hasTag(current, CREATED_TAG) || (await setCategories(messageId, categoriesAfterReopen(current)))) {
      await db.from("integration_events").update({ status: "created" }).eq("id", event.id);
      reopened++;
    }

  }
  return { closed, reopened };
}

export type MailboxRecord = {
  id: string;
  status: string;
  error_message: string | null;
  entity_id: string | null;
  entity_type?: string | null;
  external_id: string;
  conversation_id?: string | null;
  created_at: string;
};

/** The row already held for this message under either of its ids, if any. */
export async function priorRecord(db: Db, messageIds: string[]): Promise<MailboxRecord | null> {
  if (!messageIds.length) return null;
  const { data } = await db
    .from("integration_events")
    .select("id, status, error_message, entity_id, entity_type, external_id, conversation_id, created_at")
    .eq("system", SYSTEM)
    .eq("operation", OPERATION)
    .in("external_id", messageIds)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0] as MailboxRecord | undefined) ?? null;
}

/**
 * The record this thread already produced, if any.
 *
 * This is what stops a second Ticket appearing when someone categorises a
 * later reply in a conversation Resolve has already turned into work.
 */
export async function conversationRecord(
  db: Db,
  conversationId: string | null,
  excludeIds: string[] = [],
): Promise<MailboxRecord | null> {
  if (!conversationId) return null;
  const { data } = await db
    .from("integration_events")
    .select("id, status, error_message, entity_id, entity_type, external_id, conversation_id, created_at")
    .eq("system", SYSTEM)
    .eq("operation", OPERATION)
    .eq("conversation_id", conversationId)
    .not("entity_id", "is", null)
    .in("status", ["created", "linked", "closed"])
    .order("created_at", { ascending: true })
    .limit(5);
  const rows = (data ?? []) as MailboxRecord[];
  return rows.find((r) => !excludeIds.includes(r.external_id)) ?? null;
}

/**
 * A claim left behind by a pass that died mid-flight.
 *
 * Only a `processing` row can go stale. A settled row — created, linked,
 * skipped or failed — is a decision, and re-creating against it would be the
 * duplicate we are guarding against.
 */
export function isStaleClaim(row: MailboxRecord, now = Date.now()) {
  if (!row || row.status !== "processing") return false;
  return now - new Date(row.created_at).getTime() > CLAIM_STALE_MS;
}

/**
 * What this pass should do with a message, given whatever record already
 * exists for it.
 *
 * - `create` — nothing on file, or only an abandoned claim.
 * - `retag`  — a record exists but the Outlook category update failed; retry
 *              only the category. Never a second record.
 * - `skip`   — a settled decision, or another pass currently holds the claim.
 */
export function nextActionFor(prior: MailboxRecord | null, now = Date.now()): "create" | "retag" | "skip" {
  if (!prior) return "create";
  if (isStaleClaim(prior, now)) return "create";
  if (prior.error_message === CATEGORY_PENDING && prior.entity_id) return "retag";
  return "skip";
}

/**
 * Takes ownership of a message before any record is created.
 *
 * The unique index on (system, operation, external_id) is what actually
 * settles a race: whichever pass inserts first wins, and the other gets a
 * 23505 and walks away empty-handed instead of opening a twin.
 */
export async function claimMessage(db: Db, msg: GraphMessage, stale: MailboxRecord | null) {
  const ids = Array.from(new Set([msg.id, msg.internetMessageId ?? ""].filter(Boolean)));
  if (stale) {
    // Reclaiming an abandoned attempt: re-stamp it rather than insert a twin.
    const { error } = await db
      .from("integration_events")
      .update({ status: "processing", error_message: null, created_at: new Date().toISOString() })
      .eq("system", SYSTEM)
      .eq("operation", OPERATION)
      .in("external_id", ids)
      .eq("status", "processing");
    return !error;
  }
  const { error } = await db.from("integration_events").insert(
    ids.map((external_id) => ({
      system: SYSTEM,
      direction: "inbound",
      operation: OPERATION,
      external_id,
      conversation_id: msg.conversationId ?? null,
      status: "processing",
      resolved_at: null,
    })),
  );
  if (!error) return true;
  // 23505 means another pass claimed it a moment ago — the correct outcome.
  if ((error as { code?: string }).code !== "23505") {
    console.error("Could not claim mailbox message:", error.message);
  }
  return false;
}

/** Turns the claim into the durable mapping of what happened to the message. */
async function settleClaim(
  db: Db,
  messageIds: string[],
  outcome: {
    status: string;
    entityType: string | null | undefined;
    entityId: string | null;
    error: string | null;
    conversationId: string | null;
    source: OutlookSource;
  },
) {
  const { error } = await db
    .from("integration_events")
    .update({
      status: outcome.status,
      entity_type: outcome.entityType ?? null,
      entity_id: outcome.entityId,
      conversation_id: outcome.conversationId,
      error_message: outcome.error,
      request_payload: outcome.source as unknown as Database["public"]["Tables"]["integration_events"]["Row"]["request_payload"],
      resolved_at: outcome.status === "failed" ? null : new Date().toISOString(),
    })
    .eq("system", SYSTEM)
    .eq("operation", OPERATION)
    .in("external_id", messageIds);
  if (error) console.error("Could not settle mailbox claim:", error.message);
}

/**
 * Retries only the Outlook category for a message whose record already exists.
 *
 * No record is created or touched here — the row's `entity_id` proves one was
 * already saved, which is precisely why this path is a retag and nothing more.
 */
export async function retryCategory(db: Db, msg: GraphMessage, prior: MailboxRecord) {
  if (!prior.entity_id) return false;
  if (!requestsRecord(msg.categories)) {
    // Someone re-tagged it by hand; nothing left to retry.
    await db.from("integration_events").update({ error_message: null }).eq("id", prior.id);
    return false;
  }
  const done = await setCategories(msg.id, categoriesAfterCreate(msg.categories));
  if (done) {
    await db
      .from("integration_events")
      .update({ error_message: null, resolved_at: new Date().toISOString() })
      .eq("system", SYSTEM)
      .eq("operation", OPERATION)
      .in("external_id", [msg.id, msg.internetMessageId ?? ""].filter(Boolean));
  }
  return done;
}

async function recordEvent(
  db: Db,
  msg: GraphMessage,
  status: string,
  error: string | null,
  entity: { entityType: string | null; entityId: string | null },
) {
  // Both ids are recorded so neither a Graph id change nor a redelivery under
  // the same internet id can produce a second record.
  const ids = Array.from(new Set([msg.id, msg.internetMessageId ?? ""].filter(Boolean)));
  const rows = ids.map((external_id) => ({
    system: SYSTEM,
    direction: "inbound",
    operation: OPERATION,
    external_id,
    conversation_id: msg.conversationId ?? null,
    entity_type: entity.entityType,
    entity_id: entity.entityId,
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
    .select("id, status, error_message, created_at, entity_id, entity_type, external_id, conversation_id, request_payload")
    .eq("system", SYSTEM)
    .eq("operation", OPERATION)
    .not("external_id", "like", "<%")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return data ?? [];
}

/** The Outlook provenance held for a Ticket or Lead, if it came from email. */
export async function outlookSourceFor(db: Db, entityType: "ticket" | "lead", entityId: string) {
  const { data } = await db
    .from("integration_events")
    .select("request_payload, status, created_at")
    .eq("system", SYSTEM)
    .eq("operation", OPERATION)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .not("request_payload", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.request_payload) return null;
  return {
    ...(data.request_payload as unknown as OutlookSource),
    syncState: data.status as string,
    linkedAt: data.created_at as string,
  };
}

export { CREATE_TICKET_TAG, CREATE_LEAD_TAG, CREATED_TAG, CLOSED_TAG };
