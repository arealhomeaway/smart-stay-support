/**
 * Contextual Email Composer — server calls.
 *
 * Any operations employee can write and send from the shared mailbox on a
 * record they can already open. Only supervisors can add or change the
 * templates everyone shares.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ComposerContext, MessageAudience } from "./email-composer";

const CONTEXTS = ["ticket", "work_order", "property", "onboarding_task"];
const AUDIENCES = ["guest", "owner", "vendor", "staff"];

type Ctx = { supabase: { rpc: (name: string, args: unknown) => Promise<{ data: unknown }> } & Record<string, unknown>; userId: string };

async function assertStaff(context: Ctx) {
  const { data } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
  if (!data) throw new Error("Only the operations team can send messages from Resolve.");
}

async function assertSupervisor(context: Ctx) {
  const { data } = await context.supabase.rpc("is_supervisor", { _user_id: context.userId });
  if (!data) throw new Error("Only supervisors can change the shared templates.");
}

type ProfileBits = { full_name: string | null; email_signature: string | null };

async function senderProfile(context: Ctx): Promise<ProfileBits> {
  const { data } = await (context.supabase as never as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: ProfileBits | null }> };
      };
    };
  })
    .from("profiles")
    .select("full_name, email_signature")
    .eq("id", context.userId)
    .maybeSingle();
  return { full_name: data?.full_name ?? null, email_signature: data?.email_signature ?? null };
}

/**
 * Saves the writer's own sign-off on their profile. Each person keeps their
 * own; nobody can write anyone else's, because the row is their own row.
 */
export const saveMySignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { signature: string }) => {
    const signature = (input?.signature ?? "").trim();
    if (signature.length > 600) throw new Error("Keep the signature under 600 characters.");
    return { signature };
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context as never as Ctx);
    const { error } = await context.supabase
      .from("profiles")
      .update({ email_signature: data.signature || null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { signature: data.signature || null };
  });

/** Recipients, merge values and the shared templates for one record. */
export const getComposerContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { context: ComposerContext; recordId: string }) => {
    if (!CONTEXTS.includes(input?.context)) throw new Error("Unknown record type.");
    if (!input?.recordId) throw new Error("Pick a record to write about.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context as never as Ctx);
    const { gatherComposerContext, loadPreviousContacts } = await import(
      "./email-composer.server"
    );
    const name = await senderName(context as never as Ctx);
    const gathered = await gatherComposerContext(
      context.supabase as never,
      data.context,
      data.recordId,
      name,
    );
    const previousContacts = await loadPreviousContacts(
      context.supabase as never,
      gathered.recipients.map((r) => r.email),
    );

    const { data: templates } = await context.supabase
      .from("email_templates")
      .select("id, name, audience, contexts, subject, body")
      .eq("active", true)
      .order("name");

    const { data: canManage } = await context.supabase.rpc("is_supervisor", {
      _user_id: context.userId,
    });

    return {
      ...gathered,
      previousContacts,
      canManageTemplates: Boolean(canManage),
      templates: (templates ?? []).filter((t) =>
        ((t["contexts"] as string[] | null) ?? []).includes(data.context),
      ),
    };
  });

