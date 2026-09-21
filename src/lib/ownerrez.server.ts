/**
 * OwnerRez API v2 access (server-only).
 *
 * Auth is HTTP Basic: OwnerRez login email + a personal access token.
 * Docs: https://api.ownerrez.com/help/v2
 */

const BASE = "https://api.ownerreservations.com/v2";

export class OwnerRezError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "OwnerRezError";
  }
}

function authHeader() {
  const user = process.env["OWNERREZ_USERNAME"];
  const token = process.env["OWNERREZ_ACCESS_TOKEN"];
  if (!user || !token) {
    throw new OwnerRezError(500, "OwnerRez credentials are not configured.");
  }
  return `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}`;
}

export async function ownerRezGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "User-Agent": "ARHA-Resolve",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`OwnerRez ${path} failed [${res.status}]: ${body}`);
    const friendly =
      res.status === 401
        ? "OwnerRez rejected the credentials. Check the login email and access token."
        : `OwnerRez request failed (${res.status}). ${body.slice(0, 300)}`;
    throw new OwnerRezError(res.status, friendly);
  }
  return (await res.json()) as T;
}

/** Structured amenity payload from /listings/{propertyId}. */
export type OwnerRezListingDetail = {
  property_id?: number;
  amenity_call_outs?: { text?: string | null }[] | null;
  amenity_categories?: { type?: string | null; amenities?: { text?: string | null }[] | null }[] | null;
};

/** Structured property record from /properties/{id}; max_pets is the pet source. */
export type OwnerRezPropertyDetail = {
  id: number;
  max_pets?: number | null;
  active?: boolean;
};

export async function listingDetail(ownerRezPropertyId: string) {
  return ownerRezGet<OwnerRezListingDetail>(`/listings/${encodeURIComponent(ownerRezPropertyId)}`);
}

export async function propertyDetail(ownerRezPropertyId: string) {
  return ownerRezGet<OwnerRezPropertyDetail>(`/properties/${encodeURIComponent(ownerRezPropertyId)}`);
}

export type OwnerRezListing = {
  id: number;
  name: string;
  address?: {
    street1?: string;
    street2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    zip?: string;
  } | null;
  active?: boolean;
};

export type OwnerRezBooking = {
  id: number;
  property_id: number;
  arrival: string;
  departure: string;
  status?: string;
  type?: string;
  is_block?: boolean;
  guest_id?: number;
  guest_name?: string;
};

export async function listListings(): Promise<OwnerRezListing[]> {
  const out: OwnerRezListing[] = [];
  let offset = 0;
  for (let page = 0; page < 10; page++) {
    const data = await ownerRezGet<{ items?: OwnerRezListing[]; next_page_url?: string | null }>(
      "/properties",
      { limit: "50", offset: String(offset), includeInactive: "false" },
    );
    const items = data.items ?? [];
    out.push(...items);
    if (items.length < 50) break;
    offset += 50;
  }
  return out;
}

/** Local (property-timezone-agnostic) yyyy-mm-dd for a Date. */
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type StaySnapshot = {
  occupancy_status: "vacant" | "occupied" | "same_day_arrival" | "same_day_departure";
  guest_name: string | null;
  arrival: string | null;
  departure: string | null;
  booking_id: string | null;
  next_arrival: string | null;
};

/**
 * Reads today's reservations for one OwnerRez listing and maps them onto the
 * SOP occupancy drivers (vacant / occupied / same-day arrival / departure).
 */
export async function stayForListing(ownerRezPropertyId: string): Promise<StaySnapshot> {
  const today = new Date();
  const from = new Date(today.getTime() - 2 * 86400000);
  const to = new Date(today.getTime() + 14 * 86400000);

  const data = await ownerRezGet<{ items?: OwnerRezBooking[] }>("/bookings", {
    property_ids: ownerRezPropertyId,
    from: ymd(from),
    to: ymd(to),
    limit: "50",
    include_guest: "true",
  });

  const todayKey = ymd(today);
  const bookings = (data.items ?? []).filter(
    (b) =>
      String(b.property_id) === ownerRezPropertyId &&
      !b.is_block &&
      (b.status ?? "Active").toLowerCase() !== "cancelled",
  );

  const arrivingToday = bookings.find((b) => b.arrival?.slice(0, 10) === todayKey);
  const departingToday = bookings.find((b) => b.departure?.slice(0, 10) === todayKey);
  const staying = bookings.find(
    (b) => b.arrival?.slice(0, 10) <= todayKey && b.departure?.slice(0, 10) > todayKey,
  );
  const upcoming = bookings
    .filter((b) => (b.arrival?.slice(0, 10) ?? "") > todayKey)
    .sort((a, b) => a.arrival.localeCompare(b.arrival))[0];

  const current = staying ?? departingToday ?? arrivingToday ?? null;

  let occupancy: StaySnapshot["occupancy_status"] = "vacant";
  if (arrivingToday) occupancy = "same_day_arrival";
  else if (departingToday) occupancy = "same_day_departure";
  else if (staying) occupancy = "occupied";

  let guestName: string | null = current?.guest_name ?? null;
  if (!guestName && current?.guest_id) {
    try {
      const guest = await ownerRezGet<{ first_name?: string; last_name?: string }>(
        `/guests/${current.guest_id}`,
      );
      guestName = [guest.first_name, guest.last_name].filter(Boolean).join(" ") || null;
    } catch {
      guestName = null;
    }
  }

  return {
    occupancy_status: occupancy,
    guest_name: guestName,
    arrival: current?.arrival ?? null,
    departure: current?.departure ?? null,
    booking_id: current ? String(current.id) : null,
    next_arrival: upcoming?.arrival ?? null,
  };
}

