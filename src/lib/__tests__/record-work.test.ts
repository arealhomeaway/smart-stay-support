import { describe, expect, it as test } from "bun:test";
import { applyRecordWorkSituation, canOverrideRecordWorkType, situationEntryKind, suggestedRecordWorkSituation } from "../record-work";
import { resolveWorkType, situationById } from "../situations";
import { mechanicalPriority, slaDueDates } from "../tickets";

const mappings = [
  ["guest_needs_now", "Current or past guest request"],
  ["arrival_info", "Arrival information"],
  ["new_booking", "New booking request"],
  ["review_log", "Guest review, survey and rating logs"],
  ["unsafe", "Immediate maintenance"],
  ["broken_now", "Immediate maintenance"],
  ["broken_later", "Ongoing maintenance"],
  ["clean_now", "Immediate cleaning need"],
  ["clean_ongoing", "Ongoing cleaning need"],
  ["locked_out", "Lock offline or low-battery alert"],
  ["access", "Lock offline or low-battery alert"],
  ["owner_issue", "Escalated owner issue"],
  ["owner_update", "Property or owner information update"],
  ["damage_claim", "Claims"],
] as const;
// Deliberately distinct seat/clock values prove the live catalog row is carried unchanged.
const catalog = [...new Set(mappings.map(([, name]) => name)), "Tenant lead tracker"].map((name, i) => ({
  id: `type-${i}`, name, functional_role_code: `catalog-seat-${i}`, default_priority: "p3",
  response_minutes: 11 + i, action_start_minutes: 41 + i,
}));
const draft = { title: "Kitchen problem", description: "Guest reported a problem", property_id: "home-fern", source_channel: "phone", situation_id: "", work_type_id: "", guest_impact: "none", occupancy_status: "vacant" };

describe("Record work uses existing situation mappings", () => {
  for (const [id, name] of mappings) {
    test(`${id} retains its work type, catalog seat and clocks`, () => {
      const next = applyRecordWorkSituation(draft, id, catalog);
      const expected = catalog.find((w) => w.name === name);
      if (!expected) throw new Error(`Missing fixture: ${name}`);
      const resolved = resolveWorkType(situationById(next.situation_id), catalog);
      expect(next.work_type_id).toBe(expected.id);
      expect(resolved).toBe(expected);
      expect(resolved?.functional_role_code).toBe(expected.functional_role_code);
      const s = situationById(id);
      const priority = mechanicalPriority(expected.default_priority, next.guest_impact, next.occupancy_status, s?.priorityCeiling);
      const now = new Date("2026-11-05T21:00:00Z");
      const dates = slaDueDates(priority, now, resolved);
      expect(dates.response_due_at).toBe(new Date(now.getTime() + expected.response_minutes * 60000).toISOString());
      expect(dates.action_due_at).toBe(new Date(now.getTime() + expected.action_start_minutes * 60000).toISOString());
    });
  }
  for (const id of ["unsafe", "broken_now", "broken_later"]) {
    test(`${id} hands off to maintenance with summary, home and source intact`, () => {
      expect(situationEntryKind(id)).toBe("maintenance");
      const next = applyRecordWorkSituation(draft, id, catalog);
      expect(next.title).toBe("Kitchen problem");
      expect(next.description).toBe("Guest reported a problem");
      expect(next.property_id).toBe("home-fern");
      expect(next.source_channel).toBe("phone");
      expect(next.work_type_id).not.toBe("");
    });
  }
  test("access and cleaning stay Ops", () => {
    for (const id of ["locked_out", "access", "clean_now", "clean_ongoing"]) expect(situationEntryKind(id)).toBe("ops");
  });
  test("internal remains unmapped rather than inventing an owning seat or clocks", () => {
    expect(applyRecordWorkSituation(draft, "internal", catalog).work_type_id).toBe("");
  });
});

describe("Record work choice and override", () => {
  test("PC cannot override the work type", () => expect(canOverrideRecordWorkType(["tech"])).toBe(false));
  test("Supervisor can override", () => expect(canOverrideRecordWorkType(["manager"])).toBe(true));
  test("Admin can override", () => expect(canOverrideRecordWorkType(["admin"])).toBe(true));
  test("other roles do not gain override authority", () => expect(canOverrideRecordWorkType(["onboarding", "owner", "vendor"])).toBe(false));
  test("description preselects the suggested tile", () => {
    const guess = suggestedRecordWorkSituation("Fridge is not cooling, guest reported it", false, "ops");
    expect(guess?.situation.id).toBe("broken_now");
    expect(applyRecordWorkSituation(draft, guess?.situation.id ?? "", catalog).situation_id).toBe("broken_now");
  });
  test("a manual tile choice stops new suggestions", () => expect(suggestedRecordWorkSituation("Guest smells gas", true, "ops")).toBeNull());
  test("maintenance keeps its selected work type after handoff", () => expect(suggestedRecordWorkSituation("Guest needs towels", false, "maintenance")).toBeNull());
});