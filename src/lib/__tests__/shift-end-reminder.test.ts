import { describe, expect, it } from "bun:test";
import { bannerText, dueToday, shiftEndSoon } from "@/lib/shift-end-reminder";

// Nov 25 2026, Central is UTC-6.
const at = (hhmm: string) => new Date(`2026-11-25T${hhmm}:00-06:00`);
const shift = (blocks: { start: number; end: number }[], off = false) => ({
  date: "2026-11-25", off,
  blocks: blocks.map((b) => ({ roleCode: "ge_day", lunchStart: null, lunchEnd: null, covering: false, ...b })),
});

describe("shift-end reminder", () => {
  it("shows 30 minutes before the shift ends, not before", () => {
    const s = shift([{ start: 8 * 60, end: 17 * 60 }]);
    expect(shiftEndSoon(s, at("16:29"))).toBeNull();
    expect(Date.parse(shiftEndSoon(s, at("16:30"))!)).toBe(Date.parse("2026-11-25T17:00:00-06:00"));
    expect(Date.parse(shiftEndSoon(s, at("16:45"))!)).toBe(Date.parse("2026-11-25T17:00:00-06:00"));
    expect(shiftEndSoon(s, at("17:00"))).toBeNull();
  });
  it("never shows on a day off, or between two back-to-back blocks", () => {
    expect(shiftEndSoon(shift([{ start: 480, end: 1020 }], true), at("16:45"))).toBeNull();
    expect(shiftEndSoon(shift([{ start: 480, end: 1020 }, { start: 1020, end: 1320 }]), at("16:45"))).toBeNull();
  });
  it("counts tickets due today or late, not tomorrow or closed", () => {
    const now = at("16:45");
    expect(dueToday({ status: "open", due_on: "2026-11-25" }, now)).toBe(true);
    expect(dueToday({ status: "open", due_on: "2026-11-24" }, now)).toBe(true);
    expect(dueToday({ status: "open", due_on: "2026-11-26" }, now)).toBe(false);
    expect(dueToday({ status: "closed", due_on: "2026-11-25" }, now)).toBe(false);
    expect(dueToday({ status: "open", action_due_at: "2026-11-25T22:00:00-06:00" }, now)).toBe(true);
    expect(dueToday({ status: "open", action_due_at: "2026-11-26T09:00:00-06:00" }, now)).toBe(false);
  });
  it("uses the spec wording", () => {
    expect(bannerText("2026-11-25T23:00:00.000Z", 3)).toBe("Prepare your handoffs. Your shift ends at 5:00 PM and 3 open tickets have same-day due dates.");
  });
});
