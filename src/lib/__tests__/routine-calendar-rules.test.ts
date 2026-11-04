import { describe, expect, it } from "bun:test";
import {
  MANUAL_ROUTINE_KINDS,
  maintenanceReviewKey,
  maintenanceReviewWorkOrderId,
  needsMaintenanceReview,
  surveyReviewKey,
} from "@/lib/routine-controls";
import {
  breezewayCalendarItems,
  breezewayWorkType,
  matchesCalendarFilters,
  DEFAULT_FILTERS,
} from "@/lib/work-order-calendar-sources";

describe("survey and maintenance review routines", () => {
  it("cannot be started by hand", () => {
    expect(MANUAL_ROUTINE_KINDS).not.toContain("survey_review");
    expect(MANUAL_ROUTINE_KINDS).not.toContain("maintenance_review");
  });
  it("uses one key per survey and per work order", () => {
    expect(surveyReviewKey("f1")).toBe("survey:f1");
    expect(maintenanceReviewWorkOrderId(maintenanceReviewKey("w1"))).toBe("w1");
  });
  it("vendor Finished is not the team's review", () => {
    const wo = { id: "w1", department: "maintenance", status: "Finished" };
    expect(needsMaintenanceReview(wo, new Set())).toBe(true);
    expect(needsMaintenanceReview(wo, new Set(["w1"]))).toBe(false);
    expect(needsMaintenanceReview({ ...wo, status: "Approved" }, new Set())).toBe(false);
    expect(needsMaintenanceReview({ ...wo, department: "housekeeping" }, new Set())).toBe(false);
  });
});

describe("work order calendar sources", () => {
  const row = {
    id: "b1",
    breezeway_task_id: 42,
    name: "ARHA Departure Clean (Updated)",
    department: "housekeeping",
    status: "Created",
    scheduled_date: "2026-11-05",
    property_id: "p1",
    assignees: [{ name: "Ana" }],
  };
  it("shows a linked Breezeway task once, as the Resolve Work Order", () => {
    expect(breezewayCalendarItems([row], new Set(["42"]))).toHaveLength(0);
    expect(breezewayCalendarItems([row], new Set())).toHaveLength(1);
  });
  it("skips deleted and undated Breezeway work", () => {
    expect(breezewayCalendarItems([{ ...row, status: "Deleted" }], new Set())).toHaveLength(0);
    expect(breezewayCalendarItems([{ ...row, scheduled_date: null }], new Set())).toHaveLength(0);
  });
  it("names work types from the data", () => {
    expect(breezewayWorkType("housekeeping", "ARHA Departure Clean")).toBe("departure_clean");
    expect(breezewayWorkType("maintenance", "Lawn Care")).toBe("mowing");
    expect(breezewayWorkType("housekeeping", "Weekly Pool Service")).toBe("pool");
  });
  it("filters by source, type, home and assignee", () => {
    const [item] = breezewayCalendarItems([row], new Set());
    expect(matchesCalendarFilters(item!, DEFAULT_FILTERS)).toBe(true);
    expect(matchesCalendarFilters(item!, { ...DEFAULT_FILTERS, source: "resolve" })).toBe(false);
    expect(matchesCalendarFilters(item!, { ...DEFAULT_FILTERS, assignee: "Bo" })).toBe(false);
    expect(matchesCalendarFilters(item!, { ...DEFAULT_FILTERS, propertyId: "p1", workType: "departure_clean" })).toBe(true);
  });
});
