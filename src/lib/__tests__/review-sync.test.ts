import { describe, expect, it } from "bun:test";
import { nightlyReviewSyncDue, reviewSyncSince } from "@/lib/review-sync";
import { reviewChanged } from "@/lib/guest-feedback.server";

describe("nightly review import", () => {
  // 2026-11-04 08:30 UTC = 2:30 a.m. Central (CST)
  const night = new Date("2026-11-04T08:30:00Z");
  it("runs only in the 2 a.m. Central hour", () => {
    expect(nightlyReviewSyncDue(night, null)).toBe(true);
    expect(nightlyReviewSyncDue(new Date("2026-11-04T15:00:00Z"), null)).toBe(false);
  });
  it("never runs twice in one night", () => {
    expect(nightlyReviewSyncDue(night, "2026-11-04T08:05:00Z")).toBe(false);
    expect(nightlyReviewSyncDue(night, "2026-11-03T08:05:00Z")).toBe(true);
  });
  it("looks back from the last good run with overlap", () => {
    expect(reviewSyncSince(night, "2026-11-03T08:05:00Z")).toBe("2026-11-01T08:05:00.000Z");
  });
  it("detects edited reviews only when something changed", () => {
    const a = { summary: "Great", response_text: null, rating: 5 };
    expect(reviewChanged(a, { ...a })).toBe(false);
    expect(reviewChanged(a, { ...a, response_text: "Thanks" })).toBe(true);
  });
});
