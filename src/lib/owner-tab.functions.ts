/**
 * Property page Part 2: server functions for the Owner tab, the project chat, Ask the owner,
 * weekly owner updates and the Integrations email retry. Every write is caller authenticated and
 * goes through the staged RPCs (docs/pending/property-page-part2); permissions are enforced there.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const NOT_YET = "This part is not switched on yet. It starts once the Admin approves the database change.";

function friendly(e: { message?: string; code?: string } | null | undefined, missing: (x: typeof e) => boolean): never {
  if (missing(e)) throw new Error(NOT_YET);
  throw new Error(e?.message ?? "Something went wrong. Please try again.");
}

export const readOwnerTabFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const { readOwnerTab } = await import("@/lib/owner-tab.server");
    return readOwnerTab(context.supabase as never, context.userId, data.propertyId);
  });

export const logOwnerContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid, kind: z.enum(["call", "text"]), body: z.string().trim().min(3).max(4000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    const r = await context.supabase.rpc("log_owner_contact" as never, { _property_id: data.propertyId, _kind: data.kind, _body: data.body } as never);
    if (r.error) friendly(r.error, isStagedMissing);
    return { id: r.data as unknown as string };
  });

export const saveGoodToKnowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ownerId: uuid, notes: z.string().max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    const r = await context.supabase.rpc("set_owner_team_notes" as never, { _owner_id: data.ownerId, _notes: data.notes } as never);
    if (r.error) friendly(r.error, isStagedMissing);
    return { at: (r.data as unknown as string | null) ?? null };
  });

/** 2.3: one owner item the owner can reply to, approve when it asks for approval, and log time on. */
export const askOwnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      propertyId: uuid,
      question: z.string().trim().min(3).max(4000),
      needsApproval: z.boolean().default(false),
      dueOn: z.string().date().nullable().default(null),
      taskId: uuid.nullable().default(null),
      documentIds: z.array(uuid).max(10).default([]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { loadOwnerTabViewer, isStagedMissing } = await import("@/lib/owner-tab.server");
    const { ownerTabRights } = await import("@/lib/owner-tab");
    const rights = ownerTabRights(await loadOwnerTabViewer(context.supabase as never, context.userId, data.propertyId));
    if (!rights.askOwner) throw new Error("Only the home's team, the Director of Onboarding or an Admin can ask the owner.");
    const firstLine = data.question.split("\n")[0]!.trim();
    const title = firstLine.length > 120 ? `${firstLine.slice(0, 117).trimEnd()}...` : firstLine.length >= 3 ? firstLine : "A question from ARHA";
    const { vagueOpportunityReason } = await import("./owner-opportunity");
    const vague = vagueOpportunityReason(title, data.question);
    if (vague) throw new Error(vague);
    const { data: id, error } = await context.supabase.rpc("save_arha_opportunity", {
      _id: null as unknown as string,
      _property_id: data.propertyId,
      _source_task_id: data.taskId as string,
      _title: title,
      _content: { title, what: data.question, why: "", how: "", resources: [], ways_to_document: "", suggested_minutes: null },
      _response_types: data.needsApproval ? ["decision"] : ["feedback"],
      _resources: data.documentIds.map((document_id) => ({ kind: "file", document_id })),
      _send: true,
    } as never);
    if (error) throw new Error(error.message);
    let dueSaved = true;
    if (data.dueOn) {
      const due = await context.supabase.rpc("set_owner_item_due" as never, { _id: id, _due_on: data.dueOn } as never);
      if (due.error) {
        if (!isStagedMissing(due.error)) throw new Error(due.error.message);
        dueSaved = false;
      }
    }
    return { id: id as unknown as string, dueSaved };
  });

/** "Send a reminder now" by text: the text opens on the person's phone, and Resolve writes it down. */
export const logReminderNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid, title: z.string().trim().min(1).max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    const r = await context.supabase.rpc("log_owner_contact" as never, { _property_id: data.propertyId, _kind: "text", _body: `Sent a reminder: ${data.title}` } as never);
    if (r.error) friendly(r.error, isStagedMissing);
    return { ok: true };
  });

/* ------------------------------------------------------------------ chat */

export const readHomeChatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid, kind: z.enum(["owner", "team"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { readHomeChat } = await import("@/lib/owner-tab.server");
    return readHomeChat(context.supabase as never, context.userId, data.propertyId, data.kind);
  });

