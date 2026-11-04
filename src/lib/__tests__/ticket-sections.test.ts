import { describe, expect, it } from "bun:test";
import { hiddenSectionCount, ticketSections } from "@/lib/ticket-sections";

const base = { stage: "triage", entryKind: "ops", estimatedCost: null, workOrderCount: 0, vendorName: null, closed: false };
describe("ticket sections", () => {
  it("a simple lock issue hides cost and vendor sections", () => {
    const s = ticketSections(base);
    expect(s).toEqual({ costs: false, vendor: false });
    expect(hiddenSectionCount(s)).toBe(2);
  });
  it("a Work Order brings vendor and costs back", () => {
    expect(ticketSections({ ...base, workOrderCount: 1 })).toEqual({ costs: true, vendor: true });
  });
  it("an estimated cost shows costs", () => {
    expect(ticketSections({ ...base, estimatedCost: 250 }).costs).toBe(true);
  });
  it("repair and closed stages show costs", () => {
    expect(ticketSections({ ...base, stage: "repair" }).costs).toBe(true);
    expect(ticketSections({ ...base, closed: true }).costs).toBe(true);
  });
});