/* ------------------------------------------------------------------ *
 * Current guest / tenant contact (read-only).
 *
 * Strictly a GET against OwnerRez. Nothing here creates, updates or sends
 * anything through OwnerRez, and no guest contact detail is written back to
 * our database — it is fetched for display and then dropped.
 * ------------------------------------------------------------------ */

export type GuestContact = {
  status: "match" | "no_stay" | "ambiguous" | "unavailable";
  guest_name: string | null;
  phone: string | null;
  email: string | null;
  arrival: string | null;
  departure: string | null;
  reservation_id: string | null;
  booking_channel: string | null;
  /** The channel's own confirmation code (Airbnb/Vrbo), when OwnerRez has one. */
  confirmation_number: string | null;
  /** Adults + children + infants as reported by OwnerRez, when present. */
  guest_count: number | null;
  guest_id: string | null;
  stay_kind: "short_term" | "mid_term" | null;
  note?: string;
};

type OwnerRezGuest = {
  first_name?: string;
  last_name?: string;
  phones?: Array<{ number?: string; type?: string }>;
  email_addresses?: Array<{ address?: string }>;
};

/**
 * Resolves the guest or mid-term tenant currently in residence for one
 * OwnerRez listing id. Matching is by OwnerRez property id and the active
 * stay date range only — never by property name. Anything other than exactly
 * one active stay is reported as unavailable rather than guessed at.
 */
export async function currentGuestForListing(ownerRezPropertyId: string): Promise<GuestContact> {
  const empty: GuestContact = {
    status: "no_stay",
    guest_name: null,
    phone: null,
    email: null,
    arrival: null,
    departure: null,
    reservation_id: null,
    booking_channel: null,
    confirmation_number: null,
    guest_count: null,
    guest_id: null,
    stay_kind: null,
  };

  const today = new Date();
  const data = await ownerRezGet<{ items?: OwnerRezStayBooking[] }>("/bookings", {
    property_ids: ownerRezPropertyId,
    from: ymd(new Date(today.getTime() - 2 * 86400000)),
    to: ymd(new Date(today.getTime() + 2 * 86400000)),
    limit: "50",
    include_guest: "true",
  });

  const todayKey = ymd(today);
  const active = (data.items ?? []).filter(
    (b) =>
      String(b.property_id) === ownerRezPropertyId &&
      !b.is_block &&
      (b.status ?? "Active").toLowerCase() !== "cancelled" &&
      (b.arrival?.slice(0, 10) ?? "9999") <= todayKey &&
      (b.departure?.slice(0, 10) ?? "0000") >= todayKey,
  );

  if (active.length === 0) return empty;
  if (active.length > 1) return { ...empty, status: "ambiguous" };

  const stay = active[0]!;
  let name = stay.guest_name ?? null;
  let phone: string | null = null;
  let email: string | null = null;

  if (stay.guest_id) {
    try {
      const guest = await ownerRezGet<OwnerRezGuest>(`/guests/${stay.guest_id}`);
      name = name ?? [guest.first_name, guest.last_name].filter(Boolean).join(" ") ?? null;
      phone = guest.phones?.find((p) => p.number)?.number ?? null;
      email = guest.email_addresses?.find((e) => e.address)?.address ?? null;
    } catch {
      // Leave the contact fields blank rather than guessing.
    }
  }

  const nights =
    stay.arrival && stay.departure
      ? Math.round(
          (new Date(stay.departure).getTime() - new Date(stay.arrival).getTime()) / 86400000,
        )
      : 0;

  return {
    status: "match",
    guest_name: name || null,
    phone,
    email,
    arrival: stay.arrival ?? null,
    departure: stay.departure ?? null,
    reservation_id: String(stay.id),
    booking_channel: stay.listing_site ?? stay.type ?? null,
    confirmation_number: stay.platform_reservation_number ?? null,
    guest_count: guestCount(stay),
    guest_id: stay.guest_id == null ? null : String(stay.guest_id),
    stay_kind: nights >= 28 ? "mid_term" : "short_term",
  };
}

/** Booking shape as returned when reading a stay, verified against the live account. */
type OwnerRezStayBooking = OwnerRezBooking & {
  listing_site?: string | null;
  platform_reservation_number?: string | null;
  adults?: number | null;
  children?: number | null;
  infants?: number | null;
};

/** Adults + children + infants, or null when OwnerRez reports none — never guessed. */
function guestCount(stay: OwnerRezStayBooking): number | null {
  const total = (stay.adults ?? 0) + (stay.children ?? 0) + (stay.infants ?? 0);
  return total > 0 ? total : null;
}
