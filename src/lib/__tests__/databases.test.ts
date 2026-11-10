import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import type { AccessSeats, AppRole } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import { canOpenPath } from "@/lib/route-access";
import { onboardingOnlyMenu, operationsMenu, type NavAccess } from "@/lib/shell-nav";
import { notionAction } from "@/lib/notion-ticket-display";
import {
  ALL,
  ALL_DATABASES,
  CLAIMS_TO_WORK_FILTER,
  DATABASE_GROUPS,
  HISTORICAL_FILTER,
  applyList,
  canEditInList,
  canReadList,
  claimChanges,
  claimOrRefundType,
  claimTiles,
  countLine,
  databaseMode,
  filterOptions,
  historicalTag,
  hubGroups,
  opsFinanceOnlyLine,
  resultsLine,
  searchEverything,
  type DatabaseKey,
  type DbRow,
} from "@/lib/databases";

/**
 * Databases hub (board approved Nov 8; register P3, C1, M1, M2, A9 to A18).
 * The register's access lines win where they differ from the board.
 */
type Profile = { roles: AppRole[]; seats: AccessSeats };
const PROFILES = {
  PC: { roles: ["tech"], seats: {} },
  Supervisor: { roles: ["manager"], seats: { opsSupervisor: true } },
  DirOps: { roles: ["manager"], seats: { opsDirector: true } },
  DirOnb: { roles: ["onboarding"], seats: { onboardingDirector: true } },
  PM: { roles: ["onboarding"], seats: { projectManager: true } },
  Utilities: { roles: ["onboarding"], seats: { utilities: true } },
  Design: { roles: ["onboarding"], seats: {} },
  Finance: { roles: ["manager"], seats: { finance: true } },
  Admin: { roles: ["admin"], seats: {} },
} satisfies Record<string, Profile>;

// E = You can edit, V = View only, O = Operations and Finance only, - = not shown.
const KEYS: DatabaseKey[] = [
  "properties", "house-items", "owners", "vendors", "utilities", "inventory",
  "onboarding-projects", "assessments", "handoffs", "budgets", "inspections",
  "tickets", "departure-reviews", "arrival-readiness", "reviews", "claims", "vendor-invoices", "direct-bookings", "referral-sources", "bonus-payouts",
  "playbooks", "team",
];
const MATRIX: Record<string, string> = {
  //          prop hi own ven uti inv | onb ass han bud ins | tic dep arr rev cla inv dbk ref bon | pb team
  PC:         "E E E V E V  - V V V V  E E V E E V E E -  V V",
  Supervisor: "E E E E E V  - V E V V  E E V E E V E E -  E E",
  DirOps:     "E E E E E V  V V E V V  E E V E E V E E -  E E",
  DirOnb:     "E E E E E V  E E E E V  V V - V O V O O -  E V",
  PM:         "E E E E E V  E E E E V  V V - V O O O O -  V V",
  Utilities:  "V V V E E V  E E V V V  V V - V O O O O -  V V",
  Design:     "E E E - E V  E E V V V  V V - V O O O O -  V V",
  Finance:    "V V V V V V  V V V V V  V V V V V E V V V  V -",
  Admin:      "E E E E E V  E E E E V  E E V E E E E E V  E E",
};
const LETTER = { edit: "E", view: "V", ops_finance: "O", hidden: "-" } as const;