export const postHomeChatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      propertyId: uuid,
      kind: z.enum(["owner", "team"]),
      body: z.string().max(4000),
      attachments: z.array(z.object({ document_id: uuid, name: z.string().max(300), folder: z.enum(["property_ownership", "hoa_compliance", "systems_manuals", "onboarding", "operations", "media"]) })).max(10).default([]),
      mentions: z.array(uuid).max(20).default([]),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    const r = await context.supabase.rpc("post_home_chat_message" as never, {
      _property_id: data.propertyId, _kind: data.kind, _body: data.body, _attachments: data.attachments, _mentions: data.mentions,
    } as never);
    if (r.error) friendly(r.error, isStagedMissing);
    return { id: r.data as unknown as string };
  });

export const markHomeChatReadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ chatId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("mark_home_chat_read" as never, { _chat_id: data.chatId } as never);
    if (r.error) throw new Error(r.error.message);
    return { at: r.data as unknown as string };
  });

/** The Chats inbox: homes with unread messages for the viewer, newest first. */
export const homeChatInboxFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    const r = await context.supabase.rpc("my_home_chat_inbox" as never);
    if (isStagedMissing(r.error)) return { staged: false, rows: [] as InboxRow[] };
    if (r.error) throw new Error(r.error.message);
    return { staged: true, rows: (r.data ?? []) as unknown as InboxRow[] };
  });
export type InboxRow = { property_id: string; home: string; kind: "owner" | "team"; unread: number; last_at: string };

export const linkChatTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ messageId: uuid, taskId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await context.supabase.rpc("link_chat_message_task" as never, { _message_id: data.messageId, _task_id: data.taskId } as never);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

/** A short-lived link to a chat attachment, only for someone who can read that message. */
export const chatAttachmentUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ messageId: uuid, documentId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const msg = await context.supabase.from("home_chat_messages" as never).select("attachments").eq("id", data.messageId).maybeSingle();
    const att = ((msg.data as { attachments?: { document_id: string }[] } | null)?.attachments ?? []);
    if (!att.some((a) => a.document_id === data.documentId)) throw new Error("This file is not available to you.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ATTACHMENT_BUCKET } = await import("@/lib/attachments");
    const doc = await supabaseAdmin.from("documents").select("storage_path").eq("id", data.documentId).maybeSingle();
    if (!doc.data?.storage_path) throw new Error("This file could not be found.");
    const signed = await supabaseAdmin.storage.from(ATTACHMENT_BUCKET).createSignedUrl(doc.data.storage_path, 300);
    if (signed.error || !signed.data) throw new Error("This file could not be opened. Please try again.");
    return { url: signed.data.signedUrl };
  });

/* ------------------------------------------------------------------ weekly update */

export const saveWeeklyTextFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, text: z.string().max(8000) }).parse(d))
  .handler(async ({ context, data }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    const r = await context.supabase.rpc("save_weekly_update_text" as never, { _id: data.id, _text: data.text } as never);
    if (r.error) friendly(r.error, isStagedMissing);
    return { ok: true };
  });

/**
 * Send to the owner: the portal and email for an owner with a portal; owners without one get the
 * email from the signed-in person's mailbox (EmailComposer), found here by its saved delivery.
 */
export const sendWeeklyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, text: z.string().trim().min(10).max(8000), emailedSubject: z.string().max(300).nullable().default(null) }).parse(d))
  .handler(async ({ context, data }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    let emailLogId: string | null = null;
    if (data.emailedSubject) {
      const u = await context.supabase.from("owner_weekly_updates" as never).select("property_id").eq("id", data.id).maybeSingle();
      const prop = (u.data as { property_id?: string } | null)?.property_id;
      if (prop) {
        const e = await context.supabase.from("email_log").select("id").eq("entity_type", "property").eq("entity_id", prop)
          .eq("subject", data.emailedSubject).eq("sent_by", context.userId).eq("status", "sent")
          .gte("created_at", new Date(Date.now() - 15 * 60_000).toISOString()).order("created_at", { ascending: false }).limit(1).maybeSingle();
        emailLogId = (e.data as { id?: string } | null)?.id ?? null;
      }
    }
    const r = await context.supabase.rpc("send_weekly_update" as never, { _id: data.id, _text: data.text, _email_log_id: emailLogId } as never);
    if (r.error) friendly(r.error, isStagedMissing);
    return r.data as unknown as { notification_id: string | null; email_log_id: string | null };
  });

export const setWeeklySwitchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid, autoSend: z.boolean().nullable().default(null), paused: z.boolean().nullable().default(null) }).parse(d))
  .handler(async ({ context, data }) => {
    const { isStagedMissing } = await import("@/lib/owner-tab.server");
    const r = await context.supabase.rpc("set_weekly_update_switch" as never, { _property_id: data.propertyId, _auto_send: data.autoSend, _paused: data.paused } as never);
    if (r.error) friendly(r.error, isStagedMissing);
    return { ok: true };
  });

