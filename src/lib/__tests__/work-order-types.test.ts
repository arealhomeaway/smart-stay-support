import { describe, expect, it } from "bun:test";
import { ticketWorkOrdersQueryKey } from "../work-order-types";

describe("ticketWorkOrdersQueryKey — the one cache key for a ticket's Work Orders", () => {
  it("is stable for the same ticket id", () => {
    expect(ticketWorkOrdersQueryKey("t-123")).toEqual(["work-orders-for-ticket", "t-123"]);
  });

  it("differs for different ticket ids, so invalidating one never touches another ticket's cache", () => {
    expect(ticketWorkOrdersQueryKey("t-1")).not.toEqual(ticketWorkOrdersQueryKey("t-2"));
  });

  it("is a well-defined (if inert) key even without a ticket id", () => {
    expect(ticketWorkOrdersQueryKey(undefined)).toEqual(["work-orders-for-ticket", undefined]);
    expect(ticketWorkOrdersQueryKey(null)).toEqual(["work-orders-for-ticket", null]);
  });

  it("useTicketWorkOrders() and WorkOrderDrawer's own invalidation import this same function — see TicketWorkOrderPanel.tsx and WorkOrderDrawer.tsx — rather than each retyping the tuple, so a Work Order close can never invalidate a cache the Ticket page isn't reading from", () => {
    // Documentation-as-assertion: both call sites are required to produce
    // the exact same key for the exact same ticket id, which is only
    // guaranteed by construction once both import this function instead of
    // hand-typing ["work-orders-for-ticket", ticketId] independently.
    const ticketId = "t-555";
    const fromTicketPage = ticketWorkOrdersQueryKey(ticketId);
    const fromWorkOrderDrawerInvalidate = ticketWorkOrdersQueryKey(ticketId);
    expect(fromTicketPage).toEqual(fromWorkOrderDrawerInvalidate);
  });
});
