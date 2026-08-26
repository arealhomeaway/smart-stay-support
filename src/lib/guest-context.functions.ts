import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Current guest / tenant context for an Operations matter.
 *
 * Read-only in every direction:
 *  - the only OwnerRez call is a GET for the active reservation and its guest;
 *  - nothing is written back to OwnerRez, and no guest contact detail is
 *    stored in our database (there is no second guest record anywhere);
 *  - only Operations coordinators, supervisors and admins may call it —
 *    vendors, homeowners, onboarding-only staff and demo records get nothing.
 */

export type GuestContextResult =
  | { visible: false }
  | {
      visible: true;
      status: "match" | "unavailable";
      guest_name: string | null;
      phone: string | null;
      email: string | null;
      arrival: string | null;
      departure: string | null;
      reservation_id: string | null;
      booking_channel: string | null;
      stay_kind: "short_term" | "mid_term" | null;
    };

const UNAVAILABLE = {
  visible: true as const,
  status: "unavailable" as const,
  guest_name: null,
  phone: null,
  email: null,
  arrival: null,
  departure: null,
  reservation_id: null,
  booking_channel: null,
  stay_kind: null,
};

export const getGuestContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<GuestContextResult> => {
    const { supabase, userId } = context;

    // Authorisation: Operations staff and supervisors only.
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const allowed = roles.some((r) => r === "admin" || r === "manager" || r === "tech");
    if (!allowed) return { visible: false };

    // The matter itself is still read through the caller's own RLS client.
    const { data: ticket } = await supabase
      .from("tickets")
      .select("id, property_id, is_demo")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket || !ticket.property_id) return { visible: false };
    // Demo records never reach an integration.
    if (ticket.is_demo) return { visible: false };

    const { data: property } = await supabase
      .from("properties")
      .select("id, ownerrez_property_id, is_demo")
      .eq("id", ticket.property_id)
      .maybeSingle();
    if (!property || property.is_demo) return { visible: false };

    // Matching is by OwnerRez property id only — never by property name.
    if (!property.ownerrez_property_id) return UNAVAILABLE;

    try {
      const { currentGuestForListing } = await import("@/lib/ownerrez.server");
      const stay = await currentGuestForListing(property.ownerrez_property_id);
      if (stay.status !== "match") return UNAVAILABLE;
      return {
        visible: true,
        status: "match",
        guest_name: stay.guest_name,
        phone: stay.phone,
        email: stay.email,
        arrival: stay.arrival,
        departure: stay.departure,
        reservation_id: stay.reservation_id,
        booking_channel: stay.booking_channel,
        stay_kind: stay.stay_kind,
      };
    } catch (err) {
      console.error("Guest context lookup failed", err);
      return UNAVAILABLE;
    }
  });