/* ------------------------------------------------------------------ Integrations: failed emails (2.7) */

async function requireAdmin(sb: { rpc: (n: never, a: never) => PromiseLike<{ data: unknown }> }, uid: string) {
  const r = await sb.rpc("has_role" as never, { _user_id: uid, _role: "admin" } as never);
  if (r.data !== true) throw new Error("Only an Admin can retry emails.");
}

export type FailedEmail = { audience: "owner" | "staff"; id: string; title: string; error: string | null; at: string };

export const listFailedEmailsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [o, s] = await Promise.all([
      supabaseAdmin.from("owner_notifications").select("id, title, delivery_error, created_at").eq("email_status", "failed").eq("is_demo", false).order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("staff_notifications").select("id, title, email_error, created_at").eq("email_status", "failed").eq("is_demo", false).order("created_at", { ascending: false }).limit(100),
    ]);
    const rows: FailedEmail[] = [
      ...(o.data ?? []).map((r) => ({ audience: "owner" as const, id: r.id, title: r.title, error: r.delivery_error, at: r.created_at })),
      ...(s.data ?? []).map((r) => ({ audience: "staff" as const, id: r.id, title: r.title, error: r.email_error, at: r.created_at })),
    ].sort((a, b) => b.at.localeCompare(a.at));
    return { rows };
  });

/** Retry one failed email, or every one: back in the queue for the next five-minute run. Never automatic. */
export const retryFailedEmailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ audience: z.enum(["owner", "staff"]).nullable().default(null), id: uuid.nullable().default(null) }).parse(d))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { writeAudit } = await import("@/lib/audit.server");
    let count = 0;
    const one = !!data.id;
    if (!one || data.audience === "owner") {
      let q = supabaseAdmin.from("owner_notifications").update({ email_status: "pending", delivery_error: null }).eq("email_status", "failed").eq("is_demo", false);
      if (data.id) q = q.eq("id", data.id);
      const r = await q.select("id");
      if (r.error) throw new Error(r.error.message);
      count += r.data?.length ?? 0;
    }
    if (!one || data.audience === "staff") {
      let q = supabaseAdmin.from("staff_notifications").update({ email_status: "pending", email_error: null, email_attempts: 0 }).eq("email_status", "failed").eq("is_demo", false);
      if (data.id) q = q.eq("id", data.id);
      const r = await q.select("id");
      if (r.error) throw new Error(r.error.message);
      count += r.data?.length ?? 0;
    }
    await writeAudit({ actorId: context.userId, action: one ? "failed_email_retry" : "failed_email_retry_all", entityType: data.audience ? `${data.audience}_notification` : "email", entityId: data.id ?? null, after: { count } } as never);
    return { count };
  });

/** About the owner: the preferred method, changed by the PM, the Director of Onboarding or an Admin. */
export const setOwnerPreferredFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid, method: z.enum(["text", "call", "email", "telegram"]).nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    const { loadOwnerTabViewer } = await import("@/lib/owner-tab.server");
    const { ownerTabRights } = await import("@/lib/owner-tab");
    const rights = ownerTabRights(await loadOwnerTabViewer(context.supabase as never, context.userId, data.propertyId));
    if (!rights.editPreferred) throw new Error("Only the Project Manager, the Director of Onboarding or an Admin can change this.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const home = await supabaseAdmin.from("properties").select("owner_record_id").eq("id", data.propertyId).maybeSingle();
    const ownerId = home.data?.owner_record_id;
    if (!ownerId) throw new Error("No owner is on file for this home.");
    const rec = await supabaseAdmin.from("property_owners").select("name, email, phone, co_owner_name, co_owner_email, co_owner_phone").eq("id", ownerId).maybeSingle();
    if (!rec.data) throw new Error("That owner record could not be found.");
    const hub = await import("@/lib/property-hub.server");
    const m = await import("@/lib/owner-link.server");
    const viewer = await hub.loadViewer(context.supabase, context.userId);
    return m.updateOwnerRecord(viewer, {
      ownerId,
      name: rec.data.name ?? "Owner",
      email: rec.data.email,
      phone: rec.data.phone,
      coOwnerName: rec.data.co_owner_name,
      coOwnerEmail: rec.data.co_owner_email,
      coOwnerPhone: rec.data.co_owner_phone,
      preferredMethod: data.method,
    });
  });
