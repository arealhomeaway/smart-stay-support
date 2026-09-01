import { describe, expect, it } from "bun:test";
import {
  CREATE_TICKET_TAG,
  CREATE_LEAD_TAG,
  CREATED_TAG,
  CLOSED_TAG,
  LEGACY_CREATE_TAG,
  LEGACY_CREATED_TAG,
  LEGACY_COMPLETED_TAG,
  alreadyTagged,
  categoriesAfterClose,
  categoriesAfterCreate,
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

  it("the lead category opens a lead, not a ticket", () => {
    expect(triggerKind([CREATE_LEAD_TAG])).toBe("lead");
    expect(requestsRecord([CREATE_LEAD_TAG])).toBe(true);
  });

  it("if both trigger categories are somehow present, the narrower instruction wins", () => {
    expect(triggerKind([CREATE_TICKET_TAG, CREATE_LEAD_TAG])).toBe("lead");
  });

  it("the retired task vocabulary can no longer create anything", () => {
    expect(triggerKind([LEGACY_CREATE_TAG])).toBeNull();
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
});

describe("category lifecycle", () => {
  it("creating swaps the trigger and keeps every other category", () => {
    expect(categoriesAfterCreate(["Guest", CREATE_TICKET_TAG, "Urgent"])).toEqual(["Guest", "Urgent", CREATED_TAG]);
    expect(categoriesAfterCreate(["Owner", CREATE_LEAD_TAG])).toEqual(["Owner", CREATED_TAG]);
  });

  it("trigger and created are never both left on a message", () => {
    const after = categoriesAfterCreate([CREATE_TICKET_TAG, CREATE_LEAD_TAG]);
    expect(after).toEqual([CREATED_TAG]);
  });

  it("closing replaces the created tag, never duplicating Resolve tags", () => {
    expect(categoriesAfterClose(["Owner", CREATED_TAG])).toEqual(["Owner", CLOSED_TAG]);
    expect(categoriesAfterClose([CLOSED_TAG])).toEqual([CLOSED_TAG]);
    expect(categoriesAfterClose([CREATE_TICKET_TAG, CREATED_TAG, "Vendor"])).toEqual(["Vendor", CLOSED_TAG]);
  });

  it("reopening puts the message back to created", () => {
    expect(categoriesAfterReopen(["Vendor", CLOSED_TAG])).toEqual(["Vendor", CREATED_TAG]);
  });

  it("legacy task categories are cleaned up when a message is touched again", () => {
    expect(categoriesAfterClose(["Guest", LEGACY_CREATED_TAG])).toEqual(["Guest", CLOSED_TAG]);
  });

  it("unrelated categories survive de-duplication with order intact", () => {
    expect(categoriesAfterCreate(["Guest", "guest", null, "", "Owner", CREATE_TICKET_TAG])).toEqual([
      "Guest",
      "Owner",
      CREATED_TAG,
    ]);
  });
});
