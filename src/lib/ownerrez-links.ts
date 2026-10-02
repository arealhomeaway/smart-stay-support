/**
 * OwnerRez deep links (pure, browser-safe).
 *
 * Only the link shapes confirmed working by the 2026-09-01 integration audit
 * are exposed here. `app.ownerrez.com/messages/{thread}` is deliberately NOT
 * supported — that path 404s, so we never generate it.
 *
 * These links open the OwnerRez web app, which is where PMS actions and guest
 * communication happen. Resolve never performs those actions itself.
 */

const APP = "https://app.ownerrez.com";

/** OwnerRez ids are numeric; synthetic/demo ids (e.g. "demo-bk-1") never get a link. */
function clean(id: string | number | null | undefined) {
  const value = id == null ? "" : String(id).trim();
  return /^\d+$/.test(value) ? value : null;
}

export function ownerRezBookingUrl(bookingId: string | number | null | undefined) {
  const id = clean(bookingId);
  return id ? `${APP}/bookings/${id}` : null;
}

export function ownerRezPropertyUrl(propertyId: string | number | null | undefined) {
  const id = clean(propertyId);
  return id ? `${APP}/properties/${id}` : null;
}

export function ownerRezGuestUrl(guestId: string | number | null | undefined) {
  const id = clean(guestId);
  return id ? `${APP}/guests/${id}` : null;
}

export function ownerRezInquiryUrl(inquiryId: string | number | null | undefined) {
  const id = clean(inquiryId);
  return id ? `${APP}/inquiries/${id}` : null;
}

export function ownerRezQuoteUrl(quoteId: string | number | null | undefined) {
  const id = clean(quoteId);
  return id ? `${APP}/quotes/${id}` : null;
}

/* ------------------------------------------------------------------ *
 * Ticket-time reservation snapshot
 * ------------------------------------------------------------------ */

/** What OwnerRez told us about the stay at the moment the ticket was logged. */
export type ReservationSnapshot = {
  booking_id: string;
  guest_name: string | null;
  channel: string | null;
  confirmation: string | null;
  arrival: string | null;
  departure: string | null;
  guest_count: number | null;
  url: string | null;
};

/** The ticket columns a snapshot maps onto. Context only — never a PMS record. */
export type ReservationSnapshotColumns = {
  ownerrez_booking_id: string;
  reservation_guest_name: string | null;
  reservation_channel: string | null;
  reservation_confirmation: string | null;
  reservation_arrival: string | null;
  reservation_departure: string | null;
  reservation_guest_count: number | null;
  reservation_url: string | null;
  reservation_snapshot_at: string;
};

function dateOnly(value: string | null | undefined) {
  if (!value) return null;
  const slice = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null;
}

/**
 * Maps a snapshot onto ticket columns. Nothing is invented: a field OwnerRez
 * did not provide is stored as null rather than guessed or back-filled.
 */
export function reservationColumns(
  snapshot: ReservationSnapshot,
  now: Date = new Date(),
): ReservationSnapshotColumns {
  return {
    ownerrez_booking_id: String(snapshot.booking_id),
    reservation_guest_name: snapshot.guest_name?.trim() || null,
    reservation_channel: snapshot.channel?.trim() || null,
    reservation_confirmation: snapshot.confirmation?.trim() || null,
    reservation_arrival: dateOnly(snapshot.arrival),
    reservation_departure: dateOnly(snapshot.departure),
    reservation_guest_count:
      typeof snapshot.guest_count === "number" && snapshot.guest_count > 0
        ? snapshot.guest_count
        : null,
    reservation_url: snapshot.url ?? ownerRezBookingUrl(snapshot.booking_id),
    reservation_snapshot_at: now.toISOString(),
  };
}

/** True when a ticket carries enough stored context to be worth showing. */
export function hasReservationContext(ticket: {
  ownerrez_booking_id?: string | null;
  reservation_snapshot_at?: string | null;
}) {
  return Boolean(ticket.ownerrez_booking_id);
}
