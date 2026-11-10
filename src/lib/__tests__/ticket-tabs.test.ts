/**
 * Databases, Tickets tabs and the old imported tickets lists (Emily, Nov 9;
 * register P3, N2, N4, T12, C1, H9). Fixed clock: Tue Nov 10 2026, noon Central.
 */
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import type { DbRow } from "@/lib/databases";
import {
  HISTORICAL_LABEL,
  NO_OWNER,
  OLDER_OPEN_LABEL,
  TICKET_TABS,
  TICKET_VIEW_DEFAULT,
  applyTicketView,
  inTicketTab,
  originalCreatedAt,
  ticketRecordLabel,
  ticketTabCounts,
  ticketTotalsLine,
  type TicketFacts,
  type TicketView,
} from "@/lib/ticket-tabs";
import { pageTabGroupFor, visiblePageTabs } from "@/lib/shell-nav";
import { FLAG_KEYS } from "@/lib/feature-flags";

const NOW = Date.parse("2026-11-10T18:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

type Opts = Partial<TicketFacts> & { ref: string; title?: string; home?: string; type?: string; statusLabel?: string; owner?: string; toWork?: boolean };
function row(o: Opts): DbRow {
  const facts: TicketFacts = {
    status: o.status ?? "open",
    external_source: o.external_source ?? null,
    external_status: o.external_status ?? null,
    external_id: o.external_id ?? null,
    reported_at: o.reported_at ?? null,
    created_at: o.created_at ?? daysAgo(1),
    import_hold: o.import_hold ?? null,
    property_id: o.property_id === undefined ? "home-1" : o.property_id,
    claim: o.claim ?? null,
  };
  return {
    id: `t${o.ref}`,
    cells: [o.ref, o.title ?? `Ticket ${o.ref}`, o.home ?? "12 Highpoint Dr", o.type ?? "Plumbing", o.statusLabel ?? (facts.status === "closed" ? "Closed" : "Open"), o.owner ?? ""],
    fields: [],
    ...(facts.external_id ? { extra: `${facts.external_id} ${facts.external_id.replace(/-/g, "")}` } : {}),
    tags: o.toWork ? { "Claims to work": "Claims to work" } : {},
    ticket: facts,
  };
}

// A small portfolio covering every tab.
const ROWS: DbRow[] = [
  // Resolve ticket, open, 3 days old, with an owner.
  row({ ref: "1", created_at: daysAgo(3), owner: "A coordinator", title: "Leak under sink" }),
  // Resolve ticket, open, 40 days old: not Recent.
  row({ ref: "2", created_at: daysAgo(40), title: "Old gate code" }),
  // Resolve ticket, closed, 5 days old.
  row({ ref: "3", status: "closed", created_at: daysAgo(5), title: "Lockout" }),
  // Notion, open, created in Notion 10 days ago but copied in today: Recent by the Notion date.
  row({ ref: "4", external_source: "notion", external_id: "40e4658d-5f4f-804f-afd5-e96d6f393d4b", reported_at: daysAgo(10), created_at: daysAgo(0), title: "Replacement of pans" }),
  // Notion, open, created in Notion 45 days ago but copied in today: Older open.
  row({ ref: "5", external_source: "notion", reported_at: daysAgo(45), created_at: daysAgo(0), title: "Fridge noise" }),
  // Notion, closed: Closed history, with a claim, no owner shown.
  row({
    ref: "6",
    status: "closed",
    external_source: "notion",
    reported_at: "2025-03-14T15:00:00Z",
    created_at: daysAgo(0),
    title: "Aircover broken table",
    claim: { amount: 450, paidBack: 300, status: "Closed", open: false, openedAt: "2025-03-14T15:00:00Z" },
  }),
  // Notion, open, recent, no matching home.
  row({ ref: "7", external_source: "notion", reported_at: daysAgo(2), created_at: daysAgo(0), import_hold: "needs_home", property_id: null, home: "", title: "6629 S 22nd" }),
  // Resolve ticket with an open claim to work.
  row({ ref: "8", created_at: daysAgo(6), owner: "A coordinator", toWork: true, claim: { amount: 200, paidBack: 0, status: "Gathering evidence", open: true, openedAt: daysAgo(6) } }),
  // Notion reopened in Resolve, then closed again: ordinary work, not Closed history.
  row({ ref: "9", status: "closed", external_source: "notion", external_status: "reopened_in_resolve", reported_at: daysAgo(90), created_at: daysAgo(0), owner: "A coordinator" }),
];

const view = (patch: Partial<TicketView>): TicketView => ({ ...TICKET_VIEW_DEFAULT, ...patch });
const refs = (rows: DbRow[]) => rows.map((r) => r.cells[0]);

describe("the six tabs (Emily, Nov 9)", () => {
  it("are All, Recent, Older open, Closed history, Needs a home and Claims history, in that order", () => {
    expect(TICKET_TABS.map((t) => t.label)).toEqual(["All", "Recent", "Older open", "Closed history", "Needs a home", "Claims history"]);
  });

  it("each counts the right tickets", () => {
    expect(ticketTabCounts(ROWS, NOW)).toEqual({ all: 9, recent: 4, older_open: 1, closed_history: 1, needs_home: 1, claims_history: 2 });
  });

  it("All: every ticket, open and closed", () => {
    expect(refs(applyTicketView(ROWS, view({ tab: "all" }), NOW)).sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("Recent: open tickets created in the past 30 days, by the Notion created date for imports", () => {
    expect(refs(applyTicketView(ROWS, view({ tab: "recent" }), NOW)).sort()).toEqual(["1", "4", "7", "8"]);
    // Copied in today but created in Notion 45 days ago: not Recent.
    expect(inTicketTab("recent", ROWS[4]!.ticket!, NOW)).toBe(false);
  });

  it("Older open: open Notion tickets older than 30 days, labelled Older open ticket from Notion", () => {
    const rows = applyTicketView(ROWS, view({ tab: "older_open" }), NOW);
    expect(refs(rows)).toEqual(["5"]);
    expect(ticketRecordLabel(rows[0]!.ticket!, NOW)).toBe(OLDER_OPEN_LABEL);
    expect(OLDER_OPEN_LABEL).toBe("Older open ticket from Notion");
  });

  it("Closed history: closed Notion tickets only, labelled Historical record from Notion, never with an owner", () => {
    const rows = applyTicketView(ROWS, view({ tab: "closed_history" }), NOW);
    expect(refs(rows)).toEqual(["6"]);
    expect(ticketRecordLabel(rows[0]!.ticket!, NOW)).toBe(HISTORICAL_LABEL);
    expect(HISTORICAL_LABEL).toBe("Historical record from Notion");
    expect(rows[0]!.cells[5]).toBe("");
    // A reopened and closed again import is Resolve work, not history.
    expect(inTicketTab("closed_history", ROWS[8]!.ticket!, NOW)).toBe(false);
  });

  it("Needs a home: tickets with no matching home", () => {
    expect(refs(applyTicketView(ROWS, view({ tab: "needs_home" }), NOW))).toEqual(["7"]);
    expect(inTicketTab("needs_home", row({ ref: "x", property_id: null }).ticket!, NOW)).toBe(true);
  });

  it("Claims history: every ticket with a claim, open or closed, newest claim first, with the money totals", () => {
    const rows = applyTicketView(ROWS, view({ tab: "claims_history" }), NOW);
    expect(refs(rows)).toEqual(["8", "6"]);
    expect(ticketTotalsLine(rows, "claims_history")).toBe("2 tickets · Total damages $650 · Paid back $300 · Still open: 1 claim, $200");
  });
});

describe("the same filters on every tab", () => {
  it("search finds a home, a title, a reference with or without #, and a Notion number with or without dashes", () => {
    expect(refs(applyTicketView(ROWS, view({ term: "highpoint" }), NOW)).length).toBe(8);
    expect(refs(applyTicketView(ROWS, view({ term: "leak sink" }), NOW))).toEqual(["1"]);
    expect(refs(applyTicketView(ROWS, view({ term: "#4" }), NOW))).toEqual(["4"]);
    expect(refs(applyTicketView(ROWS, view({ term: "40e4658d-5f4f-804f" }), NOW))).toEqual(["4"]);
    expect(refs(applyTicketView(ROWS, view({ term: "40e4658d5f4f804fafd5e96d6f393d4b" }), NOW))).toEqual(["4"]);
  });

  it("Period reads the Notion created date for imports and the created date for others", () => {
    // This month (November 2026, Central): created in November.
    expect(refs(applyTicketView(ROWS, view({ period: { kind: "month" } }), NOW)).sort()).toEqual(["1", "3", "4", "7", "8"]);
    // A chosen month and year: March 2025 holds only the Notion claim, though it was copied in today.
    expect(refs(applyTicketView(ROWS, view({ period: { kind: "month_of", year: 2025, month: 3 } }), NOW))).toEqual(["6"]);
    // A custom range.
    expect(refs(applyTicketView(ROWS, view({ period: { kind: "range", from: "2026-11-04", to: "2026-11-07" } }), NOW)).sort()).toEqual(["1", "3", "8"]);
    // This year leaves out the 2025 history.
    expect(refs(applyTicketView(ROWS, view({ tab: "closed_history", period: { kind: "year" } }), NOW))).toEqual([]);
    expect(originalCreatedAt(ROWS[5]!.ticket!)).toBe("2025-03-14T15:00:00Z");
  });

  it("Problem type, Status, Owner (with No owner) and Claims to work narrow the list", () => {
    const rows = [...ROWS, row({ ref: "10", type: "Lockout", created_at: daysAgo(4) })];
    expect(refs(applyTicketView(rows, view({ problemType: "Lockout" }), NOW))).toEqual(["10"]);
    expect(refs(applyTicketView(rows, view({ status: "Closed" }), NOW)).sort()).toEqual(["3", "6", "9"]);
    expect(refs(applyTicketView(rows, view({ owner: "A coordinator" }), NOW)).sort()).toEqual(["1", "8", "9"]);
    expect(refs(applyTicketView(rows, view({ tab: "recent", owner: NO_OWNER }), NOW)).sort()).toEqual(["10", "4", "7"]);
    expect(refs(applyTicketView(rows, view({ claimsToWork: "Claims to work" }), NOW))).toEqual(["8"]);
  });

  it("sorts by date, newest first by default", () => {
    expect(refs(applyTicketView(ROWS, view({ tab: "recent" }), NOW))).toEqual(["4", "1", "7", "8"].sort((a, b) => {
      const at = (r: string) => Date.parse(originalCreatedAt(ROWS.find((x) => x.cells[0] === r)!.ticket!));
      return at(b) - at(a);
    }));
    const oldest = refs(applyTicketView(ROWS, view({ sort: "Oldest first" }), NOW));
    expect(oldest[0]).toBe("6");
  });

  it("the totals line counts tickets on every tab", () => {
    expect(ticketTotalsLine(applyTicketView(ROWS, view({ tab: "recent" }), NOW), "recent")).toBe("4 tickets");
    expect(ticketTotalsLine(applyTicketView(ROWS, view({ tab: "needs_home" }), NOW), "needs_home")).toBe("1 ticket");
  });
});

describe("the screen", () => {
  const page = readFileSync("src/routes/_authenticated/databases.$key.tsx", "utf8");
  const tabs = readFileSync("src/components/databases/TicketTabs.tsx", "utf8");

  it("Tickets in Databases draws the tabs; other lists keep their own filters", () => {
    expect(page).toContain('const isTickets = card.key === "tickets"');
    expect(page).toContain("<TicketTabs");
    expect(page).toContain("<ClaimViewControls");
  });

  it("every row has an Open button that opens the ticket page (Reopen lives there, T12)", () => {
    expect(tabs).toContain("<DbLinkButton link={r.link}>");
    expect(tabs).toContain("Open<span");
    const data = readFileSync("src/lib/databases-data.ts", "utf8");
    expect(data).toContain("link: ticketLink(ctx, t.id)");
  });

  it("Closed history has no Owner column and no clock", () => {
    expect(tabs).toContain('if (tab !== "closed_history") cols.push({ label: "Owner"');
    expect(tabs).not.toMatch(/slaDueDates|visibleClocks|response_due_at/);
  });

  it("choosing a home on Needs a home is for the people who did it on the old list", () => {
    expect(page).toContain('canFixHome={can("audit_history") && !readOnly}');
    expect(tabs).toContain("update({ property_id: home, import_hold: null }");
  });

  it("controls are at least 44px", () => {
    expect(tabs).toContain('const SELECT_CLASS = "h-11');
    expect(tabs).toContain("min-h-11");
  });
});

describe("the old imported tickets lists (register H9: hidden, not deleted)", () => {
  const access = (flags: Record<string, boolean>) => ({
    can: () => true,
    canOpen: () => true,
    flagEnabled: (k: string) => flags[k] ?? false,
  });

  it("the Imported tickets tab is gone from the Admin menu while its switch is off", () => {
    const group = pageTabGroupFor("/integrations")!;
    expect(visiblePageTabs(group, access({})).map((t) => t.label)).not.toContain("Imported tickets");
    expect(visiblePageTabs(group, access({ imported_tickets_page: true })).map((t) => t.label)).toContain("Imported tickets");
    expect(FLAG_KEYS).toContain("imported_tickets_page");
  });

  it("the page and the Integrations list are still there behind the switch", () => {
    const page = readFileSync("src/routes/_authenticated/imported-tickets.tsx", "utf8");
    expect(page).toContain('flag="imported_tickets_page"');
    expect(page).toContain("<ImportedTicketsPage />");
    const integrations = readFileSync("src/routes/_authenticated/integrations.tsx", "utf8");
    expect(integrations).toContain('flagEnabled("imported_tickets_page")');
    expect(integrations).toContain("{showImported && (");
    expect(integrations).toContain('title="Imported tickets"');
  });

  it("nothing else links to the old page", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = `${dir}/${n}`;
        if (statSync(p).isDirectory()) return n === "__tests__" ? [] : walk(p);
        return /\.(tsx?)$/.test(n) ? [p] : [];
      });
    const allowed = new Set([
      "src/routeTree.gen.ts",
      "src/routes/_authenticated/imported-tickets.tsx",
      "src/lib/shell-nav.ts",
      "src/lib/route-access.ts",
    ]);
    const hits = walk("src").filter((f) => !allowed.has(f) && readFileSync(f, "utf8").includes("/imported-tickets"));
    expect(hits).toEqual([]);
  });

  it("the staged switch row is off and its undo removes only that row", () => {
    const sql = readFileSync("docs/pending/databases-tabs/01_imported_tickets_switch.sql", "utf8");
    expect(sql).toMatch(/'imported_tickets_page'[\s\S]*false\)\s*ON CONFLICT \(key\) DO NOTHING;/);
    const undo = readFileSync("docs/pending/databases-tabs/01_undo_imported_tickets_switch.sql", "utf8");
    expect(undo).toContain("DELETE FROM public.feature_flags WHERE key = 'imported_tickets_page';");
  });
});

describe("wording", () => {
  it("no seat, no Median, no long dash, no names on the new screens", () => {
    const files = ["src/lib/ticket-tabs.ts", "src/components/databases/TicketTabs.tsx"].map((f) => readFileSync(f, "utf8"));
    const strings = files.flatMap((src) => [...src.matchAll(/"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => (m[1] ?? m[2] ?? m[3] ?? "").trim()));
    for (const s of strings) {
      expect(s).not.toMatch(/\bseat\b/i);
      expect(s).not.toMatch(/\bMedian\b|\bHit\b/);
      expect(s).not.toContain("—");
      expect(s).not.toMatch(/\b(Emily|Josh|Micah)\b/);
    }
  });
});
