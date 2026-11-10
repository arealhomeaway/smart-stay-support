import { describe, expect, it } from "bun:test";
import { CHECKLIST, centralToday, countText, mondayOf, reviewProblem, TRACKER_COPY } from "@/lib/manual-trackers";

const ALL = Object.fromEntries(CHECKLIST.map((c) => [c.key, true]));

describe("manual trackers (Build 14) helpers", () => {
  it("a record is clean only when every item is there, proof included", () => {
    expect(reviewProblem(true, ALL, "", "")).toBeNull();
    expect(reviewProblem(true, { ...ALL, proof_attached: false }, "", "")).toContain("proof included");
  });
  it("Not clean needs a note and a link to the evidence", () => {
    expect(reviewProblem(false, ALL, "", "https://x.example/a")).toContain("note");
    expect(reviewProblem(false, ALL, "Missing photo", "not a link")).toContain("link");
    expect(reviewProblem(false, ALL, "Missing photo", "https://x.example/a")).toBeNull();
  });
  it("weeks start on Monday and Central dates are used", () => {
    expect(mondayOf("2026-11-19")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
    expect(centralToday(new Date("2026-11-17T04:30:00Z"))).toBe("2026-11-16");
  });
  it("counts read as plain words", () => {
    expect(countText({ met: 4, total: 5 })).toBe("4 of 5 (80%)");
    expect(countText({ met: 0, total: 0 })).toBe("None");
  });
  it("screen words follow the word rules", () => {
    const words = JSON.stringify(TRACKER_COPY) + JSON.stringify(CHECKLIST);
    expect(words).not.toMatch(/[\u2013\u2014]/);
    expect(words).not.toMatch(/\bseat\b|Median|\bP[1-4]\b/i);
  });
});
