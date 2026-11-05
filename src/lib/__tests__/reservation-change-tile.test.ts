import { describe, expect, it } from "bun:test";
import { CHECKLIST_CATEGORIES, templateProblems } from "../ticket-checklists";
import { suggestedRecordWorkSituation, applyRecordWorkSituation, situationEntryKind } from "../record-work";
import { situationById } from "../situations";
import { cleaningRepeatRevision, isRepeatCleaningComplaint } from "../cleaning-repeat-complaint";
import { SEED_TEMPLATES } from "../ticket-checklist-seed";

describe("reservation change intake", () => {
  it("maps the Guest situation exclusively to booking and retains the catalog row", () => {
    expect(situationById("reservation_change")?.group).toBe("guest");
    for (const guest of [true, false]) {
      expect(CHECKLIST_CATEGORIES.filter((c) => c.situation(guest) === "reservation_change").map((c) => c.id)).toEqual(["booking"]);
      expect(CHECKLIST_CATEGORIES.filter((c) => c.situation(guest) === "guest_needs_now").map((c) => c.id)).toEqual(["other_complaint"]);
    }
    const type = { id: "existing", name: "Current or past guest request", functional_role_code: "ge_day", response_minutes: 3, action_start_minutes: 5 };
    const next = applyRecordWorkSituation({ situation_id: "", work_type_id: "", guest_impact: "none", occupancy_status: "vacant" }, "reservation_change", [type]);
    expect(next.work_type_id).toBe(type.id);
    expect(situationEntryKind(next.situation_id)).toBe("ops");
  });
  for (const text of ["Early check-in request", "Early check in", "Late checkout", "Late check-out", "Extend stay", "Change dates", "Double booked", "Double booking"]) {
    it(`suggests reservation changes for ${text}`, () => expect(suggestedRecordWorkSituation(text, false, "ops")?.situation.id).toBe("reservation_change"));
  }
  it("leaves new stay inquiries unchanged and safety first", () => {
    expect(suggestedRecordWorkSituation("New booking inquiry", false, "ops")?.situation.id).toBe("new_booking");
    expect(suggestedRecordWorkSituation("Early check-in and gas smell", false, "ops")?.situation.id).toBe("unsafe");
    expect(suggestedRecordWorkSituation("Early check-in", true, "ops")).toBeNull();
  });
});

describe("cleaning complaint window", () => {
  const current = { cleanerId: "cleaner-a", at: "2026-11-05T12:00:00Z" };
  it("includes a complaint exactly 60 days earlier for the same cleaner", () => expect(isRepeatCleaningComplaint(current, { cleanerId: "cleaner-a", at: "2026-09-06T12:00:00Z" })).toBe(true));
  it("excludes complaints older than 60 days", () => expect(isRepeatCleaningComplaint(current, { cleanerId: "cleaner-a", at: "2026-09-06T11:59:59Z" })).toBe(false));
  it("excludes a different or unknown cleaner", () => {
    expect(isRepeatCleaningComplaint(current, { cleanerId: "cleaner-b", at: "2026-11-04T12:00:00Z" })).toBe(false);
    expect(isRepeatCleaningComplaint({ ...current, cleanerId: null }, { cleanerId: null, at: "2026-11-04T12:00:00Z" })).toBe(false);
  });
  it("excludes current, future and invalid dates", () => {
    for (const at of [current.at, "2026-11-06T12:00:00Z", "invalid"]) expect(isRepeatCleaningComplaint(current, { cleanerId: current.cleanerId, at })).toBe(false);
  });
  it("prepares a separate valid version with the 60-day setting and preserves the seed", () => {
    const seed = SEED_TEMPLATES.find((t) => t.category === "cleaning");
    if (!seed) throw new Error("Missing cleaning seed");
    const before = JSON.stringify(seed);
    const revision = cleaningRepeatRevision(seed);
    expect(revision.settings?.find((s) => s.key === "repeat_window_days")?.value).toBe("60");
    expect(templateProblems(revision)).toEqual([]);
    expect(JSON.stringify(seed)).toBe(before);
  });
});