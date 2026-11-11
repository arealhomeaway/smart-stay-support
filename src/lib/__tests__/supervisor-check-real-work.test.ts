import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { activityKind, groupSupervisorCheck, type CheckTicket } from "@/lib/supervisor-check";
import { NOTION_LIVE_STATUS, quietImportLine } from "@/lib/notion-ticket-display";

// Register N4, A7 (Emily, Nov 9): the Supervisor check shows real work only.
const NOW = Date.parse("2026-11-09T19:00:00Z");
const h = (n: number) => new Date(NOW - n * 3600_000).toISOString();
const base = (p: Partial<CheckTicket>): CheckTicket => ({
  id: "x", title: "x", status: "open", created_at: h(100), updated_at: h(100), assigned_to: "u", ...p,
});
const listed = (tickets: CheckTicket[]) => {
  const g = groupSupervisorCheck(tickets, NOW);
  return {
    last24h: g.last24h.map((x) => `${x.ticket.id}:${x.kind}`),
    overdue: g.overdue.map((x) => x.id),
    unassigned: g.unassigned.map((x) => x.id),
  };
};
const NONE = { last24h: [], overdue: [], unassigned: [] };

// Copied into Resolve two hours ago, as the import does.
const recentImport = base({
  id: "imp", external_source: "notion", external_status: "In progress",
  reported_at: h(24 * 5), created_at: h(2), updated_at: h(2), assigned_to: null,
});
const olderImport = base({ ...recentImport, id: "older", import_hold: "backlog_review", reported_at: h(24 * 200) });
const closedImport = base({ ...recentImport, id: "hist", status: "closed", external_status: "Done", closed_at: h(1) });
const noHomeImport = base({ ...recentImport, id: "nohome", import_hold: "needs_home" });

describe("untouched Notion imports appear in no list", () => {
  it("uses the ticket page's quiet rule", () => {
    expect(quietImportLine(recentImport, NOW)).toBe("Imported from Notion. No clock.");
  });
  it("a recent open import with no assignee is not Unassigned and not New; older, closed and no-home imports neither", () => {
    for (const t of [recentImport, olderImport, closedImport, noHomeImport]) {
      expect(listed([t])).toEqual(NONE);
    }
    // Even with a past due time it is not Overdue.
    expect(listed([{ ...recentImport, next_action_due_at: h(1) }])).toEqual(NONE);
  });
});

describe("after Take it is ordinary work", () => {
  // reopen_notion_ticket marks the ticket live and writes fresh due times from the take moment.
  const taken = { ...recentImport, external_status: NOTION_LIVE_STATUS, updated_at: h(0.5), assigned_to: "coordinator" };
  it("shows as Changed, never New for being copied today; assigned, so not Unassigned", () => {
    expect(listed([taken])).toEqual({ last24h: ["imp:changed"], overdue: [], unassigned: [] });
  });
  it("follows the normal Overdue and Unassigned rules", () => {
    expect(listed([{ ...taken, next_action_due_at: h(0.1) }]).overdue).toEqual(["imp"]);
    expect(listed([{ ...taken, assigned_to: null }]).unassigned).toEqual(["imp"]);
  });
  it("a ticket created in Notion in the last 24 hours and taken shows as New", () => {
    expect(activityKind({ ...taken, reported_at: h(3) }, NOW - 86_400_000)).toBe("created");
  });
  it("a reopened closed import is Changed and open", () => {
    const reopened = { ...closedImport, status: "open", closed_at: null, external_status: NOTION_LIVE_STATUS, updated_at: h(1), assigned_to: null };
    expect(listed([reopened])).toEqual({ last24h: ["hist:changed"], overdue: [], unassigned: ["hist"] });
  });
});

describe("an ordinary ticket is unchanged in every list", () => {
  it("new, changed, closed, overdue and unassigned exactly as before", () => {
    const rows = [
      base({ id: "new", created_at: h(2), updated_at: h(1), assigned_to: null }),
      base({ id: "chg", updated_at: h(3) }),
      base({ id: "cls", status: "closed", closed_at: h(1), created_at: h(30) }),
      base({ id: "late", next_action_due_at: h(1) }),
      base({ id: "old" }),
      base({ id: "held", assigned_to: null, import_hold: "needs_home" }),
    ];
    expect(listed(rows)).toEqual({
      last24h: ["new:created", "chg:changed", "cls:closed"],
      overdue: ["late"],
      unassigned: ["new"],
    });
    // Mixed with imports, the ordinary rows are the same.
    expect(listed([...rows, recentImport, olderImport, closedImport, noHomeImport])).toEqual(listed(rows));
  });
});

describe("the page", () => {
  const page = readFileSync("src/routes/_authenticated/supervisor-check.tsx", "utf8");
  it("has no import lists and no import wording", () => {
    for (const w of [/Imported from Notion/i, /Older open/i, /Backlog review/i, /Needs a home/i, /Notion/i, /imported-tickets/, /\bseat\b/i, /Median/, /—\s/]) {
      expect({ w: String(w), hit: w.test(page.replace(/"Supervisor check — Resolve"/g, "")) }).toEqual({ w: String(w), hit: false });
    }
  });
  it("stays read only and keeps its access; it never clocks a queue check (Build 16 B3, register C2)", () => {
    expect(page).not.toContain("QueueOpenLogger");
    expect(page).toContain('capability="oversight"');
    expect(page).not.toMatch(/\.(insert|update|upsert|delete)\(/);
    expect(page).not.toMatch(/\.rpc\(/);
    for (const label of ["Last 24 hours", "Overdue", "Unassigned", "Refunds waiting on approval"]) expect(page).toContain(label);
  });
});

describe("queue checks count only from the Team Queue (Build 16 B3)", () => {
  it("Oversight does not clock a queue check and the Team Queue does", () => {
    expect(readFileSync("src/routes/_authenticated/oversight.tsx", "utf8")).not.toContain("QueueOpenLogger");
    expect(readFileSync("src/routes/_authenticated/team-queue.tsx", "utf8")).toContain('<QueueOpenLogger source="team_queue" />');
  });
});
