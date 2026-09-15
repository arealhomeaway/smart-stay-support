import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Recheck a queued Ticket alert against current canonical relationships before delivery. */
export async function ticketAlertRecipient(
  db: SupabaseClient<Database>,
  alert: { program_id: string; ticket_id: string; owner_user_id: string | null },
) {
  const program = await db
    .from("owner_programs")
    .select("id, owner_record_id, owner_user_id, status, archived_at, is_demo")
    .eq("id", alert.program_id)
    .single();
  if (program.error) throw program.error;
  const p = program.data;
  if (
    !p.owner_record_id ||
    p.is_demo ||
    p.archived_at ||
    !["pending", "active"].includes(p.status) ||
    p.owner_user_id !== alert.owner_user_id
  )
    throw new Error("Ticket alert program identity or delivery eligibility changed.");
  const ticket = await db
    .from("tickets")
    .select("id, property_id, ref, is_demo")
    .eq("id", alert.ticket_id)
    .single();
  if (ticket.error) throw ticket.error;
  if (!ticket.data.property_id || ticket.data.is_demo)
    throw new Error("Ticket alert has no eligible property.");
  const property = await db
    .from("properties")
    .select("id, owner_record_id, is_demo")
    .eq("id", ticket.data.property_id)
    .single();
  if (property.error) throw property.error;
  if (property.data.is_demo || property.data.owner_record_id !== p.owner_record_id)
    throw new Error("Ticket alert Property no longer belongs to this canonical Owner.");
  const enrollment = await db
    .from("owner_program_properties")
    .select("program_id, property_id, inclusion_status")
    .eq("program_id", p.id)
    .eq("property_id", property.data.id)
    .eq("inclusion_status", "included")
    .maybeSingle();
  if (enrollment.error) throw enrollment.error;
  if (!enrollment.data) throw new Error("Ticket alert Property is no longer enrolled.");
  const owner = await db
    .from("property_owners")
    .select("id, name, email, phone, active")
    .eq("id", p.owner_record_id)
    .single();
  if (owner.error) throw owner.error;
  if (!owner.data.active) throw new Error("Ticket alert canonical Owner is inactive.");
  return {
    owner_email: owner.data.email,
    owner_phone: owner.data.phone,
    owner_name: owner.data.name,
    ticketRef: ticket.data.ref,
  };
}
