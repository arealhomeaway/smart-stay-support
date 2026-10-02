import { describe, expect, it } from "vitest";
import {
  canComplete,
  cleaningOutcome,
  effectiveOutreach,
  hostReviewSupported,
  platformOf,
  readTurnoverThresholds,
  stepChecks,
  turnoverRisk,
  type ReviewState,
} from "../departure-review";

const base: ReviewState = {
  clean_reviewed_at: null,
  property_attention: null,
  property_notes: null,
  damage_screen: null,
  damage_categories: [],
  outreach_decision: null,
  outreach_reason: null,
  outreach_status: null,
  host_review: null,
  booking_source: "Airbnb",
};
const ctx = { linkedWork: 0, hasClaim: false, externalReview: false };

describe("departure review steps", () => {
  it("blocks completion until every step is addressed", () => {
    expect(canComplete(base, ctx)).toBe(false);
    const done: ReviewState = {
      ...base,
      clean_reviewed_at: "2026-10-02T10:00:00Z",
      property_attention: "no",
      damage_screen: "no",
      outreach_decision: "yes",
      outreach_status: "requested",
      host_review: "completed",
    };
    expect(canComplete(done, ctx)).toBe(true);
  });
  it("requires notes when property needs attention and categories when damage flagged", () => {
    const r = { ...base, property_attention: "yes", damage_screen: "unsure" };
    const s = stepChecks(r, ctx);
    expect(s.find((x) => x.id === "property")!.done).toBe(false);
    expect(s.find((x) => x.id === "damage")!.done).toBe(false);
  });
  it("requires a reason when outreach is No", () => {
    const r = { ...base, outreach_decision: "no" };
    expect(stepChecks(r, ctx).find((x) => x.id === "outreach")!.done).toBe(false);
    expect(stepChecks({ ...r, outreach_reason: "Guest complaint" }, ctx).find((x) => x.id === "outreach")!.done).toBe(true);
  });
  it("an arrived external review means already reviewed", () => {
    expect(effectiveOutreach({ outreach_decision: "yes" }, true)).toBe("already_reviewed");
    expect(stepChecks(base, { ...ctx, externalReview: true }).find((x) => x.id === "outreach")!.done).toBe(true);
  });
  it("host review only for platforms that support it", () => {
    expect(hostReviewSupported("Airbnb")).toBe(true);
    expect(hostReviewSupported("VRBO")).toBe(true);
    expect(hostReviewSupported("Direct")).toBe(false);
    expect(stepChecks({ ...base, booking_source: "Direct" }, ctx).find((x) => x.id === "host")!.done).toBe(true);
    expect(platformOf("HomeAway")).toBe("vrbo");
  });
  it("cleaning outcome derives from answers", () => {
    expect(cleaningOutcome({ property_attention: "no", damage_screen: "no" })).toBe("accepted");
    expect(cleaningOutcome({ property_attention: "no", damage_screen: "unsure" })).toBe("follow_up_needed");
  });
});

describe("turnover risk", () => {
  // 2026-10-02 is CDT (UTC-5)
  const at = (hhmmUtc: string, day = "2026-10-02") => new Date(`${day}T${hhmmUtc}:00Z`);
  it("is quiet before 3:30 pm Central on checkout day", () => {
    expect(turnoverRisk("2026-10-02", false, at("20:00"))).toBeNull(); // 3:00 pm
  });
  it("is high risk from 3:30 pm and overdue from 4:00 pm", () => {
    expect(turnoverRisk("2026-10-02", false, at("20:30"))).toBe("high_risk");
    expect(turnoverRisk("2026-10-02", false, at("21:00"))).toBe("overdue");
  });
  it("is overdue on later days and never once the clean is complete", () => {
    expect(turnoverRisk("2026-10-01", false, at("14:00"))).toBe("overdue");
    expect(turnoverRisk("2026-10-01", true, at("14:00"))).toBeNull();
    expect(turnoverRisk("2026-10-03", false, at("23:00"))).toBeNull();
  });
  it("reads configured thresholds with safe defaults", () => {
    expect(readTurnoverThresholds({ high_risk: "14:00" })).toEqual({ high_risk: "14:00", overdue: "16:00" });
    expect(readTurnoverThresholds(null)).toEqual({ high_risk: "15:30", overdue: "16:00" });
  });
});
