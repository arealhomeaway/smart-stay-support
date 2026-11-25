import { describe, expect, it } from "bun:test";
import { loadFor, onShiftAt, sectionRows } from "@/lib/oversight-sections";

const now = new Date("2026-11-25T18:00:00Z"); // 12:00 Central
const t = (id: string, o: Record<string, unknown> = {}) => ({
  id, status: "open", priority: "p3", reported_at: "2026-11-20T00:00:00Z", assigned_to: null, current_action_owner: null,
  due_on: "2026-12-01", source_channel: "breezeway", ...o,
});

describe("oversight sections", () => {
  it("P1 right now lists only P1, oldest first", () => {
    const rows = sectionRows("p1", [t("a", { priority: "p1", reported_at: "2026-11-24T00:00:00Z" }), t("b", { priority: "p1", reported_at: "2026-11-22T00:00:00Z" }), t("c")], now);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("No owner sorts most urgent first", () => {
    const rows = sectionRows("no_owner", [t("a"), t("b", { priority: "p1" }), t("c", { assigned_to: "u1" })], now);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("Past due uses the due date for non-guest tickets", () => {
    const rows = sectionRows("past_due", [t("late", { due_on: "2026-11-20", response_due_at: "2026-11-01T00:00:00Z" }), t("ok", { response_due_at: "2026-11-01T00:00:00Z" })], now);
    expect(rows.map((r) => r.id)).toEqual(["late"]);
  });
  it("Who has what counts open, past due and due today per person", () => {
    const [l] = loadFor(["u1"], [t("a", { assigned_to: "u1" }), t("b", { assigned_to: "u1", due_on: "2026-11-20" }), t("c", { assigned_to: "u1", due_on: "2026-11-25" })], now);
    expect(l).toEqual({ id: "u1", open: 3, pastDue: 1, dueToday: 1 });
  });
  it("On shift reads the Central minute", () => {
    expect(onShiftAt([{ start: 480, end: 1020 }], now)).toBe(true);
    expect(onShiftAt([{ start: 780, end: 1020 }], now)).toBe(false);
  });
});
