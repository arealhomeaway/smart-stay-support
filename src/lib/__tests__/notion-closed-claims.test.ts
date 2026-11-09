import { describe, expect, it } from "bun:test";
import {
  IMPORTED_CLOSED_NOTE_LINE,
  importClaimStage,
  mapNotionPage,
  recentCutoff,
  type NotionPage,
} from "@/lib/notion-import/mapping";
import { ticketForWrite } from "@/lib/notion-import/runner";
import {
  claimBucket,
  claimClosedAt,
  claimOpenedAt,
  findDuplicates,
  flagUnsettled,
  isImportedHistoryClaim,
  isOpenClaim,
  matchesFilter,
  reopenClaimHistoryLine,
  reopenClaimPatch,
  type ClaimStage,
} from "@/lib/claims";
import { claimDeadlineAlerts } from "@/lib/deadline-alerts";
import {
  CLAIM_STATUS_DEFAULT,
  CLAIM_VIEW_DEFAULT,
  applyClaimView,
  claimTiles,
  claimTotals,
  claimTotalsLine,
  inPeriod,
  periodRange,
  type DbRow,
} from "@/lib/databases";

// Register N5 (Emily, Nov 9). Fictional pages and amounts only.
const NOW = Date.parse("2026-11-09T18:00:00Z"); // Monday Nov 9, 2026, noon Central
const CUTOFF = recentCutoff(NOW);
const sel = (name: string | null) => ({ type: "select", select: name ? { name } : null });
const status = (name: string) => ({ type: "status", status: { name } });
const num = (n: number | null) => ({ type: "number", number: n });
const dt = (d: string | null) => ({ type: "date", date: d ? { start: d } : null });

function page(over: Record<string, unknown> = {}): NotionPage {
  return {
    id: "page-x",
    url: "https://www.notion.so/pagex",
    created_time: "2026-03-02T12:00:00Z",
    last_edited_time: "2026-04-15T16:30:00Z",
    properties: {
      "Issue Description": { type: "title", title: [{ plain_text: "Broken chair" }] },
      "Issue Status": status("In progress"),
      Priority: sel("Medium"),
      Assignee: sel(null),
      "Property Address": { type: "relation", relation: [{ id: "pid-1" }] },
      "Created Date": dt("2026-03-02"),
      "Will this be a claim?": sel("Yes"),
      "Total Damages $ (not including management fee)": num(640.5),
      "Reimbursed Amount $ ": num(600),
      ...over,
    },
  } as NotionPage;
}
const ctx = {
  staff: [],
  cutoff: CUTOFF,
  pidOwnerRez: new Map<string, string | null>([["pid-1", "ORP123456"]]),
  propertyByOwnerRez: new Map([["123456", "home-1"]]),
};
const map = (over: Record<string, unknown> = {}) => mapNotionPage(page(over), ctx);

