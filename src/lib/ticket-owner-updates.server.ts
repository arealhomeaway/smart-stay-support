import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readCountedRows } from "./read-all-rows";

export async function loadTicketOwnerUpdates(
  db: SupabaseClient<Database>,
  userId: string,
  ticketId: string,
) {
  const access = await db.rpc("is_internal_staff", { _user_id: userId });
  if (access.error) throw access.error;
  if (!access.data) throw new Error("Only staff may review owner updates.");
  const ticket = await db
    .from("tickets")
    .select("id, updated_at, property_id")
    .eq("id", ticketId)
    .single();
  if (ticket.error) throw ticket.error;
  if (!ticket.data.property_id) throw new Error("This Ticket has no Property.");
  const property = await db
    .from("properties")
    .select("owner_record_id")
    .eq("id", ticket.data.property_id)
    .single();
  if (property.error) throw property.error;
  if (!property.data.owner_record_id)
    throw new Error("Link the Property to its canonical Owner first.");
  const history = await readCountedRows(
    db
      .from("ticket_owner_updates")
      .select("*", { count: "exact" })
      .eq("ticket_id", ticketId)
      .order("revision", { ascending: false }),
  );
  return {
    ticket: ticket.data,
    ownerRecordId: property.data.owner_record_id,
    history: history.data,
  };
}
