import { describe, expect, it } from "bun:test";
import {
  hasReservationContext,
  ownerRezBookingUrl,
  ownerRezGuestUrl,
  ownerRezPropertyUrl,
  reservationColumns,
} from "@/lib/ownerrez-links";

describe("OwnerRez deep links", () => {
  it("builds the verified link shapes", () => {
    expect(ownerRezBookingUrl(123)).toBe("https://app.ownerrez.com/bookings/123");
    expect(ownerRezPropertyUrl("456")).toBe("https://app.ownerrez.com/properties/456");
    expect(ownerRezGuestUrl("789")).toBe("https://app.ownerrez.com/guests/789");
  });

  it("returns null instead of a broken link when there is no id", () => {
    expect(ownerRezBookingUrl(null)).toBeNull();
    expect(ownerRezBookingUrl("   ")).toBeNull();
    expect(ownerRezPropertyUrl(undefined)).toBeNull();
  });
});

describe("reservation snapshot mapping", () => {
  const now = new Date("2026-09-02T15:00:00.000Z");

  it("stores exactly what OwnerRez gave us", () => {
    const cols = reservationColumns(
      {
        booking_id: "5150",
        guest_name: " Dana Reed ",
        channel: "Airbnb",
        confirmation: "HMABC123",
        arrival: "2026-09-01T16:00:00Z",
        departure: "2026-09-06",
        guest_count: 4,
        url: null,
      },
      now,
    );
    expect(cols.ownerrez_booking_id).toBe("5150");
    expect(cols.reservation_guest_name).toBe("Dana Reed");
    expect(cols.reservation_arrival).toBe("2026-09-01");
    expect(cols.reservation_departure).toBe("2026-09-06");
    expect(cols.reservation_guest_count).toBe(4);
    expect(cols.reservation_url).toBe("https://app.ownerrez.com/bookings/5150");
    expect(cols.reservation_snapshot_at).toBe(now.toISOString());
  });

  it("never invents missing values", () => {
    const cols = reservationColumns(
      {
        booking_id: 77,
        guest_name: null,
        channel: null,
        confirmation: null,
        arrival: null,
        departure: "not-a-date",
        guest_count: 0,
        url: null,
      },
      now,
    );
    expect(cols.reservation_guest_name).toBeNull();
    expect(cols.reservation_channel).toBeNull();
    expect(cols.reservation_confirmation).toBeNull();
    expect(cols.reservation_arrival).toBeNull();
    expect(cols.reservation_departure).toBeNull();
    expect(cols.reservation_guest_count).toBeNull();
  });

  it("shows context only when a booking id was frozen", () => {
    expect(hasReservationContext({ ownerrez_booking_id: "1" })).toBe(true);
    expect(hasReservationContext({ ownerrez_booking_id: null })).toBe(false);
    expect(hasReservationContext({})).toBe(false);
  });
});