describe("import rule: claims on older open and closed tickets come in Closed", () => {
  it("an older open ticket's claim imports Closed with its full amounts and original dates", () => {
    const out = map();
    expect(out.group).toBe("older_open");
    const c = out.ticket.claim!;
    expect(c.stage).toBe("closed");
    expect(c.estimated_amount).toBe(640.5);
    expect(c.recovered_amount).toBe(600);
    expect(c.opened_at).toBe("2026-03-02");
    expect(c.opened_at).toBe(out.ticket.reported_at);
    // No closed date in Notion for an open ticket: its last edit.
    expect(c.closed_at).toBe("2026-04-15T16:30:00Z");
    const lines = c.notes.split("\n");
    for (const l of [
      "Imported from Notion",
      IMPORTED_CLOSED_NOTE_LINE,
      "Opened in Notion: 2026-03-02",
      "Closed date: 2026-04-15 (last change in Notion)",
    ]) {
      expect(lines).toContain(l);
    }
    // The ticket itself is unchanged by the rule: still an older open import, held out of the queue.
    expect(out.ticket.status).toBe("in_progress");
    expect(out.ticket.import_hold).toBe("backlog_review");
  });

  it("a closed ticket's claim imports Closed; the closed date is Date Completed, else the last edit", () => {
    const done = map({ "Issue Status": status("Done"), "Date Completed": dt("2026-03-20") });
    expect(done.group).toBe("closed");
    expect(done.ticket.claim!.stage).toBe("closed");
    expect(done.ticket.claim!.closed_at).toBe("2026-03-20");
    expect(done.ticket.claim!.closed_at).toBe(done.ticket.resolved_at);
    expect(done.ticket.claim!.notes).toContain("Closed date: 2026-03-20 (completed in Notion)");
    const noDate = map({ "Issue Status": status("Completed Same Day") });
    expect(noDate.ticket.claim!.stage).toBe("closed");
    expect(noDate.ticket.claim!.closed_at).toBe("2026-04-15T16:30:00Z");
    // A filed claim on a closed ticket is still Closed, never Gathering.
    expect(map({ "Issue Status": status("Done"), "Claim Filed?": sel("Yes") }).ticket.claim!.stage).toBe("closed");
  });

  it("a recent open ticket's claim still imports open, with no closed lines", () => {
    const recent = map({ "Created Date": dt("2026-11-01") });
    expect(recent.group).toBe("recent_open");
    const c = recent.ticket.claim!;
    expect(c.stage).toBe("potential");
    expect(c.closed_at).toBeNull();
    expect(c.opened_at).toBe("2026-11-01");
    expect(c.notes).not.toContain(IMPORTED_CLOSED_NOTE_LINE);
    expect(c.notes.split("\n")[0]).toBe("Imported from Notion");
    expect(map({ "Created Date": dt("2026-11-01"), "Claim Filed?": sel("Yes") }).ticket.claim!.stage).toBe("gathering");
    expect(importClaimStage("recent_open", null)).toBe("potential");
    expect(importClaimStage("older_open", "Yes")).toBe("closed");
    expect(importClaimStage("closed", null)).toBe("closed");
  });

  it("history runs never touch a claim already in Resolve; a new ticket brings its Closed claim", () => {
    const t = map().ticket;
    expect(ticketForWrite("update", "older_open", t).claim).toBeNull();
    expect(ticketForWrite("update", "closed", t).claim).toBeNull();
    expect(ticketForWrite("create", "older_open", t).claim).toEqual(t.claim);
    expect(ticketForWrite("create", "closed", t).claim).toEqual(t.claim);
    // The recent run keeps its current refresh rule.
    expect(ticketForWrite("update", "recent_open", t).claim).toEqual(t.claim);
    // Nothing else in the ticket changes.
    expect({ ...ticketForWrite("update", "older_open", t), claim: t.claim }).toEqual(t);
  });
});

// ---------- tiles, queues and alerts ----------

const notes = (closed: boolean) => ["Imported from Notion", ...(closed ? [IMPORTED_CLOSED_NOTE_LINE] : [])].join("\n");
const history = (amount: number, paid: number) => ({
  claim_type: "guest_damage" as const,
  stage: "closed" as ClaimStage,
  estimated_amount: amount,
  recovered_amount: paid,
  incident_description: notes(true),
  closed_at: null,
});

