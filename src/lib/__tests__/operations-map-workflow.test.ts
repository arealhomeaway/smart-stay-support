import { describe, expect, it } from "bun:test";
import { activeMapCount, clusterMapPins, directionsUrl, mapPinColor, mostUrgentPriority, validCoordinates, type MapPin } from "@/lib/geo";
import { operationsCalendarDays, operationsCalendarMonth, operationsView, parseOperationsSearch, shiftOperationsMonth, withOperationsView } from "@/lib/operations-view-state";
import { can } from "@/lib/permissions";
import { standaloneOperationsOrders } from "@/lib/operations-population";
import type { WorkOrderRow } from "@/lib/work-order-types";
import { DEFAULT_TEAM_QUEUE_FILTERS, applyTeamQueueFilters, effectiveOperationsPriority, type TeamQueueTicket } from "@/lib/team-queue";

const pin = (over: Partial<MapPin> = {}): MapPin => ({
  propertyId: "home-1", name: "Home", address: "123 Main St, Dallas, TX", lat: 32.7767, lng: -96.797,
  openJobs: [], ...over,
});
const job = (priority: string, status = "open") => ({
  id: priority, ref: 1, title: "Issue", priority, status, dueAt: null, vendorName: null,
  vendorStatus: null, workOrderId: "canonical-wo",
});
const ticket = (over: Partial<TeamQueueTicket> = {}): TeamQueueTicket => ({
  id: "ticket-1", priority: "p2", status: "open", property_id: "home-1", ...over,
});

describe("Operations map access and population", () => {
  it("allows Operations staff, supervisor/director and platform owner, but excludes outside accounts", () => {
    for (const role of ["tech", "manager", "admin"] as const)
      expect(can([role], "work_orders_internal")).toBe(true);
    for (const role of ["vendor", "owner"] as const)
      expect(can([role], "work_orders_internal")).toBe(false);
  });

  it("defaults to active work and requires explicit closed selection", () => {
    const rows = [ticket(), ticket({ id: "closed", status: "closed" }), ticket({ id: "resolved", status: "resolved" })];
    expect(applyTeamQueueFilters(rows, DEFAULT_TEAM_QUEUE_FILTERS, () => null).map((row) => row.id)).toEqual(["ticket-1"]);
    expect(applyTeamQueueFilters(rows, { ...DEFAULT_TEAM_QUEUE_FILTERS, status: "closed" }, () => null).map((row) => row.id)).toEqual(["closed", "resolved"]);
  });

  it("composes unscheduled, vendor, assignee and priority instead of returning early", () => {
    const rows = [
      ticket({ id: "match", assigned_to: "pc-1", vendor_name: "A", priority: "p1" }),
      ticket({ id: "other-vendor", assigned_to: "pc-1", vendor_name: "B", priority: "p1" }),
      ticket({ id: "other-owner", assigned_to: "pc-2", vendor_name: "A", priority: "p1" }),
      ticket({ id: "scheduled", assigned_to: "pc-1", vendor_name: "A", priority: "p1", action_due_at: "2026-09-20" }),
    ];
    const filters = { ...DEFAULT_TEAM_QUEUE_FILTERS, due: "unscheduled", vendor: "A", assignee: "pc-1", priority: "p1" };
    expect(applyTeamQueueFilters(rows, filters, () => null).map((row) => row.id)).toEqual(["match"]);
  });

  it("uses the highest active Ticket or canonical Work Order priority in every filter", () => {
    const row = ticket({ priority: "p2", workOrder: {
      id: "wo", priority: "p1", vendor_name: null, scheduled_for: null, vendor_eta_at: null,
      vendor_acknowledged_at: null, vendor_completed_at: null, closed_at: null,
    } });
    expect(effectiveOperationsPriority(row)).toBe("p1");
    expect(applyTeamQueueFilters([row], { ...DEFAULT_TEAM_QUEUE_FILTERS, priority: "p1" }, () => null)).toHaveLength(1);
  });

  it("keeps a ticket and its canonical Work Order as one issue and excludes closed work from active pin counts", () => {
    const related = pin({ openJobs: [job("p2"), job("p1", "closed")] });
    expect(activeMapCount(related)).toBe(1);
    expect(mapPinColor(related)).toBe("#a85b00");
    expect(mapPinColor(pin({ openJobs: [job("p1")] }))).toBe("#b42318");
    expect(mapPinColor(pin({ openJobs: [job("p3")] }))).toBe("#087d70");
    expect(mapPinColor(pin())).toBe("#667085");
    expect(mostUrgentPriority(["p2", "p1"])).toBe("p1");
  });

  it("adds an unlinked canonical Work Order once and never duplicates a linked Ticket", () => {
    const order = (id: string, ticketId: string | null, closedAt: string | null = null) => ({
      id, ticket_id: ticketId, property_id: "home-1", title: id, scope: null,
      priority: "p2", closed_at: closedAt, scheduled_for: null, vendor_eta_at: null,
      service_category: "maintenance", created_at: "2026-09-18", assigned_to: null,
      vendor_contacted_at: null, vendor_name: "Vendor A",
    }) as WorkOrderRow;
    const property = { id: "home-1", name: "Home", nickname: null, market: "Dallas", city: "Dallas", state: "TX" };
    const issues = standaloneOperationsOrders(
      [order("linked", "ticket-1"), order("standalone", null), order("closed", null, "2026-09-18")],
      [property], [{ work_order_id: "standalone", status: "sent" }], new Set(["ticket-1"]),
    );
    expect(issues.map((issue) => issue.id)).toEqual(["standalone", "closed"]);
    expect(issues[0]?.dispatchState).toBe("sent");
    expect(applyTeamQueueFilters(issues, DEFAULT_TEAM_QUEUE_FILTERS, () => null).map((issue) => issue.id)).toEqual(["standalone"]);
    expect(applyTeamQueueFilters(issues, { ...DEFAULT_TEAM_QUEUE_FILTERS, status: "closed" }, () => null).map((issue) => issue.id)).toEqual(["closed"]);
  });

  it("keeps an open Work Order visible when its linked Ticket is no longer active", () => {
    const order = { id: "repair", ticket_id: "closed-ticket", property_id: "home-1", title: "Repair",
      scope: null, priority: "p2", closed_at: null, scheduled_for: null, vendor_eta_at: null,
      service_category: "maintenance", created_at: "2026-09-18", assigned_to: null,
      vendor_contacted_at: null, vendor_name: null } as WorkOrderRow;
    const property = { id: "home-1", name: "Home", nickname: null, market: null, city: null, state: null };
    expect(standaloneOperationsOrders([order], [property], [], new Set()).map((issue) => issue.id)).toEqual(["repair"]);
  });
});

