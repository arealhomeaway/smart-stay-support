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

import { readFileSync } from "node:fs";
import { PROHIBITED_PHRASES, STATE_GUIDANCE, OWNER_ZERO_COPY, worstState, pctOfRestricted } from "../cleaner-hours";

describe("STR safeguard phase 2 copy and helpers", () => {
  it("uses the exact owner-zero startup copy", () => {
    expect(OWNER_ZERO_COPY).toBe("Owner participation data is not yet sufficient for comparison. Fixed operational safeguards are being used.");
  });
  it("never displays prohibited tax phrases anywhere in the feature", () => {
    const files = [
      "src/lib/cleaner-hours.ts",
      "src/components/cleaner-hours/Safeguard.tsx",
      "src/routes/_authenticated/cleaner-hours.tsx",
      "src/routes/_authenticated/str-dispatch-check.tsx",
    ].map((f) => readFileSync(f, "utf8").toLowerCase().replace(/prohibited_phrases = \[[\s\S]*?\];/, ""));
    for (const text of files) for (const phrase of PROHIBITED_PHRASES) expect(text.includes(phrase)).toBe(false);
  });
  it("states that emergency and restricted dispatch need leadership", () => {
    expect(STATE_GUIDANCE.hard_block).toContain("emergency override");
    expect(STATE_GUIDANCE.restricted).toContain("Leadership review required");
  });
  it("orders states for the worst-case badge", () => {
    expect(worstState(["normal", "warning", "monitor"])).toBe("warning");
    expect(worstState(["restricted", "hard_block"])).toBe("hard_block");
    expect(pctOfRestricted(150)).toBe(100);
    expect(pctOfRestricted(37.5)).toBe(50);
  });
});
