/**
 * Email → Lead (server-only).
 *
 * A coordinator marks a message "Resolve: lead management- create a ticket"
 * and it becomes a row in the existing Tenant Lead workflow — same stages,
 * same derived follow-up engine, same screens. There is no second lead
 * pipeline for Outlook; only the provenance differs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { deriveLeadFromEmail, type OutlookSource } from "./outlook-email";

type Db = SupabaseClient<Database>;
type LeadSource = Database["public"]["Enums"]["lead_source"];

const KNOWN_SOURCES: LeadSource[] = [
  "insurance",
  "relocation",
  "corporate",
  "direct",
  "referral",
  "realtor",
  "website",
  "phone",
  "email",
  "social",
  "other",
];

export type LeadIntakeResult = { leadId: string; contactName: string; source: LeadSource };

export async function createLeadFromEmail(
  db: Db,
  input: { subject: string; body: string; source: OutlookSource },
): Promise<LeadIntakeResult> {
  const derived = deriveLeadFromEmail({
    subject: input.subject,
    body: input.body,
    fromName: input.source.fromName,
    fromAddress: input.source.fromAddress,
  });

  // A source we could not read from the email is recorded as "email" and
  // flagged, so the coordinator sets the real one rather than the record
  // silently claiming a channel it never came from.
  const confident = derived.source && (KNOWN_SOURCES as string[]).includes(derived.source);
  const source = (confident ? derived.source : "email") as LeadSource;

  const { data, error } = await db
    .from("leads")
    .insert({
      contact_name: derived.contact_name,
      email: derived.email,
      phone: derived.phone,
      company: derived.company,
      preferred_channel: "email",
      source,
      source_detail: {
        origin: "outlook",
        source_confirmed: Boolean(confident),
        mailbox: input.source.mailbox,
        message_id: input.source.messageId,
        internet_message_id: input.source.internetMessageId,
        conversation_id: input.source.conversationId,
        subject: input.source.subject,
        from_name: input.source.fromName,
        from_address: input.source.fromAddress,
        to_recipients: input.source.toRecipients,
        received_at: input.source.receivedAt,
        web_link: input.source.webLink,
        has_attachments: input.source.hasAttachments,
        attachments: input.source.attachments,
      },
      stage: "new",
      requirements: derived.requirements,
      notes: derived.notes,
    })
    .select("id, contact_name, source")
    .single();

  if (error) throw new Error(error.message);

  await db.from("lead_activity").insert({
    lead_id: data.id,
    channel: "email",
    direction: "inbound",
    summary: `Created from an Outlook email: ${input.source.subject}`.slice(0, 300),
    body: input.body.slice(0, 4000) || null,
    occurred_at: input.source.receivedAt ?? new Date().toISOString(),
  });

  return { leadId: data.id, contactName: data.contact_name, source: data.source as LeadSource };
}
