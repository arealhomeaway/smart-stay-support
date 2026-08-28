import { describe, expect, test } from "bun:test";
import {
  CREATE_TAG,
  CREATED_TAG,
  COMPLETED_TAG,
  alreadyTagged,
  categoriesAfterClose,
  categoriesAfterCreate,
  requestsTicket,
} from "../mail-categories";

describe("email intake category protocol", () => {
  test("only the exact category asks for a ticket", () => {
    expect(requestsTicket([CREATE_TAG])).toBe(true);
    expect(requestsTicket(["resolve: create task"])).toBe(true); // case is forgiven
    expect(requestsTicket([" Resolve: create task "])).toBe(true); // stray spacing is forgiven
    expect(requestsTicket(["Resolve: create task please"])).toBe(false);
    expect(requestsTicket(["Guest", "Urgent"])).toBe(false);
    expect(requestsTicket([])).toBe(false);
    expect(requestsTicket(null)).toBe(false);
  });

  test("a message Resolve has already acted on is not re-opened", () => {
    expect(alreadyTagged([CREATED_TAG])).toBe(true);
    expect(alreadyTagged([COMPLETED_TAG])).toBe(true);
    expect(alreadyTagged([CREATE_TAG])).toBe(false);
  });

  test("creating swaps the request tag and keeps every other category", () => {
    expect(categoriesAfterCreate(["Guest", CREATE_TAG, "Urgent"])).toEqual([
      "Guest",
      "Urgent",
      CREATED_TAG,
    ]);
  });

  test("closing replaces the created tag, never duplicating Resolve tags", () => {
    expect(categoriesAfterClose(["Owner", CREATED_TAG])).toEqual(["Owner", COMPLETED_TAG]);
    expect(categoriesAfterClose([COMPLETED_TAG])).toEqual([COMPLETED_TAG]);
    expect(categoriesAfterClose([CREATE_TAG, CREATED_TAG, "Vendor"])).toEqual(["Vendor", COMPLETED_TAG]);
  });

  test("unrelated categories survive de-duplication with order intact", () => {
    expect(categoriesAfterCreate(["Guest", "guest", null, "", "Owner", CREATE_TAG])).toEqual([
      "Guest",
      "Owner",
      CREATED_TAG,
    ]);
  });
});
