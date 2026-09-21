import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { addressLine, geocodeOne } from "./geo.server";
import { validCoordinates } from "./geo";
import { ownerRezGet, type OwnerRezBooking } from "./ownerrez.server";
import {
  applyRequirements, canUseAvailabilityFinder, classifyAvailability, nearbyProperties, validStay,
  verifiedPublicListingUrl,
  type AvailabilityProperty, type AvailabilityResult,
} from "./availability-finder";
import { unknownFacts, type AmenityKey, type MatchRequirements } from "./property-facts";
import { ownerRezFactsFor } from "./property-facts.server";
import type { AppRole } from "./permissions";
import { activePublicListing } from "./availability-listing";

type Client = SupabaseClient<Database>;
export type FinderInput = {
  checkIn: string;
  checkOut: string;
  location: string;
  /** Dogs travelling with the guest; 0 means dogs are not a requirement. */
  dogs?: number | undefined;
  /** Cats travelling with the guest; 0 means cats are not a requirement. */
  cats?: number | undefined;
  /** Smallest acceptable bedroom count; 0 means size is not a requirement. */
  minBedrooms?: number | undefined;
  amenities?: AmenityKey[] | undefined;
};

export async function assertFinderAccess(supabase: Client, userId: string) {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error || !canUseAvailabilityFinder((data ?? []).map((row) => row.role as AppRole)))
    throw new Error("Availability Finder is for authorized Operations staff only.");
}

function safePublicUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "uc.orez.io" && !url.username && !url.password && !url.search ? url.toString() : null;
  } catch { return null; }
}

/** OwnerRez is queried live; this search never caches or changes reservations. */
export async function bookingsForPeriod(ownerRezPropertyId: string, checkIn: string, checkOut: string) {
  const bookings: OwnerRezBooking[] = [];
  for (let page = 0; page < 20; page++) {
    const data = await ownerRezGet<{ items?: OwnerRezBooking[] }>("/bookings", {
      // Include stays that started before check-in but still overlap the request.
      // A capped/incomplete response fails closed below rather than claiming Available.
      property_ids: ownerRezPropertyId, from: "2000-01-01", to: checkOut,
      limit: "50", offset: String(page * 50),
    });
    const items = (data.items ?? []).filter((row) => String(row.property_id) === ownerRezPropertyId);
    if (items.some((row) => !validStay(row.arrival?.slice(0, 10) ?? "", row.departure?.slice(0, 10) ?? "")))
      throw new Error("OwnerRez returned a reservation without valid stay dates. Availability cannot be confirmed.");
    bookings.push(...items);
    if ((data.items ?? []).length < 50) return bookings;
  }
  throw new Error("OwnerRez returned too many reservations to verify this property. Narrow the dates.");
}

export async function findAvailableProperties(supabase: Client, input: FinderInput) {
  if (!validStay(input.checkIn, input.checkOut))
    throw new Error("Enter valid check-in and check-out dates; check-out must be after check-in.");
  const location = input.location.trim();
  if (!location) throw new Error("Enter a city, ZIP code, address, or general location.");
  const center = await geocodeOne(location);
  if (!center) throw new Error("We could not locate that place. Try a fuller address or ZIP code.");

  const { data, error } = await supabase.from("properties")
    .select("id,name,address_line1,city,state,postal_code,formatted_address,latitude,longitude,bedrooms,bathrooms,max_guests,primary_photo_url,primary_photo_source,listing_public_url,ownerrez_property_id,ownerrez_synced_at")
    .eq("active", true).eq("is_demo", false).is("archived_at", null)
    .not("ownerrez_property_id", "is", null);
  if (error) throw error;

  const linked = (data ?? []).filter((row) => validCoordinates(row.latitude, row.longitude) && row.ownerrez_property_id);
  const properties: AvailabilityProperty[] = linked.map((row) => ({
    id: row.id, name: row.name,
    address: addressLine(row) || row.formatted_address || "Address unavailable",
    lat: row.latitude!, lng: row.longitude!, bedrooms: row.bedrooms,
    bathrooms: row.bathrooms, maxGuests: row.max_guests,
    imageUrl: row.primary_photo_source === "ownerrez_listing" ? safePublicUrl(row.primary_photo_url) : null,
    bookingUrl: row.ownerrez_synced_at ? verifiedPublicListingUrl(row.listing_public_url) : null,
  }));
  const nearby = nearbyProperties(properties, center);
  const ids = new Map(linked.map((row) => [row.id, row.ownerrez_property_id!]));
  // Pet allowance and amenities come straight from OwnerRez, never from typed notes.
  const facts = await ownerRezFactsFor(
    nearby.map((property) => ({ id: property.id, ownerRezPropertyId: ids.get(property.id)! })),
  );
  const results: AvailabilityResult[] = [];
  // Bound concurrent read traffic to OwnerRez while preserving distance order.
  for (let offset = 0; offset < nearby.length; offset += 5) {
    const batch = nearby.slice(offset, offset + 5);
    const rows = await Promise.all(batch.map(async (property) => {
      const bookings = await bookingsForPeriod(ids.get(property.id)!, input.checkIn, input.checkOut);
      const read = facts.get(property.id) ?? { facts: unknownFacts(), unavailableReason: null };
      return {
        ...property,
        ...classifyAvailability(bookings, input.checkIn, input.checkOut),
        facts: read.facts,
        factsUnavailable: read.unavailableReason,
      };
    }));
    results.push(...rows);
  }
  const requirements: MatchRequirements = {
    dogs: input.dogs ?? 0,
    cats: input.cats ?? 0,
    minBedrooms: input.minBedrooms ?? 0,
    amenities: input.amenities ?? [],
  };
  const split = applyRequirements(results, requirements);
  return {
    center,
    results: split.matched,
    heldBack: split.heldBack.map((entry) => ({
      id: entry.result.id,
      name: entry.result.name,
      reasons: entry.reasons,
    })),
    excludedUnlocated: (data ?? []).length - linked.length,
  };
}

export async function verifySelectedPublicListings(supabase: Client, propertyIds: string[]) {
  const { data, error } = await supabase.from("properties")
    .select("id,listing_public_url,ownerrez_property_id,ownerrez_synced_at")
    .in("id", propertyIds).eq("active", true).eq("is_demo", false).is("archived_at", null);
  if (error) throw error;
  const byId = new Map((data ?? []).map((row) => [row.id, row]));
  const checked = await Promise.all(propertyIds.map(async (id) => {
    const row = byId.get(id);
    const url = row?.ownerrez_property_id && row.ownerrez_synced_at ? verifiedPublicListingUrl(row.listing_public_url) : null;
    return { id, url, active: url ? await activePublicListing(url) : false };
  }));
  return checked;
}
