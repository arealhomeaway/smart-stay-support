import { describe, expect, it } from "bun:test";
import { dayLabel, moveWithinDay, scheduledNext30, sortPlan, waitingOnHomeowner, type PlanItem, type ScheduleRow } from "@/lib/after-handoff";
import { seatSections } from "@/lib/coverage-model";
import { TEAMS } from "@/lib/tickets";
import { DEPARTMENTS } from "@/lib/shell-nav";

const item = (id: string, d: number, o: number): PlanItem => ({ id, title: id, source_kind: "template", template_id: "t", library_id: null, send_after_days: d, active: true, sort_order: o, notes: null });
const row = (id: string, send_on: string, status: ScheduleRow["status"] = "scheduled"): ScheduleRow => ({ id, program_id: "p", property_id: "h", title: id, source_kind: "library", send_on, status, one_off: false });

describe("after-handoff plan rules", () => {
  it("labels day 0 as the day of acceptance", () => expect(dayLabel(0)).toBe("Day 0"));
  it("sorts by send day, then saved order", () => expect(sortPlan([item("c", 3, 1), item("b", 0, 2), item("a", 0, 1)]).map((x) => x.id)).toEqual(["a", "b", "c"]));
  it("reorders only within the same day", () => {
    const items = [item("a", 0, 1), item("b", 0, 2), item("c", 3, 1)];
    expect(moveWithinDay(items, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveWithinDay(items, "b", 1)).toEqual(["a", "b", "c"]);
  });
  it("Scheduled shows only scheduled rows within the next 30 days", () => {
    const r = scheduledNext30([row("late", "2026-12-15"), row("in", "2026-11-28"), row("skip", "2026-11-01", "skipped"), row("soon", "2026-10-30")], "2026-10-29");
    expect(r.map((x) => x.id)).toEqual(["soon", "in"]);
  });
  it("Waiting on homeowner is oldest first with days waiting", () => {
    const w = waitingOnHomeowner([
      { id: "new", title: "", property_id: null, sent_at: "2026-10-27T10:00:00Z", responded_at: null, status: "open" },
      { id: "old", title: "", property_id: null, sent_at: "2026-10-19T10:00:00Z", responded_at: null, status: "open" },
      { id: "done", title: "", property_id: null, sent_at: "2026-10-01T10:00:00Z", responded_at: "2026-10-02T00:00:00Z", status: "open" },
    ], "2026-10-29");
    expect(w.map((x) => [x.id, x.daysWaiting])).toEqual([["old", 10], ["new", 2]]);
  });
  it("Team & Coverage shows an Operations section for the follow-up seat", () => {
    expect(seatSections(TEAMS).map((s) => s.value)).toContain("operations");
  });
  it("both pages are in the Active Owner menu", () => {
    const ao = DEPARTMENTS.find((d) => d.key === "active-owner");
    expect(ao?.links.map((l) => l.to)).toEqual(expect.arrayContaining(["/owner-handoff-plan", "/active-owner-followup"]));
    expect(ao?.match("/active-owner-followup")).toBe(true);
  });
});
