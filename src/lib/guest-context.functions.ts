import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  OWNER_CONTACT_STALE_DAYS,
  resolvePropertyGuestContext,
  type PrimaryOwnerContact,
  type PropertyContactResult,
} from "@/lib/property-contact";

export type { PropertyContactResult, PrimaryOwnerContact };


/**
 * Current guest / tenant context for an Operations ticket.
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
 * Owner resolution (2026-08-31): the DESIGNATED primary owner comes from the
 * general directory table `property_owner_contacts`, imported read-only from
 * OwnerRez — the connected account was verified to expose `/v2/owners` and an
 * `owner_id` on every listing naming its designated owner, so no Notion
 * import is needed. Active Owner Program enrollment is reported separately as
 * a programme status and is never used as an owner source: a home with no
 * program row is not "ownerless". Only the designated primary owner is shown,
 * never every owner, and "no mapped owner", "stale" and "source failure" are
 * distinct states.
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

    const [{ data: directory }, { data: ownerProgram }] = await Promise.all([
      supabase
        .from("property_owner_contacts")
        .select("owner_name, owner_phone, owner_email, source, source_id, match_status, synced_at, detail")
        .eq("property_id", property.id)
        .maybeSingle(),
      supabase
        .from("owner_programs")
        .select("id")
        .eq("property_id", property.id)
        .eq("is_demo", false)
        .is("archived_at", null)
        .limit(1)
        .maybeSingle(),
    ]);

    const owner: PrimaryOwnerContact = directory
      ? {
          status: directory.match_status as PrimaryOwnerContact["status"],
          name: directory.owner_name,
          phone: directory.owner_phone,
          email: directory.owner_email,
          source: directory.source,
          sourceId: directory.source_id,
          syncedAt: directory.synced_at,
          stale:
            new Date(directory.synced_at).getTime() <
            Date.now() - OWNER_CONTACT_STALE_DAYS * 86400000,
          detail: directory.detail,
        }
      : {
          status: "not_synced",
          name: null,
          phone: null,
          email: null,
          source: null,
          sourceId: null,
          syncedAt: null,
          stale: true,
          detail: "This home has not been through an owner-directory import yet.",
        };

    const { currentGuestForListing, stayForListing } = await import("@/lib/ownerrez.server");
    const guest = await resolvePropertyGuestContext(property.ownerrez_property_id, {
      currentGuestForListing,
      stayForListing,
    });

    return {
      visible: true,
      propertyId: data.propertyId,
      owner,
      activeOwnerProgram: Boolean(ownerProgram),
      guest,
    };
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

    // The ticket itself is still read through the caller's own RLS client.
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