describe("the hub", () => {
  it("has twenty one cards in four groups, in board order", () => {
    expect(DATABASE_GROUPS.map((g) => g.label)).toEqual(["Homes & People", "Onboarding", "Operations & Finance", "Our Team"]);
    expect(ALL_DATABASES.map((c) => c.key)).toEqual(KEYS);
    expect(DATABASE_GROUPS.map((g) => g.cards.map((c) => c.name))).toEqual([
      ["Properties", "House items", "Owners", "Vendors", "Utilities", "Inventory"],
      ["Onboarding projects", "Assessments", "Handoffs", "Budgets and estimates", "Inspections"],
      ["Tickets", "Departure reviews", "Arrival readiness", "Reviews and surveys", "Claims and refunds", "Vendor invoices", "Direct bookings", "Referral sources"],
      ["Playbooks", "Team and coverage"],
    ]);
  });

  it("every card has its former name and one line, and lists have at most two filters named after a column", () => {
    for (const c of ALL_DATABASES) {
      expect(c.former.startsWith("Was ")).toBe(true);
      expect(c.about.length).toBeGreaterThan(5);
      if (!c.page) {
        expect((c.filters ?? []).length).toBeLessThanOrEqual(2);
        for (const f of c.filters ?? []) expect(c.columns).toContain(f);
      }
    }
    expect(ALL_DATABASES.filter((c) => c.page).map((c) => [c.key, c.page])).toEqual([
      ["properties", "/properties"],
      ["vendors", "/vendors"],
      ["onboarding-projects", "/onboarding"],
    ]);
  });

  for (const [name, p] of Object.entries(PROFILES)) {
    it(`${name}: the chips on every card`, () => {
      const got = KEYS.map((k) => LETTER[databaseMode(k, p)]).join("");
      expect(got).toBe(MATRIX[name]!.replace(/\s/g, ""));
      // Hidden cards are left off the hub; the four groups stay in order.
      const shown = hubGroups(p).flatMap((g) => g.cards.map((c) => c.key));
      expect(shown).toEqual(KEYS.filter((k) => databaseMode(k, p) !== "hidden"));
    });
  }

  it("onboarding sees Claims and refunds as Operations and Finance only and cannot read its list by address", () => {
    for (const name of ["DirOnb", "PM", "Utilities", "Design"]) {
      const p = PROFILES[name as keyof typeof PROFILES];
      expect(databaseMode("claims", p)).toBe("ops_finance");
      expect(canReadList("claims", p)).toBe(false);
      expect(canEditInList("claims", p)).toBe(false);
    }
    const card = ALL_DATABASES.find((c) => c.key === "claims")!;
    expect(opsFinanceOnlyLine(card)).toBe("Claims and refunds are handled by Operations and Finance.");
    // The list page shows the dashed box instead of records for that mode.
    const page = readFileSync("src/routes/_authenticated/databases.$key.tsx", "utf8");
    expect(page).toContain('mode === "ops_finance"');
    expect(page).toContain("opsFinanceOnlyLine(card)");
  });

  it("only claims and refunds change in the list: every coordinator may, Finance only views (A10)", () => {
    expect(canEditInList("claims", PROFILES.PC!)).toBe(true);
    expect(canEditInList("claims", PROFILES.Supervisor!)).toBe(true);
    expect(canEditInList("claims", PROFILES.DirOps!)).toBe(true);
    expect(canEditInList("claims", PROFILES.Admin!)).toBe(true);
    expect(canEditInList("claims", PROFILES.Finance!)).toBe(false);
    for (const k of KEYS.filter((k) => k !== "claims")) expect(canEditInList(k, PROFILES.Admin!)).toBe(false);
  });

  it("the hub search finds a home across lists, tagged by database", () => {
    const tickets = ALL_DATABASES.find((c) => c.key === "tickets")!;
    const claims = ALL_DATABASES.find((c) => c.key === "claims")!;
    const reviews = ALL_DATABASES.find((c) => c.key === "reviews")!;
    const row = (id: string, cells: string[]): DbRow => ({ id, cells, fields: [] });
    const hits = searchEverything(
      [
        { card: tickets, rows: [row("t1", ["101", "Refrigerator not cold", "12 Highpoint Dr", "Immediate maintenance", "Open", ""]), row("t2", ["102", "Towels", "9 Foxtail Ln", "", "Closed", ""])] },
        { card: claims, rows: [row("c1", ["Broken TV", "12 Highpoint Dr", "Claim", "$300", "Gathering evidence"])] },
        { card: reviews, rows: [row("r1", ["9 Foxtail Ln", "Airbnb", "5", "Nov 1, 2026", ""])] },
      ],
      "highpoint",
    );
    expect(hits.map((h) => [h.database, h.label])).toEqual([
      ["Tickets", "101"],
      ["Claims and refunds", "Broken TV"],
    ]);
    expect(resultsLine(hits.length)).toBe("2 results across every database you can open");
    expect(searchEverything([{ card: tickets, rows: [] }], "  ")).toEqual([]);
  });
});

