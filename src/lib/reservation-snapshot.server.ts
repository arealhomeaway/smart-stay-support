/**
 * Ticket-time OwnerRez reservation snapshot (server-only).
 *
 * When a ticket is logged for a home that is linked to an OwnerRez listing and
 * OwnerRez reports exactly ONE stay in residence, we freeze the human-readable
 * context onto the ticket so the crew can work it later even if the OwnerRez
 * record changes.
 *
 * Rules:
 *  - OwnerRez stays authoritative for the reservation itself. This is context.
 *  - Nothing is fabricated: a field OwnerRez did not return stays null.
 *  - No reservation row is created anywhere; we store ids plus a snapshot.
 *  - Ambiguous (more than one active stay) or vacant homes get no snapshot.
 *  - A ticket that already carries a snapshot is never overwritten.
 *  - Failures are silent for the caller — a ticket must never fail to be
 *    created because OwnerRez was unreachable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { reservationColumns, ownerRezBookingUrl } from "@/lib/ownerrez-links";

type Db = SupabaseClient<Database>;

export type SnapshotOutcome =
  | { applied: true; bookingId: string }
  | {
      applied: false;
      reason:
        | "already_snapshotted"
        | "no_property"
        | "not_linked"
        | "no_stay"
        | "ambiguous"
        | "demo"
        | "error";
    };

export async function applyReservationSnapshot(db: Db, ticketId: string): Promise<SnapshotOutcome> {
  try {
    const { data: ticket } = await db
      .from("tickets")
      .select("id, property_id, is_demo, ownerrez_booking_id, reservation_snapshot_at")
      .eq("id", ticketId)
      .maybeSingle();

    if (!ticket) return { applied: false, reason: "no_property" };
    if (ticket.is_demo) return { applied: false, reason: "demo" };
    if (ticket.reservation_snapshot_at) return { applied: false, reason: "already_snapshotted" };
    if (!ticket.property_id) return { applied: false, reason: "no_property" };

    const { data: property } = await db
      .from("properties")
      .select("id, ownerrez_property_id, is_demo")
      .eq("id", ticket.property_id)
      .maybeSingle();
    if (!property || property.is_demo) return { applied: false, reason: "demo" };
    if (!property.ownerrez_property_id) return { applied: false, reason: "not_linked" };

    const { currentGuestForListing } = await import("@/lib/ownerrez.server");
    const stay = await currentGuestForListing(property.ownerrez_property_id);
    if (stay.status === "ambiguous") return { applied: false, reason: "ambiguous" };
    if (stay.status !== "match" || !stay.reservation_id)
      return { applied: false, reason: "no_stay" };

    const columns = reservationColumns({
      booking_id: stay.reservation_id,
      guest_name: stay.guest_name,
      channel: stay.booking_channel,
      confirmation: stay.confirmation_number,
      arrival: stay.arrival,
      departure: stay.departure,
      guest_count: stay.guest_count,
      url: ownerRezBookingUrl(stay.reservation_id),
    });

    // A second lookup may finish after the first one. Keep the earliest
    // snapshot instead of silently replacing it with a later reservation.
    const { data: saved, error } = await db
      .from("tickets")
      .update(columns)
      .eq("id", ticketId)
      .is("reservation_snapshot_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { applied: false, reason: "error" };
    if (!saved) return { applied: false, reason: "already_snapshotted" };
    return { applied: true, bookingId: columns.ownerrez_booking_id };
  } catch {
    // Never let an integration read break ticket creation.
    return { applied: false, reason: "error" };
  }
}
