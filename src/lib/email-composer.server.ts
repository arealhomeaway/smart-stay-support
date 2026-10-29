/**
 * Server-only context gathering for the Contextual Email Composer.
 *
 * Reads happen through the caller's own client, so a person only ever sees
 * contacts on records their role already lets them open.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComposerContext, MergeValues, MessageAudience } from "./email-composer";

export type ComposerRecipient = {
  label: string;
  name: string | null;
  email: string;
  audience: MessageAudience;
};

export type ComposerContextData = {
  heading: string;
  recipients: ComposerRecipient[];
  mergeValues: MergeValues;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const valid = (value: unknown): value is string =>
  typeof value === "string" && EMAIL_RE.test(value.trim());

type Client = SupabaseClient<never, never, never>;

async function propertyBits(supabase: Client, propertyId: string | null) {
  if (!propertyId) return { name: null, address: null, recipients: [] as ComposerRecipient[] };
  const { data: property } = await (supabase as never as Client)
    .from("properties")
    .select("name, nickname, formatted_address, address_line1, unit, city, state, postal_code, ownerrez_property_id")
    .eq("id", propertyId)
    .maybeSingle();

  const { data: contacts } = await (supabase as never as Client)
    .from("property_owner_contacts")
    .select("owner_name, owner_email")
    .eq("property_id", propertyId);

  const row = property as { [k: string]: string | null } | null;
  const recipients: ComposerRecipient[] = ((contacts ?? []) as { [k: string]: string | null }[])
    .filter((c) => valid(c["owner_email"]))
    .map((c) => ({
      label: `Homeowner — ${c["owner_name"] ?? c["owner_email"]}`,
      name: c["owner_name"] ?? null,
      email: String(c["owner_email"]).trim(),
      audience: "owner" as const,
    }));

  return {
    name: row ? formatPropertyLabel(row).primary : null,
    address: row ? formatPropertyLabel(row).full : null,
    recipients,
    ownerName: recipients[0]?.name ?? null,
  };
}

async function vendorRecipients(supabase: Client, orgId: string | null) {
  if (!orgId) return [] as ComposerRecipient[];
  const { data } = await (supabase as never as Client)
    .from("vendor_contacts")
    .select("full_name, email")
    .eq("org_id", orgId);
  return ((data ?? []) as { [k: string]: string | null }[])
    .filter((c) => valid(c["email"]))
    .map((c) => ({
      label: `Vendor — ${c["full_name"] ?? c["email"]}`,
      name: c["full_name"] ?? null,
      email: String(c["email"]).trim(),
      audience: "vendor" as const,
    }));
}

function dedupe(list: ComposerRecipient[]) {
  const seen = new Set<string>();
  return list.filter((r) => {
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type PreviousContact = { email: string; lastSentAt: string | null };

/**
 * Addresses this mailbox has written to before, newest first. Offered as a
 * shortcut only — anything on the record itself is already in the list above,
 * so those are left out rather than shown twice.
 */
export async function loadPreviousContacts(
  supabase: Client,
  exclude: string[] = [],
  limit = 15,
): Promise<PreviousContact[]> {
  const { data } = await (supabase as never as Client)
    .from("email_log")
    .select("recipient, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const skip = new Set(exclude.map((e) => e.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: PreviousContact[] = [];
  for (const row of (data ?? []) as { recipient?: string | null; created_at?: string | null }[]) {
    const address = (row.recipient ?? "").trim();
    if (!valid(address)) continue;
    const key = address.toLowerCase();
    if (skip.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ email: address, lastSentAt: row.created_at ?? null });
    if (out.length >= limit) break;
  }
  return out;
}



