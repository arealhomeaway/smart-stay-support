import { describe, expect, it } from "bun:test";
import { matchAll, matchClean, readMatchConfig, type BookingInput, type CleanInput } from "../departure-matching";

const cfg = readMatchConfig(null);
const today = "2026-10-02";
const clean = (o: Partial<CleanInput> = {}): CleanInput => ({
  id: "c1", task_id: 1, property_id: "p", ownerrez_property_id: "10", department: "housekeeping",
  name: "ARHA Departure Clean (Updated)", status: "Finished", scheduled_date: "2026-09-20", ...o,
});
const bk = (id: string, arrival: string, departure: string): BookingInput => ({ id, property_id: "10", arrival, departure });

describe("departure clean matching", () => {
  it("matches home + checkout date with high confidence", () => {
    const r = matchClean(clean(), [bk("b1", "2026-09-15", "2026-09-20"), bk("b2", "2026-09-20", "2026-09-25")], cfg, today);
    expect(r.state).toBe("matched");
    expect(r.booking_id).toBe("b1");
    expect(r.confidence).toBe("high");
  });
  it("treats non-departure templates as not departure cleans", () => {
    expect(matchClean(clean({ name: "ARHA Vacancy Cleaning" }), [], cfg, today).state).toBe("not_departure");
    expect(matchClean(clean({ name: "non- okc arha departure clean (updated)" }), [bk("b1", "2026-09-15", "2026-09-20")], cfg, today).state).toBe("matched");
  });
  it("flags missing data", () => {
    expect(matchClean(clean({ scheduled_date: null }), [], cfg, today).state).toBe("missing_data");
    expect(matchClean(clean({ ownerrez_property_id: null }), [], cfg, today).state).toBe("missing_data");
  });
  it("refuses two same-day checkouts", () => {
    const r = matchClean(clean(), [bk("b1", "2026-09-15", "2026-09-20"), bk("b2", "2026-09-18", "2026-09-20")], cfg, today);
    expect(r.state).toBe("multiple_reservations");
    expect(r.candidate_ids.sort()).toEqual(["b1", "b2"]);
  });
  it("matches a later clean with medium confidence when nobody stayed in between", () => {
    const r = matchClean(clean({ scheduled_date: "2026-09-21" }), [bk("b1", "2026-09-15", "2026-09-20")], cfg, today);
    expect(r.state).toBe("matched");
    expect(r.method).toBe("late_clean");
    expect(r.confidence).toBe("medium");
  });
  it("does not match a later clean when another guest arrived in between", () => {
    const r = matchClean(clean({ scheduled_date: "2026-09-22" }), [bk("b1", "2026-09-15", "2026-09-20"), bk("b2", "2026-09-20", "2026-09-24")], cfg, today);
    expect(r.state).toBe("no_reservation");
  });
  it("a later clean belongs to the last stay before it, not an earlier one", () => {
    const r = matchClean(clean({ scheduled_date: "2026-09-22" }), [bk("b1", "2026-09-19", "2026-09-20"), bk("b2", "2026-09-20", "2026-09-21")], cfg, today);
    expect(r.booking_id).toBe("b2");
  });
  it("refuses overlapping stays that both ended inside the late window", () => {
    const r = matchClean(clean({ scheduled_date: "2026-09-22" }), [bk("b1", "2026-09-15", "2026-09-20"), bk("b2", "2026-09-16", "2026-09-21")], cfg, today);
    expect(r.state).toBe("multiple_reservations");
  });
  it("no match when stay has not ended or nothing checks out", () => {
    expect(matchClean(clean({ scheduled_date: "2026-10-05" }), [bk("b1", "2026-10-01", "2026-10-05")], cfg, today).state).toBe("no_reservation");
    expect(matchClean(clean(), [], cfg, today).state).toBe("no_reservation");
  });
  it("keeps one clean per reservation; extra cleans are already linked", () => {
    const rs = matchAll(
      [clean({ id: "a", task_id: 2, scheduled_date: "2026-09-21" }), clean({ id: "b", task_id: 1 })],
      [bk("b1", "2026-09-15", "2026-09-20")], cfg, today,
    );
    expect(rs.find((r) => r.clean_id === "b")!.state).toBe("matched");
    expect(rs.find((r) => r.clean_id === "a")!.state).toBe("already_linked");
  });
  it("an existing (manual) link wins over a new candidate", () => {
    const rs = matchAll([clean({ id: "b" })], [bk("b1", "2026-09-15", "2026-09-20")], cfg, today, new Map([["b1", "manual-clean"]]));
    expect(rs[0]!.state).toBe("already_linked");
  });
});