describe("closed claims never count as open work", () => {
  const open = [
    { claim_type: "guest_damage" as const, stage: "potential" as ClaimStage, estimated_amount: 300 },
    { claim_type: "guest_damage" as const, stage: "gathering" as ClaimStage, estimated_amount: 120.25 },
    { claim_type: "channel_aircover" as const, stage: "submitted" as ClaimStage, submitted_amount: 500, recovered_amount: 100 },
  ];

  it("the tiles do not change when closed claims exist", () => {
    const before = claimTiles(open);
    expect(before).toEqual({ atRisk: 920.25, payback: 400 });
    const after = claimTiles([...open, history(93_598.21, 83_473.32), history(29_435.24, 25_370.4), history(55, 0)]);
    expect(after).toEqual(before);
  });

  it("no Claims home section, manager view, deadline alert, duplicate warning or unsettled flag", () => {
    const c = { ...history(2_000, 0), deadline_on: "2026-11-01", assigned_to: "someone", id: "c1", ticket_id: "t1" };
    expect(isOpenClaim(c.stage)).toBe(false);
    expect(claimBucket(c, { now: new Date(NOW) })).toBeNull();
    for (const f of ["unsubmitted", "deadline_risk", "overdue", "high_value", "evidence_missing", "long_wait", "denied_partial"] as const) {
      expect(matchesFilter(c, f, { now: new Date(NOW) })).toBe(false);
    }
    expect(claimDeadlineAlerts([{ id: "c1", stage: "closed", assigned_to: "someone", deadline_on: "2026-11-01" }], new Date(NOW))).toEqual([]);
    expect(findDuplicates({ ticket_id: "t1" }, [c])).toEqual([]);
    expect(isImportedHistoryClaim(c)).toBe(true);
    expect(flagUnsettled(c)).toBe(false);
    // A claim closed in Resolve keeps the settlement rule.
    expect(flagUnsettled({ stage: "closed", submitted_amount: 400, recovered_amount: 0, incident_description: null, closed_at: "2026-11-01T00:00:00Z" })).toBe(true);
  });
});

// ---------- dates, Period, Status and totals ----------

describe("original dates", () => {
  const ticket = { reported_at: "2025-06-03T15:00:00Z", resolved_at: "2025-06-20T15:00:00Z", external_synced_at: "2025-07-01T00:00:00Z" };
  it("an imported claim keeps the Notion created date; a Resolve claim its own", () => {
    expect(claimOpenedAt({ created_at: "2026-11-09T19:00:00Z", incident_description: notes(true) }, ticket)).toBe(ticket.reported_at);
    expect(claimOpenedAt({ created_at: "2026-11-09T19:00:00Z", incident_description: notes(false) }, ticket)).toBe(ticket.reported_at);
    expect(claimOpenedAt({ created_at: "2026-11-09T19:00:00Z", incident_description: "Broken lamp" }, ticket)).toBe("2026-11-09T19:00:00Z");
  });
  it("closed date: closed in Resolve wins; a history import uses the ticket's closed date, else its last edit", () => {
    expect(claimClosedAt({ stage: "closed", closed_at: "2026-11-01T00:00:00Z", incident_description: notes(true) }, ticket)).toBe("2026-11-01T00:00:00Z");
    expect(claimClosedAt({ stage: "closed", closed_at: null, incident_description: notes(true) }, ticket)).toBe(ticket.resolved_at);
    expect(claimClosedAt({ stage: "closed", closed_at: null, incident_description: notes(true) }, { ...ticket, resolved_at: null })).toBe(ticket.external_synced_at);
    expect(claimClosedAt({ stage: "potential", closed_at: null, incident_description: notes(false) }, ticket)).toBeNull();
  });
});

function row(id: string, openedAt: string, open: boolean, damages: number | null, paidBack: number | null, kind: "claim" | "refund" = "claim"): DbRow {
  return { id, cells: [id, "", kind === "claim" ? "Claim" : "Refund", "", ""], fields: [], claim: { kind, open, openedAt, damages, paidBack } };
}
const ROWS: DbRow[] = [
  row("this-week-open", "2026-11-09T15:00:00Z", true, 300, 0),
  row("monday-early", "2026-11-09T05:30:00Z", false, 200, 200), // 11:30 PM Sunday Central: last week
  row("this-month-closed", "2026-11-02T16:00:00Z", false, 150, 50),
  row("october", "2026-10-31T12:00:00Z", true, 1000, 400),
  row("march-closed", "2026-03-02", false, 640.5, 600),
  row("last-year", "2025-12-31T23:00:00Z", false, 90, 0), // Dec 31 5 PM Central
  row("refund-week", "2026-11-10T15:00:00Z", true, 75, null, "refund"),
];
const ids = (rs: DbRow[]) => rs.map((r) => r.id).sort();
const all = { ...CLAIM_VIEW_DEFAULT, status: "All" as const };

