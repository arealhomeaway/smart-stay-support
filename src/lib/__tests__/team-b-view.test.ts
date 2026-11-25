import { describe, expect, it as test } from "bun:test";
import { teamBTab, sourceLabel, inDueFilter, rollUpReported, hiddenOnboarding, parseTeamBTab, parseTeamBDue, inTeamBScope, dueWindows } from "../team-b-view";

const t = (o: Record<string, unknown>) => ({ id: "x", status: "open", ...o }) as never;
const now = new Date("2026-11-25T16:00:00Z"); // Wed Nov 25 Central

describe("Team B view", () => {
  test("Maintenance opens first and Due today is default", () => {
    expect(parseTeamBTab(undefined)).toBe("maintenance");
    expect(parseTeamBDue(undefined)).toBe("today");
  });
  test("tabs", () => {
    expect(teamBTab(t({ external_source: "breezeway" }))).toBe("reported");
    expect(teamBTab(t({ work_types: { name: "Cleaning Review" } }))).toBe("cleaning");
    expect(teamBTab(t({ work_types: { name: "Quarterly inspection review" } }))).toBe("inspection");
    expect(teamBTab(t({ maintenance_category: "lawn_care" }))).toBe("lawn");
    expect(teamBTab(t({ external_source: "email" }))).toBe("maintenance");
  });
  test("source labels", () => {
    expect(sourceLabel(t({ external_source: "breezeway" }))).toBe("Breezeway reported issue");
    expect(sourceLabel(t({ external_source: "email" }))).toBe("Email");
    expect(sourceLabel(t({ source_channel: "inspection" }))).toBe("Breezeway");
    expect(sourceLabel(t({ source_channel: "internal" }))).toBe("Manual");
  });
  test("unowned bridge and email tickets show in Team B, unowned manual do not", () => {
    expect(inTeamBScope(t({ external_source: "breezeway" }), null, null, "B")).toBe(true);
    expect(inTeamBScope(t({ external_source: "email" }), null, null, "B")).toBe(true);
    expect(inTeamBScope(t({ source_channel: "internal" }), null, null, "B")).toBe(false);
    expect(inTeamBScope(t({}), "A", "u", "B")).toBe(false);
  });
  test("week runs today through Sunday; next week Monday through Sunday", () => {
    expect(dueWindows(now)).toEqual({ today: "2026-11-25", sunday: "2026-11-29", nextMonday: "2026-11-30", nextSunday: "2026-12-06" });
    expect(inDueFilter(t({ due_on: "2026-11-24" }), "today", now)).toBe(true);
    expect(inDueFilter(t({ due_on: "2026-11-29" }), "week", now)).toBe(true);
    expect(inDueFilter(t({ due_on: "2026-11-30" }), "week", now)).toBe(false);
    expect(inDueFilter(t({ due_on: "2026-12-06" }), "next", now)).toBe(true);
    expect(inDueFilter(t({ status: "closed" }), "closed", now)).toBe(true);
    expect(inDueFilter(t({ status: "closed", due_on: "2026-11-25" }), "today", now)).toBe(false);
  });
  test("reported issues roll up per property, single stays alone", () => {
    const rows = [
      t({ id: "a", property_id: "p1", priority: "p3", external_source: "breezeway" }),
      t({ id: "b", property_id: "p1", priority: "p1", external_source: "breezeway" }),
      t({ id: "c", property_id: "p1", priority: "p2", external_source: "breezeway" }),
      t({ id: "d", property_id: "p2", priority: "p2", external_source: "breezeway" }),
    ];
    const out = rollUpReported(rows) as Array<{ id: string; title?: string; rollup?: unknown[]; priority?: string }>;
    expect(out.length).toBe(2);
    expect(out[0]?.title).toBe("3 reported issues");
    expect(out[0]?.priority).toBe("p1");
    expect(out[0]?.rollup?.length).toBe(3);
    expect(out[1]?.id).toBe("d");
  });
  test("onboarding homes hidden, handoff carry-over kept", () => {
    expect(hiddenOnboarding(t({ properties: { lifecycle_status: "onboarding" } }))).toBe(true);
    expect(hiddenOnboarding(t({ properties: { lifecycle_status: "onboarding" }, from_handoff: true }))).toBe(false);
    expect(hiddenOnboarding(t({ properties: { lifecycle_status: "active_operations" } }))).toBe(false);
  });
});
