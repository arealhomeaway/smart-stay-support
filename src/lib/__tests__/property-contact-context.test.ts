/**
 * Regression tests for the property-selection guest/owner contact context.
 *
 * resolvePropertyGuestContext is the pure decision core extracted from
 * getPropertyContactContext (src/lib/guest-context.functions.ts) so it can
 * be exercised here with injected lookups — no real OwnerRez account, no
 * network access, no Supabase. Mocked throughout; this proves the branching
 * logic, not that the live OwnerRez integration or RLS-backed owner lookup
 * behaves this way in production (see TEST_RESULTS for what remains
 * unverified against live systems).
 */
import { describe, expect, it } from "bun:test";
import { resolvePropertyGuestContext, type PropertyGuestLookups } from "@/lib/property-contact";

const OWNERREZ_ID = "12345";

function lookups(overrides: Partial<PropertyGuestLookups> = {}): PropertyGuestLookups {
  return {
    currentGuestForListing: async () => ({
      status: "no_stay",
      guest_name: null,
      phone: null,
      email: null,
      arrival: null,
      departure: null,
      reservation_id: null,
      booking_channel: null,
      stay_kind: null,
    }),
    stayForListing: async () => ({ next_arrival: null }),
    ...overrides,
  };
}

describe("resolvePropertyGuestContext", () => {
  it("reports not_linked when the property has no OwnerRez listing, without calling either lookup", async () => {
    let calls = 0;
    const result = await resolvePropertyGuestContext(null, {
      currentGuestForListing: async () => {
        calls += 1;
        throw new Error("should not be called");
      },
      stayForListing: async () => {
        calls += 1;
        throw new Error("should not be called");
      },
    });
    expect(result).toEqual({ status: "not_linked" });
    expect(calls).toBe(0);
  });

  it("reports occupied with full guest detail on a current match, without checking upcoming reservations", async () => {
    let stayCalls = 0;
    const result = await resolvePropertyGuestContext(
      OWNERREZ_ID,
      lookups({
        currentGuestForListing: async () => ({
          status: "match",
          guest_name: "Jordan Rivera",
          phone: "555-0100",
          email: "jordan@example.com",
          arrival: "2026-08-27T00:00:00.000Z",
          departure: "2026-09-01T00:00:00.000Z",
          reservation_id: "RES-1",
          booking_channel: "Airbnb",
          stay_kind: "short_term",
        }),
        stayForListing: async () => {
          stayCalls += 1;
          return { next_arrival: null };
        },
      }),
    );
    expect(result).toEqual({
      status: "occupied",
      guest_name: "Jordan Rivera",
      phone: "555-0100",
      email: "jordan@example.com",
      arrival: "2026-08-27T00:00:00.000Z",
      departure: "2026-09-01T00:00:00.000Z",
      reservation_id: "RES-1",
      booking_channel: "Airbnb",
      stay_kind: "short_term",
    });
    // A current match already answers the question — no need to spend a
    // second OwnerRez call checking for an upcoming reservation too.
    expect(stayCalls).toBe(0);
  });

  it("reports vacant with the next arrival date when nothing is in-house right now", async () => {
    const result = await resolvePropertyGuestContext(
      OWNERREZ_ID,
      lookups({ stayForListing: async () => ({ next_arrival: "2026-09-05T00:00:00.000Z" }) }),
    );
    expect(result).toEqual({ status: "vacant", next_arrival: "2026-09-05T00:00:00.000Z" });
  });

  it("reports vacant with no next arrival when nothing is booked at all", async () => {
    const result = await resolvePropertyGuestContext(OWNERREZ_ID, lookups());
    expect(result).toEqual({ status: "vacant", next_arrival: null });
  });

  it("reports ambiguous when more than one reservation matches right now, and never guesses a guest", async () => {
    const result = await resolvePropertyGuestContext(
      OWNERREZ_ID,
      lookups({
        currentGuestForListing: async () => ({
          status: "ambiguous",
          guest_name: null,
          phone: null,
          email: null,
          arrival: null,
          departure: null,
          reservation_id: null,
          booking_channel: null,
          stay_kind: null,
        }),
      }),
    );
    expect(result).toEqual({ status: "ambiguous" });
  });

  it("reports source_error with a message when the lookup itself fails, instead of throwing or guessing vacancy", async () => {
    const result = await resolvePropertyGuestContext(
      OWNERREZ_ID,
      lookups({
        currentGuestForListing: async () => {
          throw new Error("OwnerRez is returning a server error.");
        },
      }),
    );
    expect(result.status).toBe("source_error");
    expect((result as { status: "source_error"; message: string }).message).toBe(
      "OwnerRez is returning a server error.",
    );
  });

  it("treats the currentGuestForListing 'unavailable' status as source_error rather than guessing vacancy", async () => {
    // currentGuestForListing's declared return type includes "unavailable"
    // even though the real OwnerRez implementation never produces it today
    // (src/lib/ownerrez.server.ts) — this is the type-level contract test.
    const result = await resolvePropertyGuestContext(
      OWNERREZ_ID,
      lookups({
        currentGuestForListing: async () => ({
          status: "unavailable",
          guest_name: null,
          phone: null,
          email: null,
          arrival: null,
          departure: null,
          reservation_id: null,
          booking_channel: null,
          stay_kind: null,
        }),
      }),
    );
    expect(result.status).toBe("source_error");
  });

  it("also treats a failure in the follow-up vacancy/upcoming-reservation lookup as source_error", async () => {
    const result = await resolvePropertyGuestContext(
      OWNERREZ_ID,
      lookups({
        stayForListing: async () => {
          throw new Error("network timeout");
        },
      }),
    );
    expect(result.status).toBe("source_error");
  });
});
