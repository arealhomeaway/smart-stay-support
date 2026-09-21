import { can, type AppRole } from "./permissions";
import { hasRequirements, matchesRequirements, type MatchRequirements, type PropertyFacts } from "./property-facts";

export const AVAILABILITY_RADIUS_MILES = 20;
export type AvailabilityStatus = "available" | "conditional" | "unavailable";
export type ReservationConflict = {
  arrival: string;
  departure: string;
  kind: "str" | "non_movable";
};
export type AvailabilityProperty = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  imageUrl: string | null;
  bookingUrl: string | null;
};
export type AvailabilityResult = AvailabilityProperty & {
  distanceMiles: number;
  status: AvailabilityStatus;
  strConflicts: ReservationConflict[];
  nonMovableConflicts: ReservationConflict[];
  /** Verified OwnerRez pet and amenity facts for this home. */
  facts: PropertyFacts;
  /** Set when OwnerRez details could not be read; facts are unknown then. */
  factsUnavailable: string | null;
};
export type AvailabilityBooking = {
  arrival: string;
  departure: string;
  status?: string | null;
  is_block?: boolean | null;
};

export function canUseAvailabilityFinder(roles: AppRole[]) {
  return can(roles, "work_orders_internal");
}

export function validStay(checkIn: string, checkOut: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const parsed = (value: string) => {
    if (!day.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  };
  return parsed(checkIn) !== null && parsed(checkOut) !== null && checkOut > checkIn;
}

export function overlapsStay(booking: AvailabilityBooking, checkIn: string, checkOut: string) {
  const arrival = booking.arrival?.slice(0, 10);
  const departure = booking.departure?.slice(0, 10);
  return Boolean(arrival && departure && arrival < checkOut && departure > checkIn);
}

/** Matches the repository's current OwnerRez guest-context rule: 28 nights starts MTR. */
export function reservationKindForAvailability(booking: AvailabilityBooking): "str" | "non_movable" {
  if (booking.is_block) return "non_movable";
  const arrival = Date.parse(`${booking.arrival.slice(0, 10)}T00:00:00Z`);
  const departure = Date.parse(`${booking.departure.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure <= arrival)
    return "non_movable";
  return (departure - arrival) / 86400000 < 28 ? "str" : "non_movable";
}

export function classifyAvailability(bookings: AvailabilityBooking[], checkIn: string, checkOut: string) {
  const strConflicts: ReservationConflict[] = [];
  const nonMovableConflicts: ReservationConflict[] = [];
  for (const booking of bookings) {
    if (["cancelled", "canceled"].includes(booking.status?.toLowerCase() ?? "") || !overlapsStay(booking, checkIn, checkOut)) continue;
    const kind = reservationKindForAvailability(booking);
    (kind === "str" ? strConflicts : nonMovableConflicts).push({
      arrival: booking.arrival.slice(0, 10), departure: booking.departure.slice(0, 10), kind,
    });
  }
  strConflicts.sort((a, b) => a.arrival.localeCompare(b.arrival));
  nonMovableConflicts.sort((a, b) => a.arrival.localeCompare(b.arrival));
  const status: AvailabilityStatus = nonMovableConflicts.length ? "unavailable" : strConflicts.length ? "conditional" : "available";
  return { status, strConflicts, nonMovableConflicts };
}

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearbyProperties(properties: AvailabilityProperty[], center: { lat: number; lng: number }) {
  return properties.map((property) => ({ ...property, distanceMiles: milesBetween(center, property) }))
    .filter((property) => property.distanceMiles <= AVAILABILITY_RADIUS_MILES)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export function visibleResults(results: AvailabilityResult[], showUnavailable: boolean) {
  return results.filter((result) => showUnavailable || result.status !== "unavailable");
}

export type HeldBackResult = { result: AvailabilityResult; reasons: string[] };

/**
 * Splits results against the requested pet and amenity requirements.
 * Homes whose OwnerRez answer is unknown are held back, never offered.
 */
export function applyRequirements(results: AvailabilityResult[], requirements: MatchRequirements) {
  if (!hasRequirements(requirements)) return { matched: results, heldBack: [] as HeldBackResult[] };
  const matched: AvailabilityResult[] = [];
  const heldBack: HeldBackResult[] = [];
  for (const result of results) {
    const outcome = matchesRequirements(result.facts, requirements);
    if (outcome.ok) matched.push(result);
    else heldBack.push({ result, reasons: outcome.reasons });
  }
  return { matched, heldBack };
}

/**
 * A stay the guest can have, provided Operations re-books an existing short
 * stay elsewhere first. This is the interrupted mid-term case: the dates are
 * offerable, with a second step attached.
 */
export function needsStrRebook(result: AvailabilityResult) {
  return result.status === "conditional" && result.strConflicts.length > 0;
}

export function rebookStepSummary(result: AvailabilityResult) {
  const count = result.strConflicts.length;
  return `${count} short stay${count === 1 ? "" : "s"} must be re-booked at another home before this stay can start.`;
}

/** OwnerRez public_url is the source; accept only ARHA's public listing hosts. */
export function verifiedPublicListingUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    if (!["arealhomeaway.hosted.ownerrez.com", "arealhomeaway.com", "www.arealhomeaway.com"].includes(url.hostname.toLowerCase())) return null;
    const path = decodeURIComponent(url.pathname).toLowerCase();
    if (path === "/" || /\/(admin|auth|login|manage|preview|api|bookings|properties|guests|inquiries|quotes)(\/|$)/.test(path)) return null;
    if (/\b(token|secret|key|tracking|preview)\b/.test(path)) return null;
    if (/[?#]/.test(path) || [...path].some((character) => character.charCodeAt(0) < 32) ||
      path.split("/").some((part) => /^\d+$/.test(part) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part))) return null;
    return url.toString();
  } catch { return null; }
}

export function externalAvailabilityText(result: AvailabilityResult) {
  return result.status === "conditional" ? "Availability requires final confirmation." : "Please confirm availability before booking.";
}

export function emailSummary(results: AvailabilityResult[], checkIn: string, checkOut: string, location: string) {
  return `Property options for ${checkIn} to ${checkOut} near ${location.trim()}:\n\n${results.map((r) =>
    `${r.name} — ${r.address}${r.bookingUrl ? `\n${r.bookingUrl}` : ""}\n${externalAvailabilityText(r)}`,
  ).join("\n\n")}`;
}
