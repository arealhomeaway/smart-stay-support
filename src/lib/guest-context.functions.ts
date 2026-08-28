import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolvePropertyGuestContext, type PropertyContactResult } from "@/lib/property-contact";

export type { PropertyContactResult };

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
  arrival: null,
  departure: null,
  reservation_id: null,
  booking_channel: null,
  stay_kind: null,
};

/**
 * Owner contact + current/upcoming guest context for a PROPERTY, used when a
 * coordinator selects a property before a ticket exists yet (e.g. logging
 * new work). Distinct from getGuestContext above (which is keyed by an
 * existing ticket) but shares its authorization rule, its demo-record
 * exclusion, and the same underlying OwnerRez read. See src/lib/property-contact.ts
 * for the result type and the pure resolution logic (resolvePropertyGuestContext).
 *
 * KNOWN LIMITATION, not silently papered over: the only owner contact
 * Resolve's own database holds today is on `owner_programs`, which is
 * scoped to Active Owner Program *enrollment* — it does not exist for a
 * regular (non-enrolled) owner. The general property → owner mapping lives
 * in Notion's "Property Master Data" database (each property row links to
 * an Owner contact page), keyed by the same OwnerRez property id already
 * stored here, and is not synced into Supabase anywhere. It could not be
 * verified whether OwnerRez's own API additionally exposes owner contact
 * directly — this session had no live OwnerRez credentials and
 * api.ownerrez.com is blocked by this session's own network egress policy,
 * so even the public API docs couldn't be checked. Wiring in the general
 * mapping needs either a new Notion sync job or confirmation that OwnerRez
 * exposes it — a real decision, not something to guess at here. Until then,
 * `owner.source` below is always "active_owner_program", and a null `owner`
 * means "not found in that program", never "this property has no owner".
 */
export const getPropertyContactContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PropertyContactResult> => {
    const { supabase, userId } = context;

    // Authorisation: Operations staff and supervisors only — identical rule
    // to getGuestContext.
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    const allowed = roles.some((r) => r === "admin" || r === "manager" || r === "tech");
    if (!allowed) return { visible: false };

    const { data: property } = await supabase
      .from("properties")
      .select("id, ownerrez_property_id, is_demo")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (!property || property.is_demo) return { visible: false };

    // Owner contact: reuses the existing owner_programs record and its
    // existing staff-only RLS — no new table, no copy of the contact detail.
    // See the KNOWN LIMITATION note above: this only covers enrolled owners.
    const { data: ownerProgram } = await supabase
      .from("owner_programs")
      .select("owner_name, owner_phone, owner_email")
      .eq("property_id", property.id)
      .eq("is_demo", false)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const owner = ownerProgram
      ? {
          source: "active_owner_program" as const,
          name: ownerProgram.owner_name,
          phone: ownerProgram.owner_phone,
          email: ownerProgram.owner_email,
        }
      : null;

    const { currentGuestForListing, stayForListing } = await import("@/lib/ownerrez.server");
    const guest = await resolvePropertyGuestContext(property.ownerrez_property_id, {
      currentGuestForListing,
      stayForListing,
    });

    return { visible: true, propertyId: data.propertyId, owner, guest };
  });

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
