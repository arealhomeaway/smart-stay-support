import { describe, expect, it } from "bun:test";
import { stayQualifies, touchBaseDueToCreate, touchBaseDueAt, touchBaseEventKey, touchBaseSyncDue } from "../guest-touch-base";

const b = (arrival: string, departure: string, extra = {}) => ({ id: 77, arrival, departure, status: "active", ...extra });

describe("guest touch base trigger", () => {
  it("needs 4 or more nights", () => {
    expect(stayQualifies(b("2026-11-10", "2026-11-14"))).toBe(true);
    expect(stayQualifies(b("2026-11-10", "2026-11-13"))).toBe(false);
  });
  it("skips stays that arrived before the start date", () => {
    expect(stayQualifies(b("2026-11-04", "2026-11-12"))).toBe(false);
  });
  it("skips cancelled reservations and blocks", () => {
    expect(stayQualifies(b("2026-11-10", "2026-11-20", { status: "cancelled" }))).toBe(false);
    expect(stayQualifies(b("2026-11-10", "2026-11-20", { is_block: true }))).toBe(false);
  });
  it("creates on day 2 Central, not on arrival day", () => {
    const stay = b("2026-11-10", "2026-11-15");
    expect(touchBaseDueToCreate(stay, new Date("2026-11-10T23:00:00Z"))).toBe(false);
    expect(touchBaseDueToCreate(stay, new Date("2026-11-11T07:00:00Z"))).toBe(true);
    expect(touchBaseDueToCreate(stay, new Date("2026-11-15T18:00:00Z"))).toBe(false);
  });
  it("is due 5 p.m. Central on day 2", () => {
    expect(touchBaseDueAt("2026-11-10").toISOString()).toBe("2026-11-11T23:00:00.000Z");
  });
  it("uses one key per reservation", () => {
    expect(touchBaseEventKey(77)).toBe("touchbase:77");
  });
  it("runs at most hourly", () => {
    expect(touchBaseSyncDue(new Date("2026-11-11T10:30:00Z"), "2026-11-11T10:00:00Z")).toBe(false);
    expect(touchBaseSyncDue(new Date("2026-11-11T11:00:00Z"), "2026-11-11T10:00:00Z")).toBe(true);
  });
});
