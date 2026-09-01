/**
 * After-hours window arithmetic. The window is configuration, so these tests
 * pin the behaviour that matters operationally: who owns a 2 a.m. issue, when
 * daytime routing resumes, and that the maths survives a daylight-saving
 * change in America/Chicago.
 */
import { describe, expect, it } from "bun:test";
import { coverageNow, lastAfterHoursWindow, windowLabel } from "@/lib/coverage";

const CFG = {
  after_hours_start_minute: 1320, // 10 p.m.
  after_hours_end_minute: 480, // 8 a.m.
  timezone: "America/Chicago",
};

describe("coverageNow", () => {
  it("labels the approved window", () => {
    expect(windowLabel(CFG)).toBe("10 p.m.–8 a.m. Central");
  });

  it("is daytime at noon Central", () => {
    const state = coverageNow(CFG, new Date("2026-09-10T17:00:00Z")); // 12:00 CDT
    expect(state.afterHours).toBe(false);
    expect(state.rosterDate).toBe("2026-09-10");
  });

  it("is after hours at 10:30 p.m. Central and keeps that evening's roster date", () => {
    const state = coverageNow(CFG, new Date("2026-09-11T03:30:00Z")); // 22:30 CDT Sep 10
    expect(state.afterHours).toBe(true);
    expect(state.rosterDate).toBe("2026-09-10");
  });

  it("attributes a 2 a.m. issue to the previous evening's on-call person", () => {
    const state = coverageNow(CFG, new Date("2026-09-11T07:00:00Z")); // 02:00 CDT Sep 11
    expect(state.afterHours).toBe(true);
    expect(state.rosterDate).toBe("2026-09-10");
  });

  it("resumes daytime routing at 8 a.m. Central", () => {
    expect(coverageNow(CFG, new Date("2026-09-11T13:00:00Z")).afterHours).toBe(false); // 08:00 CDT
    expect(coverageNow(CFG, new Date("2026-09-11T12:59:00Z")).afterHours).toBe(true); // 07:59 CDT
  });

  it("reports not configured when the business has not set hours", () => {
    const state = coverageNow({ ...CFG, after_hours_start_minute: null, after_hours_end_minute: null });
    expect(state.configured).toBe(false);
    expect(state.afterHours).toBe(false);
    expect(windowLabel({ ...CFG, after_hours_start_minute: null })).toBeNull();
  });
});

describe("lastAfterHoursWindow", () => {
  it("spans 10 p.m. to 8 a.m. across midnight", () => {
    const w = lastAfterHoursWindow(CFG, new Date("2026-09-11T14:00:00Z"))!; // 09:00 CDT
    expect(w.rosterDate).toBe("2026-09-10");
    expect(w.startsAt.toISOString()).toBe("2026-09-11T03:00:00.000Z");
    expect(w.endsAt.toISOString()).toBe("2026-09-11T13:00:00.000Z");
  });

  it("stays DST-correct across the November fall-back", () => {
    // CDT (UTC-5) at 10 p.m. Nov 1 -> CST (UTC-6) at 8 a.m. Nov 2.
    const w = lastAfterHoursWindow(CFG, new Date("2026-11-02T15:00:00Z"))!;
    expect(w.rosterDate).toBe("2026-11-01");
    expect(w.startsAt.toISOString()).toBe("2026-11-02T03:00:00.000Z");
    expect(w.endsAt.toISOString()).toBe("2026-11-02T14:00:00.000Z");
  });

  it("returns nothing when no window is configured", () => {
    expect(lastAfterHoursWindow({ ...CFG, after_hours_end_minute: null })).toBeNull();
  });
});
