import { describe, expect, it } from "bun:test";
import {
  recoveryTotals,
  reportableRows,
  totalsByCategory,
  totalsByMonth,
  totalsByProperty,
  type LedgerRow,
} from "../recovery-reporting";

function row(partial: Partial<LedgerRow>): LedgerRow {
  return {
    recovery_id: partial.recovery_id ?? crypto.randomUUID(),
    logged_at: partial.logged_at ?? "2026-09-01T10:00:00Z",
    stage: partial.stage ?? "offered",
    approval_status: partial.approval_status ?? "not_required",
    authority_level: partial.authority_level ?? "pc",
    recovery_action: partial.recovery_action ?? "partial_refund",
    proposed_amount: partial.proposed_amount ?? null,
    approved_amount: partial.approved_amount ?? null,
    delivered_amount: partial.delivered_amount ?? null,
    delivered_on: partial.delivered_on ?? null,
    ticket_id: partial.ticket_id ?? "t1",
    ticket_title: partial.ticket_title ?? "No hot water",
    ticket_category: partial.ticket_category ?? "maintenance",
    property_id: partial.property_id ?? "p1",
    property_name: partial.property_name ?? "Willow",
    is_demo: partial.is_demo ?? false,
    ...partial,
  };
}

describe("guest recovery reporting", () => {
  it("demo records are never counted", () => {
    const rows = [row({ delivered_amount: 100 }), row({ delivered_amount: 500, is_demo: true })];
    expect(reportableRows(rows)).toHaveLength(1);
    expect(recoveryTotals(rows).issued).toBe(100);
  });

  it("totals add proposed, approved and issued separately", () => {
    const totals = recoveryTotals([
      row({ proposed_amount: 200, approved_amount: 150, delivered_amount: 150 }),
      row({ proposed_amount: 100, approval_status: "pending", stage: "closed" }),
    ]);
    expect(totals).toMatchObject({
      count: 2,
      proposed: 300,
      approved: 150,
      issued: 150,
      awaitingApproval: 1,
      openCount: 1,
    });
  });

  it("groups by home, newest-money first", () => {
    const grouped = totalsByProperty([
      row({ property_id: "p1", property_name: "Willow", delivered_amount: 50 }),
      row({ property_id: "p2", property_name: "Birch", delivered_amount: 400 }),
    ]);
    expect(grouped[0]?.label).toBe("Birch");
    expect(grouped[0]?.totals.issued).toBe(400);
  });

  it("a recovery with no home still reports", () => {
    const grouped = totalsByProperty([row({ property_id: null, property_name: null })]);
    expect(grouped[0]?.label).toBe("No home on file");
  });

  it("groups by month, newest first, and by ticket category", () => {
    const rows = [
      row({ logged_at: "2026-08-04T00:00:00Z", ticket_category: "cleaning" }),
      row({ logged_at: "2026-09-04T00:00:00Z", ticket_category: "maintenance" }),
    ];
    expect(totalsByMonth(rows).map((g) => g.key)).toEqual(["2026-09", "2026-08"]);
    expect(totalsByCategory(rows)).toHaveLength(2);
  });
});
