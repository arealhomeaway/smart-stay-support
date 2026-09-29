import { describe, expect, it } from "bun:test";
import { formatMinutes, groupSummary, METHOD_LABEL, type SummaryRow } from "../cleaner-hours";

const row = (o: Partial<SummaryRow>): SummaryRow => ({
  year: 2026, property_id: "p1", worker_id: "w1", unlinked_person_id: null, worker_name: "Maria",
  worker_type: "individual", attributed_minutes: 180, cleans: 1, reviewed_entries: 1, unreviewed_entries: 0,
  unknown_time_entries: 0, last_clean: "2026-10-01", lowest_confidence: "medium", ...o,
});

describe("cleaner hours helpers", () => {
  it("never renders unknown time as zero", () => {
    expect(formatMinutes(null)).toBe("Unknown");
    expect(formatMinutes(0)).toBe("0 m");
    expect(formatMinutes(185)).toBe("3 h 05 m");
  });
  it("gives full elapsed time to each of two cleaners", () => {
    const g = groupSummary([row({}), row({ worker_id: "w2", worker_name: "John" })], "worker");
    expect(g.map((x) => x.minutes)).toEqual([180, 180]);
    const p = groupSummary([row({}), row({ worker_id: "w2" })], "property");
    expect(p[0]!.minutes).toBe(360);
  });
  it("keeps unlinked Breezeway accounts separate, not merged by name", () => {
    const g = groupSummary([row({ worker_id: null, unlinked_person_id: 1 }), row({ worker_id: null, unlinked_person_id: 2 })], "worker");
    expect(g.length).toBe(2);
  });
  it("never uses 'hours worked' language", () => {
    expect(Object.values(METHOD_LABEL).some((l) => /hours worked/i.test(l))).toBe(false);
  });
});
