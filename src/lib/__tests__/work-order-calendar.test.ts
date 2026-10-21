import { describe, expect, it } from "bun:test";
import {
  calendarDay,
  calendarMonth,
  conflictCount,
  monthGrid,
  scheduleEntries,
  shiftMonth,
  timelineDays,
  unscheduled,
} from "@/lib/work-order-calendar";
import type { WorkOrderRow } from "@/lib/work-order-types";

function wo(over: Partial<WorkOrderRow> & { id: string }): WorkOrderRow {
  return {
    id: over.id,
    title: over.title ?? "Repair",
    property_id: over.property_id ?? null,
    vendor_name: over.vendor_name ?? null,
    vendor_org_id: over.vendor_org_id ?? null,
    scheduled_for: over.scheduled_for ?? null,
    vendor_eta_at: over.vendor_eta_at ?? null,
    closed_at: over.closed_at ?? null,
  } as unknown as WorkOrderRow;
}

describe("Work Order calendar", () => {
  it("keeps only dated, open Work Orders and prefers the vendor arrival", () => {
    const entries = scheduleEntries([
      wo({ id: "a", scheduled_for: "2026-09-10" }),
      wo({ id: "b", scheduled_for: "2026-09-10", vendor_eta_at: "2026-09-12T15:00:00.000Z" }),
      wo({ id: "c" }),
      wo({ id: "d", scheduled_for: "2026-09-11", closed_at: "2026-09-11T00:00:00.000Z" }),
    ]);
    expect(entries.map((e) => e.workOrder.id)).toEqual(["a", "b"]);
    expect(entries.find((e) => e.workOrder.id === "b")?.fromVendorEta).toBe(true);
    expect(entries.find((e) => e.workOrder.id === "b")?.day).toBe(
      calendarDay("2026-09-12T15:00:00.000Z") ?? "",
    );
  });

  it("flags a vendor booked twice on one day and a home visited twice", () => {
    const entries = scheduleEntries([
      wo({ id: "a", scheduled_for: "2026-09-10", vendor_org_id: "v1", property_id: "p1" }),
      wo({ id: "b", scheduled_for: "2026-09-10", vendor_org_id: "v1", property_id: "p2" }),
      wo({ id: "c", scheduled_for: "2026-09-10", vendor_org_id: "v2", property_id: "p2" }),
      wo({ id: "d", scheduled_for: "2026-09-11", vendor_org_id: "v1", property_id: "p1" }),
    ]);
    const by = (id: string) => entries.find((e) => e.workOrder.id === id)!.conflicts;
    expect(by("a")).toEqual(["vendor_double_booked"]);
    expect(by("b")).toEqual(["vendor_double_booked", "property_double_booked"]);
    expect(by("c")).toEqual(["property_double_booked"]);
    expect(by("d")).toEqual([]);
    expect(conflictCount(entries)).toBe(3);
  });

  it("builds a six-week grid that places entries on their day", () => {
    const entries = scheduleEntries([wo({ id: "a", scheduled_for: "2026-09-10" })]);
    const grid = monthGrid("2026-09", entries, new Date(2026, 8, 10));
    expect(grid).toHaveLength(42);
    const cell = grid.find((c) => c.day === "2026-09-10")!;
    expect(cell.inMonth).toBe(true);
    expect(cell.isToday).toBe(true);
    expect(cell.entries).toHaveLength(1);
  });

  it("lists timeline days from today forward only", () => {
    const entries = scheduleEntries([
      wo({ id: "past", scheduled_for: "2026-09-01" }),
      wo({ id: "soon", scheduled_for: "2026-09-20" }),
    ]);
    const days = timelineDays(entries, "2026-09-10");
    expect(days.map((d) => d.day)).toEqual(["2026-09-20"]);
  });

  it("separates open work with no date at all", () => {
    const rows = [
      wo({ id: "a" }),
      wo({ id: "b", scheduled_for: "2026-09-10" }),
      wo({ id: "c", closed_at: "2026-09-01T00:00:00.000Z" }),
    ];
    expect(unscheduled(rows).map((r) => r.id)).toEqual(["a"]);
  });

  it("normalises month values and shifts across year boundaries", () => {
    expect(calendarMonth("2026-13", new Date(2026, 0, 5))).toBe("2026-01");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
