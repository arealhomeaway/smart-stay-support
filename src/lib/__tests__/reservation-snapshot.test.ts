import { describe, expect, it, mock } from "bun:test";
import { applyReservationSnapshot } from "@/lib/reservation-snapshot.server";

mock.module("@/lib/ownerrez.server", () => ({
  currentGuestForListing: async () => ({
    status: "match",
    reservation_id: "synthetic-booking-7",
    guest_name: "Synthetic Guest",
    booking_channel: "Direct",
    confirmation_number: null,
    arrival: "2026-09-17",
    departure: "2026-09-20",
    guest_count: 2,
  }),
}));

function fixture(raceBeforeSave = false) {
  const ticket: Record<string, unknown> = {
    id: "ticket-synthetic",
    property_id: "property-synthetic",
    is_demo: false,
    ownerrez_booking_id: null,
    reservation_snapshot_at: null,
  };
  const property: Record<string, unknown> = {
    id: "property-synthetic",
    ownerrez_property_id: "123",
    is_demo: false,
  };
  let writes = 0;
  const db = {
    from(table: string) {
      let patch: Record<string, unknown> | null = null;
      let onlyUnsnapshotted = false;
      const chain = {
        select: (_columns: string) => chain,
        eq: (_column: string, _value: unknown) => chain,
        is: (column: string, value: unknown) => {
          if (column === "reservation_snapshot_at" && value === null) onlyUnsnapshotted = true;
          return chain;
        },
        update: (value: Record<string, unknown>) => {
          patch = value;
          if (raceBeforeSave) ticket["reservation_snapshot_at"] = "2026-09-17T00:00:00Z";
          return chain;
        },
        maybeSingle: async () => {
          if (patch) {
            if (onlyUnsnapshotted && ticket["reservation_snapshot_at"] !== null)
              return { data: null, error: null };
            Object.assign(ticket, patch);
            writes += 1;
            return { data: { id: ticket["id"] }, error: null };
          }
          return { data: table === "tickets" ? ticket : property, error: null };
        },
      };
      return chain;
    },
  };
  return {
    db: db as unknown as Parameters<typeof applyReservationSnapshot>[0],
    ticket,
    property,
    writes: () => writes,
  };
}

describe("OwnerRez Ticket context snapshot", () => {
  it("stores a single OwnerRez booking as context once", async () => {
    const { db, ticket, writes } = fixture();
    expect(await applyReservationSnapshot(db, "ticket-synthetic")).toEqual({
      applied: true,
      bookingId: "synthetic-booking-7",
    });
    expect(ticket["ownerrez_booking_id"]).toBe("synthetic-booking-7");
    expect(writes()).toBe(1);
  });

  it("preserves the first snapshot when another request wins before the update", async () => {
    const { db, ticket, writes } = fixture(true);
    expect(await applyReservationSnapshot(db, "ticket-synthetic")).toEqual({
      applied: false,
      reason: "already_snapshotted",
    });
    expect(ticket["ownerrez_booking_id"]).toBeNull();
    expect(writes()).toBe(0);
  });

  it("does not invent reservation context for an unmapped property", async () => {
    const { db, property, writes } = fixture();
    property["ownerrez_property_id"] = null;
    expect(await applyReservationSnapshot(db, "ticket-synthetic")).toEqual({
      applied: false,
      reason: "not_linked",
    });
    expect(writes()).toBe(0);
  });
});
