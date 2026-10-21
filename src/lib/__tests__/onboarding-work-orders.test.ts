import { describe, expect, it } from "bun:test";
import {
  mergeWorkOrders,
  shapeBreezewayOrder,
  shapeVendorOrder,
  workOrderCounts,
} from "../onboarding-work-orders";

const pushed = {
  id: "b1",
  title: "Install curtain rods",
  status: "sent",
  scheduled_date: "2026-10-01",
  assignee_names: ["Marco"],
  onboarding_task_id: "t1",
  created_at: "2026-09-20T10:00:00Z",
};

const vendor = {
  id: "v1",
  title: "Carpet replacement",
  phase: "quote",
  vendor_name: "Tulsa Floors",
  scheduled_for: null,
  closed_at: null,
  created_at: "2026-09-21T10:00:00Z",
};

describe("onboarding Work Orders", () => {
  it("says plainly where a Breezeway job is tracked and what state it is in", () => {
    const o = shapeBreezewayOrder(pushed);
    expect(o.route).toBe("breezeway");
    expect(o.routeLabel).toBe("Breezeway");
    expect(o.statusLabel).toBe("Sent to Breezeway");
    expect(o.who).toBe("Marco");
    expect(o.fromStepId).toBe("t1");
    expect(o.done).toBe(false);
  });

  it("keeps a non-Breezeway vendor job distinct", () => {
    const o = shapeVendorOrder(vendor);
    expect(o.route).toBe("vendor");
    expect(o.routeLabel).toBe("Vendor (tracked here)");
    expect(o.statusLabel).toBe("Waiting on a quote");
    expect(o.who).toBe("Tulsa Floors");
  });

  it("marks a finished job done and sorts it below open work", () => {
    const finished = { ...vendor, id: "v2", closed_at: "2026-09-22T10:00:00Z" };
    const merged = mergeWorkOrders([pushed], [vendor, finished]);
    expect(merged.map((o) => o.id)).toEqual(["v1", "b1", "v2"]);
    expect(merged.at(-1)?.done).toBe(true);
    expect(merged.at(-1)?.statusLabel).toBe("Finished");
  });

  it("counts each route separately so neither is invisible", () => {
    const merged = mergeWorkOrders([pushed], [vendor]);
    expect(workOrderCounts(merged)).toEqual({ total: 2, breezeway: 1, vendor: 1, open: 2 });
  });
});