describe("Operations map state and geography", () => {
  it("preserves lens, filters, search, sort, selected pin and camera across all four views", () => {
    const original = parseOperationsSearch({ lens: "mine", assignee: "pc-1", priority: "p1", q: "water", sort: "due", dateFrom: "2026-09-18", pin: "home-1", lat: "32.7", lng: "-96.8", zoom: "12", ignored: "unsafe" });
    for (const view of ["list", "kanban", "map", "calendar"] as const) {
      const next = withOperationsView(original, view);
      expect(operationsView(next)).toBe(view);
      for (const key of ["lens", "assignee", "priority", "q", "sort", "dateFrom", "pin", "lat", "lng", "zoom"] as const)
        expect(next[key]).toBe(original[key]);
      expect("ignored" in next).toBe(false);
    }
  });

  it("clusters close properties and separates them after zooming in", () => {
    const homes = [pin(), pin({ propertyId: "home-2", lat: 32.7768, lng: -96.7969 })];
    expect(clusterMapPins(homes, 8)).toHaveLength(1);
    expect(clusterMapPins(homes, 21)).toHaveLength(2);
  });

  it("treats missing, invalid and zero coordinates as unpinned", () => {
    expect(validCoordinates(null, -96)).toBe(false);
    expect(validCoordinates(32, 200)).toBe(false);
    expect(validCoordinates(0, 0)).toBe(false);
    expect(validCoordinates(32.7767, -96.797)).toBe(true);
  });

  it("constructs an encoded Google Maps directions URL", () => {
    expect(directionsUrl(pin())).toBe("https://www.google.com/maps/dir/?api=1&destination=123%20Main%20St%2C%20Dallas%2C%20TX");
    expect(directionsUrl(pin({ address: "" }))).toContain("destination=32.7767%2C-96.797");
  });

  it("keeps Calendar month navigation in the shared URL and builds a Sunday-first grid", () => {
    expect(operationsCalendarMonth("2026-09")).toBe("2026-09");
    expect(shiftOperationsMonth("2026-12", 1)).toBe("2027-01");
    const days = operationsCalendarDays("2026-09");
    expect(days).toHaveLength(42);
    expect(days[0]).toBe("2026-08-30");
    expect(days).toContain("2026-09-30");
  });
});
