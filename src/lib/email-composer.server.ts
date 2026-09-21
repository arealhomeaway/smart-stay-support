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
    .select("name, nickname, formatted_address, address_line1")
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
    name: row?.["nickname"] ?? row?.["name"] ?? null,
    address: row?.["formatted_address"] ?? row?.["address_line1"] ?? null,
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