export async function gatherComposerContext(
  supabase: Client,
  context: ComposerContext,
  recordId: string,
  senderName: string | null,
): Promise<ComposerContextData> {
  if (context === "property") {
    const property = await propertyBits(supabase, recordId);
    return {
      heading: property.name ?? "Property",
      recipients: dedupe(property.recipients),
      mergeValues: {
        property: property.name,
        property_address: property.address,
        owner_name: property.ownerName,
        sender_name: senderName,
      },
    };
  }

  if (context === "onboarding_task") {
    const { data } = await (supabase as never as Client)
      .from("onboarding_tasks")
      .select("title, detail, property_id, due_on, stage")
      .eq("id", recordId)
      .maybeSingle();
    const task = (data ?? {}) as { [k: string]: string | null };
    const property = await propertyBits(supabase, task["property_id"] ?? null);
    return {
      heading: task["title"] ?? "Onboarding step",
      recipients: dedupe(property.recipients),
      mergeValues: {
        property: property.name,
        property_address: property.address,
        owner_name: property.ownerName,
        task_title: task["title"],
        task_due: task["due_on"] ? new Date(`${task["due_on"]}T00:00:00`).toLocaleDateString("en-US") : null,
        sender_name: senderName,
      },
    };
  }

  if (context === "work_order") {
    const { data } = await (supabase as never as Client)
      .from("work_orders")
      .select("title, scope, vendor_name, vendor_org_id, property_id, scheduled_for, ticket_id")
      .eq("id", recordId)
      .maybeSingle();
    const order = (data ?? {}) as { [k: string]: string | null };
    const property = await propertyBits(supabase, order["property_id"] ?? null);
    const vendors = await vendorRecipients(supabase, order["vendor_org_id"] ?? null);

    return {
      heading: order["title"] ?? "Work Order",
      recipients: dedupe([...vendors, ...property.recipients]),
      mergeValues: {
        property: property.name,
        property_address: property.address,
        owner_name: property.ownerName,
        vendor_name: order["vendor_name"],
        work_order_title: order["title"],
        scheduled_for: order["scheduled_for"]
          ? new Date(order["scheduled_for"]).toLocaleString("en-US")
          : null,
        sender_name: senderName,
      },
    };
  }

  const { data } = await (supabase as never as Client)
    .from("tickets")
    .select("ref, title, guest_name, guest_contact, property_id, vendor_name")
    .eq("id", recordId)
    .maybeSingle();
  const ticket = (data ?? {}) as { [k: string]: string | null };
  const property = await propertyBits(supabase, ticket["property_id"] ?? null);

  const guest: ComposerRecipient[] = valid(ticket["guest_contact"])
    ? [
        {
          label: `Guest — ${ticket["guest_name"] ?? ticket["guest_contact"]}`,
          name: ticket["guest_name"] ?? null,
          email: String(ticket["guest_contact"]).trim(),
          audience: "guest" as const,
        },
      ]
    : [];

  return {
    heading: ticket["ref"] ? `${ticket["ref"]} — ${ticket["title"] ?? ""}`.trim() : "Ticket",
    recipients: dedupe([...guest, ...property.recipients]),
    mergeValues: {
      property: property.name,
      property_address: property.address,
      owner_name: property.ownerName,
      guest_name: ticket["guest_name"],
      vendor_name: ticket["vendor_name"],
      ticket_ref: ticket["ref"],
      ticket_title: ticket["title"],
      sender_name: senderName,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Send later.
 *
 * A scheduled message is parked in the delivery log with everything it
 * needs, and a later pass sends it. Nothing is held in a browser tab, so
 * closing the laptop does not cancel it.
 * ------------------------------------------------------------------ */

export type ParkedEmail = {
  context: string;
  recordId: string;
  to: string;
  toAdditional: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  audience: string;
  templateId: string | null;
  scheduledFor: string;
  scheduledTimeZone: string | null;
  attachments: { name: string; contentType: string }[];
};

export async function parkScheduledEmail(email: ParkedEmail, sentBy: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("email_log").insert({
    recipient: email.to,
    to_additional: email.toAdditional,
    cc: email.cc,
    bcc: email.bcc,
    subject: email.subject.slice(0, 300),
    body: email.body,
    purpose: `composed_${email.context}`,
    sender: null,
    status: "scheduled",
    attempts: 0,
    entity_type: email.context,
    entity_id: email.recordId,
    ticket_id: email.context === "ticket" ? email.recordId : null,
    sent_by: sentBy,
    template_id: email.templateId,
    scheduled_for: email.scheduledFor,
    scheduled_time_zone: email.scheduledTimeZone,
    attachments: email.attachments,
  } as never);
  if (error) return { status: "failed" as const, error: error.message };
  return { status: "scheduled" as const, error: null };
}

/**
 * Sends every parked message whose time has come. Safe to run repeatedly —
 * a row is claimed before it is sent, so a second pass never doubles up.
 */
export async function drainScheduledEmails(now = new Date(), jobRunId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail, emailShell } = await import("./email.server");

  const { data: due } = await supabaseAdmin
    .from("email_log")
    .select("id, recipient, to_additional, cc, bcc, subject, body, entity_type, entity_id, sent_by, template_id")
    .eq("status", "scheduled")
    .lte("scheduled_for", now.toISOString())
    .limit(25);

  let sent = 0;
  const notes: string[] = [];
  for (const row of (due ?? []) as unknown as Record<string, unknown>[]) {
    // Claim it first: only the pass that flips it off "scheduled" may send it.
    const { data: claimed } = await supabaseAdmin
      .from("email_log")
      .update({ status: "sending" } as never)
      .eq("id", String(row["id"]))
      .eq("status", "scheduled")
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    const subject = String(row["subject"] ?? "");
    const body = String(row["body"] ?? "");
    const result = await sendEmail({
      to: String(row["recipient"] ?? ""),
      toAdditional: (row["to_additional"] as string[] | null) ?? [],
      cc: (row["cc"] as string[] | null) ?? [],
      bcc: (row["bcc"] as string[] | null) ?? [],
      subject,
      html: emailShell(subject, body, undefined, "owner" as never),
      purpose: `composed_${String(row["entity_type"] ?? "record")}`,
      entity:
        row["entity_type"] && row["entity_id"]
          ? { type: String(row["entity_type"]), id: String(row["entity_id"]) }
          : null,
      bodyText: body,
      sentBy: (row["sent_by"] as string | null) ?? null,
      templateId: (row["template_id"] as string | null) ?? null,
      ...(jobRunId ? { jobRunId, jobPart: "scheduled" } : {}),
    });

    // sendEmail writes its own delivery record; this row becomes its receipt.
    await supabaseAdmin
      .from("email_log")
      .update({
        status: result.status,
        error_message: result.error ?? null,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
      } as never)
      .eq("id", String(row["id"]));
    if (result.status === "sent") sent += 1;
    if (result.status === "failed") notes.push(result.error);
  }
  return { considered: (due ?? []).length, sent, notes };
}
