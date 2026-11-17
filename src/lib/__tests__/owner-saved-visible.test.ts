/**
 * Owner saves stay visible (approved by the Admin, Nov 16): hours an owner logs for a card show on
 * that card even when she adds her own words after the title, her own entries show as Waiting for
 * review until the team looks at them, and the tagged/general split reads her saved entries.
 */
import { describe, expect, it } from "bun:test";
import { entriesForCard, entryWaitingForReview, hoursSplit, type HourEntry } from "@/lib/owner-portal-look";

const card = { title: "Share your home design preferences", reviewId: null, propertyIds: ["h1"] };
const e = (activity: string, minutes: number, extra: Partial<HourEntry> = {}): HourEntry => ({ activity, minutes, propertyIds: ["h1"], ...extra });

describe("hours on a completed card", () => {
  it("counts the card title followed by her own notes (160 + 120 minutes)", () => {
    const mine = entriesForCard([
      e("Share your home design preferences. Looked through popular styles", 160),
      e("Share your home design preferences. Researched styles, colors, decor", 120),
    ], card);
    expect(mine.reduce((n, x) => n + x.minutes, 0)).toBe(280);
  });
  it("still counts the title alone", () => {
    expect(entriesForCard([e("Share your home design preferences", 60)], card)).toHaveLength(1);
  });
  it("never counts a different activity or a longer word after the title", () => {
    expect(entriesForCard([
      e("Find and talk to home insurance agent", 160),
      e("Share your home design preferencesX", 30),
    ], card)).toHaveLength(0);
  });
  it("never counts a superseded entry or another home's entry", () => {
    expect(entriesForCard([
      e("Share your home design preferences. notes", 60, { superseded: true }),
      e("Share your home design preferences. notes", 60, { propertyIds: ["h2"] }),
    ], card)).toHaveLength(0);
  });
});

describe("Waiting for review", () => {
  it("a submitted entry with no review is waiting", () => {
    expect(entryWaitingForReview({ review_status: "submitted", reviewed_at: null })).toBe(true);
  });
  it("a reviewed entry is not waiting", () => {
    expect(entryWaitingForReview({ review_status: "approved", reviewed_at: "2026-11-17T15:00:00Z" })).toBe(false);
    expect(entryWaitingForReview({ review_status: "submitted", reviewed_at: "2026-11-17T15:00:00Z" })).toBe(false);
  });
});

describe("tagged to a home vs general", () => {
  it("five tagged entries of 160, 160, 160, 180 and 120 minutes read 780 tagged, 0 general", () => {
    expect(hoursSplit([160, 160, 160, 180, 120].map((m) => e("x", m)))).toEqual({ taggedMinutes: 780, generalMinutes: 0 });
  });
  it("an entry with no home is general; superseded entries never count", () => {
    expect(hoursSplit([e("x", 60, { propertyIds: [] }), e("y", 30, { superseded: true })])).toEqual({ taggedMinutes: 0, generalMinutes: 60 });
  });
});