describe("Period, Status and totals", () => {
  it("week runs Monday to Sunday in Central time", () => {
    expect(periodRange({ kind: "week" }, NOW)).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "week" } }, NOW))).toEqual(["refund-week", "this-week-open"]);
  });
  it("this month, this year, a chosen month and year", () => {
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "month" } }, NOW))).toEqual(["monday-early", "refund-week", "this-month-closed", "this-week-open"]);
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "year" } }, NOW))).toEqual(
      ["march-closed", "monday-early", "october", "refund-week", "this-month-closed", "this-week-open"],
    );
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "month_of", year: 2026, month: 3 } }, NOW))).toEqual(["march-closed"]);
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "month_of", year: 2025, month: 12 } }, NOW))).toEqual(["last-year"]);
  });
  it("a custom range is inclusive, either end may be blank, and reversed ends are swapped", () => {
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "range", from: "2026-10-31", to: "2026-11-02" } }, NOW))).toEqual(["october", "this-month-closed"]);
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "range", from: "2026-11-02", to: "2026-10-31" } }, NOW))).toEqual(["october", "this-month-closed"]);
    expect(ids(applyClaimView(ROWS, { ...all, period: { kind: "range", to: "2025-12-31" } }, NOW))).toEqual(["last-year"]);
    expect(applyClaimView(ROWS, { ...all, period: { kind: "range", from: "", to: "" } }, NOW)).toHaveLength(ROWS.length);
    expect(inPeriod(null, { kind: "year" }, NOW)).toBe(false);
  });
  it("Status: Open by default, so a closed claim never shows as open work", () => {
    expect(CLAIM_STATUS_DEFAULT).toBe("Open");
    expect(ids(applyClaimView(ROWS, CLAIM_VIEW_DEFAULT, NOW))).toEqual(["october", "refund-week", "this-week-open"]);
    expect(ids(applyClaimView(ROWS, { ...CLAIM_VIEW_DEFAULT, status: "Closed" }, NOW))).toEqual(["last-year", "march-closed", "monday-early", "this-month-closed"]);
    expect(applyClaimView(ROWS, all, NOW)).toHaveLength(7);
  });
  it("sorts by the original opened date, newest first unless chosen otherwise", () => {
    expect(applyClaimView(ROWS, all, NOW).map((r) => r.id)).toEqual([
      "refund-week", "this-week-open", "monday-early", "this-month-closed", "october", "march-closed", "last-year",
    ]);
    expect(applyClaimView(ROWS, { ...all, sort: "Oldest opened first" }, NOW).map((r) => r.id)[0]).toBe("last-year");
  });
  it("totals for what is filtered: claims only, damages, paid back, still open", () => {
    const year = claimTotals(applyClaimView(ROWS, { ...all, period: { kind: "year" } }, NOW));
    expect(year).toEqual({ count: 5, damages: 2290.5, paidBack: 1250, openCount: 2, stillOpen: 900 });
    expect(claimTotalsLine(year)).toBe("5 claims · Total damages $2,290.5 · Paid back $1,250 · Still open: 2 claims, $900");
    const march = claimTotals(applyClaimView(ROWS, { ...all, period: { kind: "month_of", year: 2026, month: 3 } }, NOW));
    expect(claimTotalsLine(march)).toBe("1 claim · Total damages $640.5 · Paid back $600 · Still open: 0 claims, $0");
    const week = claimTotals(applyClaimView(ROWS, { ...all, period: { kind: "week" } }, NOW));
    expect(week).toEqual({ count: 1, damages: 300, paidBack: 0, openCount: 1, stillOpen: 300 });
  });
});

describe("reopen", () => {
  it("back to the first working stage, closed date cleared, one history line with the reason", () => {
    expect(reopenClaimPatch()).toEqual({ stage: "potential", closed_at: null });
    expect(isOpenClaim(reopenClaimPatch().stage)).toBe(true);
    expect(reopenClaimHistoryLine("  Guest paid only part  ")).toBe("Claim reopened: Guest paid only part");
    // Reopened, an imported claim counts again like any open claim.
    const reopened = { ...history(640.5, 600), ...reopenClaimPatch() };
    expect(isImportedHistoryClaim(reopened)).toBe(false);
    expect(claimTiles([reopened]).atRisk).toBe(640.5);
  });
});
