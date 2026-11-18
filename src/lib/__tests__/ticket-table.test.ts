import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { compareInGroup, dueCell, groupTableRows, parseGroupBy, reportedShort, statusPillLabel } from "@/lib/ticket-table";

// Ticket table (Emily, Nov 18): layout only, built from fields tickets already carry.
const NOW = new Date("2026-11-18T18:00:00Z"); // 12:00 PM Central
const iso = (mins: number) => new Date(NOW.getTime() + mins * 60_000).toISOString();

describe("Due column", () => {
  it("not acknowledged: Reply now, overdue or due from response_due_at", () => {
    expect(dueCell({ status: "open", response_due_at: iso(-90) }, NOW)).toMatchObject({ line1: "Reply now", line2: "Overdue by 2h", overdue: true });
    expect(dueCell({ status: "open", response_due_at: iso(20) }, NOW)).toMatchObject({ line1: "Reply now", line2: "Due in 20m", overdue: false });
  });
  it("acknowledged but not started: Start work from action_due_at", () => {
    expect(dueCell({ status: "in_progress", acknowledged_at: iso(-60), action_due_at: iso(-30) }, NOW)).toMatchObject({ line1: "Start work", line2: "Overdue by 30m", overdue: true });
  });
  it("waiting with a check back date: the date, then Check back; overdue when past", () => {
    expect(dueCell({ status: "waiting", acknowledged_at: iso(-600), next_review_at: iso(120) }, NOW)).toMatchObject({ line1: "Nov 18 · 2:00 PM", line2: "Check back", overdue: false });
    expect(dueCell({ status: "awaiting_guest", next_review_at: iso(-180) }, NOW)).toMatchObject({ line2: "Overdue by 3h", overdue: true });
  });
  it("waiting with no check back date: No check back date, Set one, both red", () => {
    expect(dueCell({ status: "waiting" }, NOW)).toMatchObject({ line1: "No check back date", line2: "Set one", alert: true, overdue: false });
  });
  it("started work, resolved or closed: No due date", () => {
    expect(dueCell({ status: "in_progress", acknowledged_at: iso(-60), action_started_at: iso(-50) }, NOW)).toMatchObject({ line1: "No due date", line2: null });
    expect(dueCell({ status: "resolved", response_due_at: iso(-60) }, NOW)).toMatchObject({ line1: "No due date", overdue: false });
  });
});

describe("Reported column", () => {
  it("Today with the time, else a short date, in Central time", () => {
    expect(reportedShort("2026-11-18T19:41:00Z", NOW)).toBe("Today 1:41 PM");
    expect(reportedShort("2026-11-16T15:00:00Z", NOW)).toBe("Nov 16");
    expect(reportedShort("2025-09-16T15:00:00Z", NOW)).toBe("Sep 16, 2025");
  });
});

describe("Status pill", () => {
  it("waiting shows what it waits on when set", () => {
    expect(statusPillLabel({ status: "waiting", waiting_on: "vendor" })).toBe("Waiting on vendor");
    expect(statusPillLabel({ status: "waiting" })).toBe("Waiting on someone");
    expect(statusPillLabel({ status: "in_progress", waiting_on: "vendor" })).toBe("In progress");
  });
});

describe("Groups and order", () => {
  type Row = { id: string; status: string; priority: string; owner?: string };
  const t = (id: string, extra: Record<string, unknown>) => ({ id, status: "open", priority: "p3", ...extra }) as Row;
  const pick = { priority: (r: Row) => r.priority, ownerId: (r: Row) => r.owner ?? null, ownerName: (id: string) => ({ u1: "Zoe", u2: "Ana" } as Record<string, string>)[id] ?? id };
  it("Group by defaults to Priority", () => {
    expect(parseGroupBy(undefined)).toBe("priority");
    expect(parseGroupBy("person")).toBe("person");
    expect(parseGroupBy("nonsense")).toBe("priority");
  });
  it("priority groups in order, empty groups hidden", () => {
    const rows = [t("a", { priority: "p3" }), t("b", { priority: "p1" })];
    expect(groupTableRows(rows, "priority", pick, NOW).map((g) => g.key)).toEqual(["p1", "p3"]);
  });
  it("status groups: dispatched sits with In progress, awaiting guest with Waiting on someone", () => {
    const rows = [t("a", { status: "dispatched" }), t("b", { status: "awaiting_guest" }), t("c", { status: "in_progress" })];
    const groups = groupTableRows(rows, "status", pick, NOW);
    expect(groups.map((g) => [g.label, g.rows.map((r) => r.id).sort()])).toEqual([["In progress", ["a", "c"]], ["Waiting on someone", ["b"]]]);
  });
  it("person groups: Unassigned first, then names A to Z", () => {
    const rows = [t("a", { owner: "u1" }), t("b", {}), t("c", { owner: "u2" })];
    expect(groupTableRows(rows, "person", pick, NOW).map((g) => g.label)).toEqual(["Unassigned", "Ana", "Zoe"]);
  });
  it("inside a group: overdue first, then soonest due, then the existing queue order; overdue counted", () => {
    const rows = [
      t("later", { response_due_at: iso(60) }),
      t("none", { acknowledged_at: iso(-5), action_started_at: iso(-4) }),
      t("late", { response_due_at: iso(-10) }),
      t("soon", { response_due_at: iso(5) }),
    ];
    const [g] = groupTableRows(rows, "priority", pick, NOW);
    expect(g!.rows.map((r) => r.id)).toEqual(["late", "soon", "later", "none"]);
    expect(g!.overdue).toBe(1);
    expect(compareInGroup(rows[2]!, rows[0]!, NOW) < 0).toBe(true);
  });
});

describe("both pages use the one table", () => {
  it("Team Queue and Operations oversight render TicketTable", () => {
    for (const f of ["src/routes/_authenticated/team-queue.tsx", "src/routes/_authenticated/oversight.tsx"])
      expect(readFileSync(f, "utf8")).toContain("<TicketTable");
  });
});
