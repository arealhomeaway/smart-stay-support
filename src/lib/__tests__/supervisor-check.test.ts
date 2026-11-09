import { describe, expect, it } from "bun:test";
import { activityKind, groupSupervisorCheck, type CheckTicket } from "@/lib/supervisor-check";
import { SEAT_TEAMS, SEAT_LABELS, TEAM_A } from "@/lib/coverage-model";

const NOW = Date.parse("2026-11-05T12:00:00Z");
const h = (n: number) => new Date(NOW - n * 3600_000).toISOString();
const t = (p: Partial<CheckTicket>): CheckTicket => ({
  id: Math.random().toString(), title: "x", status: "open", created_at: h(100), updated_at: h(100), assigned_to: "u", ...p,
});

describe("supervisor check", () => {
  it("labels the last 24 hours as new, changed or closed", () => {
    const since = NOW - 24 * 3600_000;
    expect(activityKind(t({ created_at: h(2), updated_at: h(1) }), since)).toBe("created");
    expect(activityKind(t({ updated_at: h(3) }), since)).toBe("changed");
    expect(activityKind(t({ status: "closed", closed_at: h(1), created_at: h(2) }), since)).toBe("closed");
    expect(activityKind(t({ updated_at: h(30) }), since)).toBeNull();
  });
  it("lists overdue and unassigned; the three import-only lists are gone", () => {
    const g = groupSupervisorCheck([
      t({ next_action_due_at: h(1) }),
      t({ status: "closed", next_action_due_at: h(1) }),
      t({ assigned_to: null }),
      t({ external_source: "notion", reported_at: h(48) }),
      t({ external_source: "notion", import_hold: "backlog_review", assigned_to: null, reported_at: h(24 * 90) }),
      t({ external_source: "notion", import_hold: "needs_home", reported_at: h(48) }),
    ], NOW);
    expect(g.overdue).toHaveLength(1);
    expect(g.unassigned).toHaveLength(1);
    expect(Object.keys(g).sort()).toEqual(["last24h", "overdue", "unassigned"]);
  });
  it("the part-time Guest Experience seat sits on Team A and shows on the grid", () => {
    expect(SEAT_TEAMS["ge_parttime"]).toBe(TEAM_A);
    expect(SEAT_LABELS["ge_parttime"]).toContain("Part-time");
  });
});
