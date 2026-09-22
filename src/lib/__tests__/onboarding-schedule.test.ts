import { describe, expect, it } from "bun:test";
import {
  ACTIVE_OWNER_WINDOW_DAYS,
  STANDARD_WINDOW_DAYS,
  asanaOffsetFor,
  offsetFromAccess,
  pacedOffset,
  setupWindowDays,
} from "../onboarding-schedule";

describe("onboarding deadlines anchored to access", () => {
  it("keeps the day the Asana plan states for each named step", () => {
    expect(asanaOffsetFor("Send Warm Transfer to PM Email & PDF")).toBe(0);
    expect(asanaOffsetFor("Obtain assessment date/time from realtor and update project plan")).toBe(
      2,
    );
    expect(asanaOffsetFor("Review the New House Setup Form Results")).toBe(5);
    expect(asanaOffsetFor('Update Breezeway "Details" & Finalize Setup on Active Page')).toBe(7);
    expect(asanaOffsetFor("Request repair estimates from handyman and other vendors")).toBe(9);
    expect(
      asanaOffsetFor("Purchase door locks, curtain rods, curtain panels, and all related accessories"),
    ).toBe(14);
    expect(asanaOffsetFor("Send Mood Boards to Owner")).toBe(18);
  });

  it("states no day for a step the Asana plan does not name", () => {
    expect(asanaOffsetFor("Transfer trash service")).toBeNull();
  });

  it("paces unnamed steps evenly across the window, in plan order", () => {
    expect(pacedOffset(0, 11, 21)).toBe(0);
    expect(pacedOffset(5, 11, 21)).toBe(11);
    expect(pacedOffset(10, 11, 21)).toBe(21);
  });

  it("uses three weeks for a standard home and four for an Active Owner home", () => {
    expect(setupWindowDays(false)).toBe(STANDARD_WINDOW_DAYS);
    expect(setupWindowDays(true)).toBe(ACTIVE_OWNER_WINDOW_DAYS);
  });

  it("stretches the named days with the longer Active Owner window", () => {
    const named = { title: "Create 3D room models", position: 3, total: 40 };
    expect(offsetFromAccess({ ...named, windowDays: STANDARD_WINDOW_DAYS })).toBe(14);
    expect(offsetFromAccess({ ...named, windowDays: ACTIVE_OWNER_WINDOW_DAYS })).toBe(19);
  });

  it("falls back to pacing when the step is not one of the named ones", () => {
    expect(
      offsetFromAccess({ title: "Transfer trash service", position: 0, total: 3, windowDays: 21 }),
    ).toBe(0);
  });
});
