import { describe, expect, it } from "bun:test";
import {
  CREATE_TICKET_TAG,
  DIRECT_BOOKING_TAG,
  DIRECT_BOOKING_TAGS,
  CREATED_TAG,
  CLOSED_TAG,
  LEGACY_CREATE_TAG,
  LEGACY_CREATED_TAG,
  LEGACY_COMPLETED_TAG,
  LEGACY_LEAD_TAG,
  LEGACY_LEAD_TAG_SPACED,
  RESOLVE_TAGS,
  alreadyTagged,
  categoriesAfterClose,
  categoriesAfterCreate,
  categoriesAfterOwnerResponse,
  categoriesAfterReopen,
  requestsRecord,
  triggerKind,
} from "../mail-categories";

describe("what a person asked Resolve to create", () => {
  it("only the exact ticket category opens a ticket", () => {
    expect(triggerKind([CREATE_TICKET_TAG])).toBe("ticket");
    expect(triggerKind(["resolve: create ticket"])).toBe("ticket"); // case is forgiven
    expect(triggerKind([" Resolve: create ticket "])).toBe("ticket"); // stray spacing is forgiven
    expect(triggerKind(["Resolve: create ticket please"])).toBeNull();
    expect(triggerKind(["Guest", "Urgent"])).toBeNull();
    expect(triggerKind([])).toBeNull();
    expect(triggerKind(null)).toBeNull();
  });

  it("Resolve: direct booking opens a Direct Booking request, not a ticket", () => {
    expect(DIRECT_BOOKING_TAG).toBe("Resolve: direct booking");
    expect(triggerKind([DIRECT_BOOKING_TAG])).toBe("lead");
    expect(triggerKind(["resolve: direct booking"])).toBe("lead");
    expect(requestsRecord([DIRECT_BOOKING_TAG])).toBe(true);
  });

  it("Resolve: direct booking is the only tag that opens a Direct Booking request", () => {
    expect(DIRECT_BOOKING_TAGS).toEqual(["Resolve: direct booking"]);
  });

  it("if both trigger categories are somehow present, the narrower instruction wins", () => {
    expect(triggerKind([CREATE_TICKET_TAG, DIRECT_BOOKING_TAG])).toBe("lead");
  });

  it("the retired task vocabulary can no longer create anything", () => {
    expect(triggerKind([LEGACY_CREATE_TAG])).toBeNull();
  });

  it("the retired lead management tag, in either spelling and any case, creates nothing", () => {
    expect(LEGACY_LEAD_TAG).toBe("Resolve: lead management- create a ticket");
    expect(LEGACY_LEAD_TAG_SPACED).toBe("Resolve: lead management - create a ticket");
    for (const t of [
      LEGACY_LEAD_TAG,
      LEGACY_LEAD_TAG_SPACED,
      "RESOLVE: LEAD MANAGEMENT - CREATE A TICKET",
      " resolve: lead management- create a ticket ",
    ]) {
      expect(triggerKind([t])).toBeNull();
      expect(requestsRecord([t])).toBe(false);
    }
  });

  it("a message with only the old lead tag creates nothing, even with team filing tags", () => {
    expect(triggerKind(["Team A", LEGACY_LEAD_TAG])).toBeNull();
    expect(requestsRecord(["Team A", LEGACY_LEAD_TAG_SPACED])).toBe(false);
  });

  it("the old lead tag never changes what a real trigger asks for", () => {
    expect(triggerKind([LEGACY_LEAD_TAG, CREATE_TICKET_TAG])).toBe("ticket");
    expect(triggerKind([LEGACY_LEAD_TAG, DIRECT_BOOKING_TAG])).toBe("lead");
  });
});

describe("a message Resolve has already acted on", () => {
  it("is not re-opened, under either the current or the retired protocol", () => {
    expect(alreadyTagged([CREATED_TAG])).toBe(true);
    expect(alreadyTagged([CLOSED_TAG])).toBe(true);
    expect(alreadyTagged([LEGACY_CREATED_TAG])).toBe(true);
    expect(alreadyTagged([LEGACY_COMPLETED_TAG])).toBe(true);
    expect(alreadyTagged([CREATE_TICKET_TAG])).toBe(false);
  });

  it("an old lead-tagged message already handled stays handled", () => {
    expect(alreadyTagged([LEGACY_LEAD_TAG, CREATED_TAG])).toBe(true);
    expect(alreadyTagged([LEGACY_LEAD_TAG_SPACED, CLOSED_TAG])).toBe(true);
  });
});

describe("category lifecycle", () => {
  it("creating swaps the trigger and keeps every other category", () => {
    expect(categoriesAfterCreate(["Guest", CREATE_TICKET_TAG, "Urgent"])).toEqual([
      "Guest",
      "Urgent",
      CREATED_TAG,
    ]);
    expect(categoriesAfterCreate(["Owner", DIRECT_BOOKING_TAG])).toEqual(["Owner", CREATED_TAG]);
  });

  it("trigger and created are never both left on a message", () => {
    const after = categoriesAfterCreate([CREATE_TICKET_TAG, DIRECT_BOOKING_TAG]);
    expect(after).toEqual([CREATED_TAG]);
  });

  it("closing replaces the created tag, never duplicating Resolve tags", () => {
    expect(categoriesAfterClose(["Owner", CREATED_TAG])).toEqual(["Owner", CLOSED_TAG]);
    expect(categoriesAfterClose([CLOSED_TAG])).toEqual([CLOSED_TAG]);
    expect(categoriesAfterClose([CREATE_TICKET_TAG, CREATED_TAG, "Vendor"])).toEqual([
      "Vendor",
      CLOSED_TAG,
    ]);
  });

  it("reopening puts the message back to created", () => {
    expect(categoriesAfterReopen(["Vendor", CLOSED_TAG])).toEqual(["Vendor", CREATED_TAG]);
  });

  it("legacy task categories are cleaned up when a message is touched again", () => {
    expect(categoriesAfterClose(["Guest", LEGACY_CREATED_TAG])).toEqual(["Guest", CLOSED_TAG]);
  });

  it("the retired lead tags are cleaned up when touched again and never written", () => {
    expect(RESOLVE_TAGS).toContain(LEGACY_LEAD_TAG);
    expect(RESOLVE_TAGS).toContain(LEGACY_LEAD_TAG_SPACED);
    expect(categoriesAfterClose(["Guest", LEGACY_LEAD_TAG, CREATED_TAG])).toEqual(["Guest", CLOSED_TAG]);
    const writes = [
      categoriesAfterCreate([LEGACY_LEAD_TAG_SPACED, DIRECT_BOOKING_TAG]),
      categoriesAfterClose([LEGACY_LEAD_TAG]),
      categoriesAfterReopen([LEGACY_LEAD_TAG, CLOSED_TAG]),
      categoriesAfterOwnerResponse([LEGACY_LEAD_TAG]),
    ];
    for (const written of writes) {
      for (const retired of [LEGACY_LEAD_TAG, LEGACY_LEAD_TAG_SPACED, LEGACY_CREATE_TAG, LEGACY_CREATED_TAG, LEGACY_COMPLETED_TAG]) {
        expect(written.map((c) => c.toLowerCase())).not.toContain(retired.toLowerCase());
      }
    }
  });

  it("unrelated categories survive de-duplication with order intact", () => {
    expect(categoriesAfterCreate(["Guest", "guest", null, "", "Owner", CREATE_TICKET_TAG])).toEqual(
      ["Guest", "Owner", CREATED_TAG],
    );
  });
});
