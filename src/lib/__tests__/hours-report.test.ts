import { describe, expect, it } from "bun:test";
import { HOURS_REPORT_DEFAULTS as S, hoursBoxLines, hoursReportDue, nextHoursReportDate, renderHoursReport, reportDateLabel } from "@/lib/hours-report";

const end = new Date("2026-12-31T23:59:59-06:00");
const mon9 = new Date("2026-11-30T15:00:00Z"); // Monday Nov 30, 9:00 AM Central

describe("weekly hours report", () => {
  it("defaults: on, Monday, 9:00 AM", () => {
    expect([S.enabled, S.day, S.time]).toEqual([true, 1, "09:00"]);
  });
  it("{{Date}} reads Weekday, Month Day", () => {
    expect(reportDateLabel(mon9)).toBe("Monday, November 30");
  });
  it("box lines at 40 hours", () => {
    const l = hoursBoxLines(40 * 60, end, mon9);
    expect(l[0]).toBe("Hours logged: 40.0");
    expect(l[1]).toBe("To reach 100 hours: 60.0 more");
    expect(l[2]).toBe("To reach 120 hours (our recommendation): 80.0 more");
    expect(l[3]).toMatch(/^To reach 100 by December 31: about [\d.]+ hours a week \(4\.\d weeks left\)$/);
  });
  it("exactly 100.0 hours has not passed 100 (the goal is more than 100)", () => {
    expect(hoursBoxLines(100 * 60, end, mon9)[1]).not.toBe("You've passed 100 hours.");
  });
  it("above 100.0 hours the 100 line passes and the weekly line goes", () => {
    const l = hoursBoxLines(100 * 60 + 6, end, mon9);
    expect(l[1]).toBe("You've passed 100 hours.");
    expect(l).toHaveLength(3);
  });
  it("exactly 120.0 hours has not passed 120; above it has", () => {
    expect(hoursBoxLines(120 * 60, end, mon9)[2]).not.toBe("You've passed 120 hours.");
    expect(hoursBoxLines(120 * 60 + 6, end, mon9)[2]).toBe("You've passed 120 hours.");
  });
  it("no first name greets with Hi there", () => {
    expect(renderHoursReport(S, { firstName: null, reportedMinutes: 0, end, now: mon9 }).body).toContain("Hi there,");
  });
  it("under one week left: hours this week", () => {
    const l = hoursBoxLines(90 * 60, end, new Date("2026-12-28T15:00:00Z"));
    expect(l[3]).toBe("To reach 100 by December 31: 10.0 hours this week.");
  });
  it("merges first name and date", () => {
    const r = renderHoursReport(S, { firstName: "Rachel", reportedMinutes: 0, end, now: mon9 });
    expect(r.body.startsWith("Hi Rachel,\nHere's where your hours stand as of Monday, November 30.")).toBe(true);
    expect(r.subject).toBe("Your Active Owner hours this week");
  });
  it("due only on the saved day at or after the saved time", () => {
    expect(hoursReportDue(S, new Date("2026-11-30T14:55:00Z")).due).toBe(false);
    expect(hoursReportDue(S, mon9).due).toBe(true);
    expect(hoursReportDue({ ...S, enabled: false }, mon9).due).toBe(false);
  });
  it("never twice in one week: a sent week moves to the next", () => {
    const now = new Date("2026-11-30T16:00:00Z");
    expect(nextHoursReportDate({ ...S, day: 3 }, now, { sentWeeks: ["2026-11-30"], heldWeeks: [], endsOn: "2026-12-31" })).toBe("2026-12-09");
  });
  it("hold skips the next send only", () => {
    expect(nextHoursReportDate(S, new Date("2026-11-27T15:00:00Z"), { sentWeeks: [], heldWeeks: ["2026-11-30"], endsOn: "2026-12-31" })).toBe("2026-12-07");
  });
  it("stops after the program end", () => {
    expect(nextHoursReportDate(S, new Date("2026-12-29T15:00:00Z"), { sentWeeks: ["2026-12-28"], heldWeeks: [], endsOn: "2026-12-31" })).toBeNull();
  });
});