/** Everything already sent about this record. */
export const getMessageHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { context: ComposerContext; recordId: string }) => {
    if (!CONTEXTS.includes(input?.context)) throw new Error("Unknown record type.");
    if (!input?.recordId) throw new Error("Pick a record.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertStaff(context as never as Ctx);
    const { data: rows } = await context.supabase
      .from("email_log")
      .select("id, recipient, subject, body, status, error_message, sent_at, created_at, sent_by")
      .eq("entity_type", data.context)
      .eq("entity_id", data.recordId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { rows: rows ?? [] };
  });

/** Sends one written message from the shared mailbox. */
export const sendComposedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      context: ComposerContext;
      recordId: string;
      to: string;
      subject: string;
      body: string;
      audience: MessageAudience;
      templateId?: string | null;
      toAdditional?: string[];
      cc?: string[];
      bcc?: string[];
      /** Send later: the exact instant, plus the zone the person picked it in. */
      scheduledFor?: string | null;
      scheduledTimeZone?: string | null;
      attachments?: { name: string; contentType: string; contentBytes: string }[];
    }) => {
      if (!CONTEXTS.includes(input?.context)) throw new Error("Unknown record type.");
      if (!input?.recordId) throw new Error("Pick a record.");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test((input?.to ?? "").trim()))
        throw new Error("Add a valid email address to send to.");
      if ((input?.subject ?? "").trim().length < 3) throw new Error("Give the message a subject.");
      if ((input?.body ?? "").trim().length < 10) throw new Error("Write the message.");
      if (!AUDIENCES.includes(input?.audience)) throw new Error("Pick who this is for.");
      const valid = (a: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(a.trim());
      for (const a of [...(input.toAdditional ?? []), ...(input.cc ?? []), ...(input.bcc ?? [])]) {
        if (!valid(a)) throw new Error(`${a} is not a valid email address.`);
      }
      if (input.scheduledFor) {
        const when = new Date(input.scheduledFor);
        if (Number.isNaN(when.getTime())) throw new Error("That send time could not be read.");
        if (when.getTime() <= Date.now()) throw new Error("Pick a send time in the future.");
      }
      const bytes = (input.attachments ?? []).reduce((n, a) => n + a.contentBytes.length, 0);
      if (bytes > 4_000_000) throw new Error("Attachments are too large — keep them under 3 MB.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context as never as Ctx);

    // The record must be readable by this person before anything leaves.
    const { gatherComposerContext } = await import("./email-composer.server");
    const name = await senderName(context as never as Ctx);
    await gatherComposerContext(context.supabase as never, data.context, data.recordId, name);

    const { sendEmail, emailShell } = await import("./email.server");
    const audience = data.audience === "guest" ? "owner" : data.audience;

    // Send later: the message is parked with everything it needs and goes out
    // on its own; nothing leaves the mailbox now.
    if (data.scheduledFor) {
      const { parkScheduledEmail } = await import("./email-composer.server");
      return await parkScheduledEmail(
        {
          context: data.context,
          recordId: data.recordId,
          to: data.to.trim(),
          toAdditional: data.toAdditional ?? [],
          cc: data.cc ?? [],
          bcc: data.bcc ?? [],
          subject: data.subject.trim(),
          body: data.body.trim(),
          audience,
          templateId: data.templateId ?? null,
          scheduledFor: data.scheduledFor,
          scheduledTimeZone: data.scheduledTimeZone ?? null,
          attachments: (data.attachments ?? []).map((a) => ({
            name: a.name,
            contentType: a.contentType,
          })),
        },
        context.userId,
      );
    }

    const result = await sendEmail({
      to: data.to.trim(),
      toAdditional: data.toAdditional ?? [],
      cc: data.cc ?? [],
      bcc: data.bcc ?? [],
      attachments: data.attachments ?? [],
      subject: data.subject.trim(),
      html: emailShell(data.subject.trim(), data.body.trim(), undefined, audience as never),
      purpose: `composed_${data.context}`,
      ticketId: data.context === "ticket" ? data.recordId : null,
      entity: { type: data.context, id: data.recordId },
      bodyText: data.body.trim(),
      sentBy: context.userId,
      templateId: data.templateId ?? null,
    });
    return result;
  });

/** Creates or updates a shared template. Supervisors only. */
export const saveEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      name: string;
      audience: MessageAudience;
      contexts: ComposerContext[];
      subject: string;
      body: string;
      active?: boolean;
    }) => {
      if ((input?.name ?? "").trim().length < 3) throw new Error("Name the template.");
      if (!AUDIENCES.includes(input?.audience)) throw new Error("Pick who it is for.");
      if (!input?.contexts?.length || input.contexts.some((c) => !CONTEXTS.includes(c)))
        throw new Error("Pick where it can be used.");
      if ((input?.subject ?? "").trim().length < 3) throw new Error("Give it a subject line.");
      if ((input?.body ?? "").trim().length < 10) throw new Error("Write the template body.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    await assertSupervisor(context as never as Ctx);
    const row = {
      name: data.name.trim(),
      audience: data.audience,
      contexts: data.contexts,
      subject: data.subject.trim(),
      body: data.body.trim(),
      active: data.active ?? true,
      updated_by: context.userId,
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("email_templates")
        .update(row as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: created, error } = await context.supabase
      .from("email_templates")
      .insert({ ...row, created_by: context.userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
  });

/** Retires a template without touching messages already sent from it. */
export const retireEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Pick a template.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSupervisor(context as never as Ctx);
    const { error } = await context.supabase
      .from("email_templates")
      .update({ active: false, updated_by: context.userId } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
