/**
 * Owner contact + current/upcoming guest context for a PROPERTY (browser-safe
 * types + the pure resolution logic only — no Supabase, no OwnerRez, no
 * server-only imports here, so this can be unit tested directly).
 *
 * Used when a coordinator selects a property before a ticket exists yet
 * (e.g. logging new work). Distinct from getGuestContext (keyed by an
 * existing ticket, in guest-context.functions.ts) but shares its
 * authorization rule, its demo-record exclusion, and the same underlying
 * OwnerRez reads — see getPropertyContactContext in guest-context.functions.ts
 * for the actual server function that wires this to Supabase and OwnerRez.
 *
 * Every outcome is reported explicitly — vacant, a future-only reservation,
 * more than one candidate reservation right now, and an OwnerRez failure all
 * get their own status rather than collapsing into one generic
 * "unavailable". Owner contact is resolved independently of guest status:
 * staff can see who owns the home even when it's vacant or OwnerRez itself
 * is unreachable.
 */

export type PropertyContactResult =
  | { visible: false }
  | {
      visible: true;
      /** Echoes the request's propertyId so a caller can discard a response
       *  that arrived after the selection moved on to a different property. */
      propertyId: string;
      /**
       * Resolved only from Active Owner Program enrollment (see the KNOWN
       * LIMITATION note on getPropertyContactContext in
       * guest-context.functions.ts) — `source` names that scope explicitly
       * so a null owner can never be misread as "this property has no
       * owner" rather than "no enrolled-program contact on file".
       */
      owner:
        | { source: "active_owner_program"; name: string | null; phone: string | null; email: string | null }
        | null;
      guest:
        | { status: "not_linked" }
        | { status: "vacant"; next_arrival: string | null }
        | {
            status: "occupied";
            guest_name: string | null;
            phone: string | null;
            email: string | null;
            arrival: string | null;
            departure: string | null;
            reservation_id: string | null;
            booking_channel: string | null;
            stay_kind: "short_term" | "mid_term" | null;
          }
        | { status: "ambiguous" }
        | { status: "source_error"; message: string };
    };

type GuestLookupResult = {
  // "unavailable" is part of currentGuestForListing's declared return type
  // (src/lib/ownerrez.server.ts) even though that function never actually
  // produces it today — handled explicitly below so this stays a real
  // structural match rather than requiring a cast at the call site.
  status: "match" | "no_stay" | "ambiguous" | "unavailable";
  guest_name: string | null;
  phone: string | null;
  email: string | null;
  arrival: string | null;
  departure: string | null;
  reservation_id: string | null;
  booking_channel: string | null;
  stay_kind: "short_term" | "mid_term" | null;
};

export type PropertyGuestLookups = {
  currentGuestForListing: (ownerRezPropertyId: string) => Promise<GuestLookupResult>;
  /** Only called when there's no current stay, to distinguish "vacant" from "vacant, arriving soon". */
  stayForListing: (ownerRezPropertyId: string) => Promise<{ next_arrival: string | null }>;
};

/**
 * Pure resolution of the `guest` half of PropertyContactResult, given an
 * already-known OwnerRez listing id (or null when the property isn't
 * linked) and injectable lookups. Exported and injectable specifically so
 * this can be tested without a real OwnerRez account or network access —
 * see src/lib/__tests__/property-contact-context.test.ts.
 */
export async function resolvePropertyGuestContext(
  ownerRezPropertyId: string | null,
  lookups: PropertyGuestLookups,
): Promise<Extract<PropertyContactResult, { visible: true }>["guest"]> {
  if (!ownerRezPropertyId) return { status: "not_linked" };

  try {
    const current = await lookups.currentGuestForListing(ownerRezPropertyId);

    if (current.status === "ambiguous") return { status: "ambiguous" };
    if (current.status === "unavailable") {
      return { status: "source_error", message: "OwnerRez returned an unavailable guest status unexpectedly." };
    }
    if (current.status === "match") {
      return {
        status: "occupied",
        guest_name: current.guest_name,
        phone: current.phone,
        email: current.email,
        arrival: current.arrival,
        departure: current.departure,
        reservation_id: current.reservation_id,
        booking_channel: current.booking_channel,
        stay_kind: current.stay_kind,
      };
    }
    // No current stay — check for a future-only reservation so "vacant" and
    // "vacant, but someone arrives soon" are never conflated.
    const stay = await lookups.stayForListing(ownerRezPropertyId);
    return { status: "vacant", next_arrival: stay.next_arrival };
  } catch (err) {
    console.error("Property contact context lookup failed", err);
    const message = err instanceof Error ? err.message : "Could not reach OwnerRez.";
    return { status: "source_error", message };
  }
}