describe("Tickets list", () => {
  const card = ALL_DATABASES.find((c) => c.key === "tickets")!;
  const cols = card.columns!;
  const rows: DbRow[] = [
    { id: "a", cells: ["1", "Leak", "12 Highpoint Dr", "Immediate maintenance", "Closed", ""], fields: [], tags: { [HISTORICAL_FILTER]: "Historical record from Notion" } },
    { id: "b", cells: ["2", "Lockout", "9 Foxtail Ln", "Lock offline or low-battery alert", "Open", "A coordinator"], fields: [], tags: { [HISTORICAL_FILTER]: "Not imported", [CLAIMS_TO_WORK_FILTER]: CLAIMS_TO_WORK_FILTER } },
    { id: "c", cells: ["3", "Old fridge", "9 Foxtail Ln", "Immediate maintenance", "Open", ""], fields: [], tags: { [HISTORICAL_FILTER]: "Older open ticket from Notion" } },
  ];

  it("has the board columns and filters", () => {
    expect(cols).toEqual(["Ref", "Title", "Home", "Problem type", "Status", "Owner"]);
    expect(card.filters).toEqual(["Problem type", "Status"]);
    expect(filterOptions(rows, cols, "Status")).toEqual([ALL, "Closed", "Open"]);
  });

  it("filters by Problem type, Status, Historical and Claims to work, and search finds closed imports", () => {
    expect(applyList(rows, cols, "", { "Problem type": "Immediate maintenance" }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(applyList(rows, cols, "", { Status: "Open" }).map((r) => r.id)).toEqual(["b", "c"]);
    expect(applyList(rows, cols, "", { [HISTORICAL_FILTER]: "Historical record from Notion" }).map((r) => r.id)).toEqual(["a"]);
    expect(applyList(rows, cols, "", { [HISTORICAL_FILTER]: "Not imported" }).map((r) => r.id)).toEqual(["b"]);
    expect(applyList(rows, cols, "", { [CLAIMS_TO_WORK_FILTER]: CLAIMS_TO_WORK_FILTER }).map((r) => r.id)).toEqual(["b"]);
    expect(applyList(rows, cols, "leak", {}).map((r) => r.id)).toEqual(["a"]);
    expect(applyList(rows, cols, "", { Status: ALL }).length).toBe(3);
    expect(countLine(1, 3)).toBe("1 of 3 records");
  });

  it("Historical: closed Notion imports are Historical records, old open ones are Older open, the rest Not imported", () => {
    const now = Date.parse("2026-11-08T12:00:00Z");
    expect(historicalTag({ external_source: "notion", status: "closed", reported_at: "2026-01-01T00:00:00Z" }, now)).toBe("Historical record from Notion");
    expect(historicalTag({ external_source: "notion", status: "open", reported_at: "2026-01-01T00:00:00Z" }, now)).toBe("Older open ticket from Notion");
    expect(historicalTag({ external_source: null, status: "closed" }, now)).toBe("Not imported");
  });

  it("a closed imported ticket opens the ticket page, where people who work tickets can Reopen; onboarding cannot (T12)", () => {
    const closed = { external_source: "notion", status: "closed", reported_at: "2026-01-01T00:00:00Z" };
    expect(notionAction(closed, can(["tech"], "ticket_create") && canOpenPath("/team-queue", { roles: ["tech"] }))?.kind).toBe("reopen");
    expect(canOpenPath("/tickets/00000000-0000-4000-8000-000000000001", { roles: ["tech"] })).toBe(true);
    expect(canOpenPath("/team-queue", { roles: ["onboarding"] })).toBe(false);
    expect(notionAction(closed, false)).toBeNull();
  });
});

describe("Claims and refunds list", () => {
  it("tiles: money we could still lose and money waiting to be paid back", () => {
    const t = claimTiles([
      { claim_type: "guest_damage", stage: "gathering", estimated_amount: 300 },
      { claim_type: "guest_damage", stage: "ready_to_submit", actual_cost: 200 },
      { claim_type: "channel_aircover", stage: "submitted", submitted_amount: 500, recovered_amount: 100 },
      { claim_type: "guest_damage", stage: "recovered", submitted_amount: 900, recovered_amount: 900 },
      { claim_type: "guest_damage", stage: "closed", estimated_amount: 50 },
    ]);
    expect(t).toEqual({ atRisk: 1000, payback: 400 });
  });

  it("Type is Claim, Refund or Credit", () => {
    expect(claimOrRefundType("claim")).toBe("Claim");
    expect(claimOrRefundType("refund", "partial_refund")).toBe("Refund");
    expect(claimOrRefundType("refund", "credit")).toBe("Credit");
  });

  it("only what changed is saved, with clear errors", () => {
    const edit = { kind: "claim" as const, id: "c", updatedAt: "x", values: { title: "TV", stage: "gathering", estimated_amount: "300", submitted_amount: "", recovered_amount: "", follow_up_on: "" } };
    expect(claimChanges(edit, { ...edit.values, stage: "costing", submitted_amount: "$1,250" })).toEqual({ changes: { stage: "costing", submitted_amount: 1250 }, error: null });
    expect(claimChanges(edit, { ...edit.values, estimated_amount: "" }).changes).toEqual({ estimated_amount: null });
    expect(claimChanges(edit, { ...edit.values, title: " " }).error).toBe("Item cannot be empty.");
    expect(claimChanges(edit, { ...edit.values, submitted_amount: "-5" }).error).toBe("Amounts cannot be below zero.");
    expect(claimChanges(edit, { ...edit.values, submitted_amount: "abc" }).error).toBe("Amounts must be numbers.");
  });
});

describe("menu", () => {
  const access = (roles: AppRole[], flags: string[] = []): NavAccess => ({
    can: (c) => can(roles, c),
    canOpen: (p) => canOpenPath(p, { roles }),
    flagEnabled: (k) => flags.includes(k),
  });
  it("Databases sits right after Direct Bookings in My day (Vendors left the menu, Nov 9), and Guest Claims & Refunds is gone from the menu", () => {
    for (const roles of [["tech"], ["manager"], ["admin"]] as AppRole[][]) {
      const myDay = operationsMenu(access(roles)).find((g) => g.label === "My day")!.items.map((i) => i.label);
      expect(myDay.indexOf("Databases")).toBe(myDay.indexOf("Direct Bookings") + 1);
      expect(myDay).not.toContain("Vendors");
      expect(myDay).not.toContain("Guest Claims & Refunds");
    }
    expect(canOpenPath("/claims", { roles: ["tech"] })).toBe(true);
  });
  it("onboarding accounts get Databases in their menu too", () => {
    const labels = onboardingOnlyMenu(access(["onboarding"])).flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Databases");
  });
  it("owners and vendors cannot open Databases", () => {
    expect(canOpenPath("/databases", { roles: ["owner"] })).toBe(false);
    expect(canOpenPath("/databases", { roles: ["vendor"] })).toBe(false);
    expect(canOpenPath("/databases/claims", { roles: ["onboarding"] })).toBe(true);
  });
});

describe("wording", () => {
  it("no word sample, no seat, no long dash on the Databases screens", () => {
    const files = [
      "src/lib/databases.ts",
      "src/routes/_authenticated/databases.index.tsx",
      "src/routes/_authenticated/databases.$key.tsx",
      "src/components/databases/DatabaseParts.tsx",
    ].map((f) => readFileSync(f, "utf8"));
    const strings = files.flatMap((src) => [...src.matchAll(/"([^"\n]*)"|>([^<>{}\n]+)</g)].map((m) => (m[1] ?? m[2] ?? "").trim()));
    for (const s of strings) {
      expect(s).not.toMatch(/\bsamples?\b/i);
      expect(s).not.toMatch(/\bseat\b/i);
      expect(s).not.toContain("—");
    }
  });
});
