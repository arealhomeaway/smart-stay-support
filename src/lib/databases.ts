/**
 * Databases hub (register P3, C1, M1, M2; board approved Nov 8). Pure and
 * browser-safe: the cards, who can do what in each one (register A9 to A18 win
 * over the board), the list columns and filters, search and the claim tiles.
 * Databases is the window: the work is done where it happens. Only claims and
 * refunds change here, through one database save (docs/pending/databases).
 */
import type { AccessSeats, AppRole } from "@/lib/permissions";
import { amountAtRisk, unrecovered, type ClaimStage } from "@/lib/claims";
import { notionTicketState, type NotionTicketLike } from "@/lib/notion-ticket-display";

export type DatabaseKey =
  | "properties"
  | "house-items"
  | "owners"
  | "vendors"
  | "utilities"
  | "inventory"
  | "onboarding-projects"
  | "assessments"
  | "handoffs"
  | "budgets"
  | "inspections"
  | "tickets"
  | "departure-reviews"
  | "reviews"
  | "claims"
  | "vendor-invoices"
  | "direct-bookings"
  | "referral-sources"
  | "playbooks"
  | "team";

/** A card that opens a real page instead of a list. */
export type PageTarget = "/properties" | "/vendors" | "/onboarding";

export type DatabaseCard = {
  key: DatabaseKey;
  name: string;
  former: string;
  about: string;
  /** Set when the card opens the real page instead of a list. */
  page?: PageTarget;
  /** List columns, in board order. The first one is bold. */
  columns?: string[];
  /** Filters, named after a column. At most two. */
  filters?: string[];
  /** The work button label, for people who work there. */
  work?: string;
};

export type DatabaseGroup = { label: string; cards: DatabaseCard[] };

export const DATABASE_GROUPS: DatabaseGroup[] = [
  {
    label: "Homes & People",
    cards: [
      { key: "properties", name: "Properties", former: "Was the PID", about: "Every home, with all of its details.", page: "/properties" },
      {
        key: "house-items",
        name: "House items",
        former: "Was Household and Appliances and Window Measurements",
        about: "Appliances, warranties and measurements for each home.",
        columns: ["Home", "Item", "Brand and model", "Warranty"],
        filters: ["Item"],
      },
      {
        key: "owners",
        name: "Owners",
        former: "Was the Owner Database",
        about: "Every owner and how to reach them.",
        columns: ["Owner", "Homes", "Email", "Owner type"],
        filters: ["Owner type"],
      },
      { key: "vendors", name: "Vendors", former: "Was the Vendor Database", about: "The Vendors page you know, with a profile for each vendor.", page: "/vendors" },
      {
        key: "utilities",
        name: "Utilities",
        former: "Was Utility Info and the utilities matrix",
        about: "Providers, accounts and who pays.",
        columns: ["Home", "Utility", "Provider", "Who pays"],
        filters: ["Who pays"],
      },
      {
        key: "inventory",
        name: "Inventory",
        former: "Was Inventory",
        about: "What is stocked at each home.",
        columns: ["Home", "Item", "On hand", "Where"],
        filters: ["Home"],
      },
    ],
  },
  {
    label: "Onboarding",
    cards: [
      {
        key: "onboarding-projects",
        name: "Onboarding projects",
        former: "Was the Onboarding Project Database and Onboarding Information",
        about: "Every home on its way to handoff.",
        page: "/onboarding",
      },
      {
        key: "assessments",
        name: "Assessments",
        former: "Was the five assessment databases",
        about: "What we found at each home before setup.",
        columns: ["Home", "Assessment", "Date", "Findings"],
        filters: ["Assessment"],
        work: "Open the home to update the assessment",
      },
      {
        key: "handoffs",
        name: "Handoffs",
        former: "Was the Property Handoff Database",
        about: "Every home passed from onboarding to operations.",
        columns: ["Home", "Handoff date", "Project Manager", "Status", "Items carried over"],
        filters: ["Status"],
        work: "Open the home to update the handoff",
      },
      {
        key: "budgets",
        name: "Budgets and estimates",
        former: "Was the Onboarding Budget Tracker and Repair Estimates",
        about: "Furnishing budgets, repair estimates and invoices.",
        columns: ["Home", "Furnishing total", "Repair estimate", "Invoice status"],
        filters: ["Invoice status"],
        work: "Open the home to update the budget and invoices",
      },
      {
        key: "inspections",
        name: "Inspections",
        former: "Was the three inspection databases",
        about: "Every inspection, home by home.",
        columns: ["Home", "Inspection", "Date", "Status"],
        filters: ["Status"],
        work: "Open the inspection to update it",
      },
    ],
  },
  {
    label: "Operations & Finance",
    cards: [
      {
        key: "tickets",
        name: "Tickets",
        former: "Was Maintenance Ticket Management",
        about: "All work, open and closed.",
        columns: ["Ref", "Title", "Home", "Problem type", "Status", "Owner"],
        filters: ["Problem type", "Status"],
        work: "Open the Team Queue to work on tickets",
      },
      {
        key: "departure-reviews",
        name: "Departure reviews",
        former: "Was the Cleaning Review Database and Guest Rating log",
        about: "The clean and the guest review after each checkout.",
        columns: ["Home", "Checked out", "Clean checked", "Damage", "Review request"],
        filters: ["Review request"],
        work: "Open the departure review to update it",
      },
      {
        key: "reviews",
        name: "Reviews and surveys",
        former: "Was Reviews, Review Tracker and Guest Survey",
        about: "What guests say about our homes.",
        columns: ["Home", "Source", "Rating", "Date", "Follow-up"],
        filters: ["Source"],
        work: "Open the review to update it",
      },
      {
        key: "claims",
        name: "Claims and refunds",
        former: "Was the claims view",
        about: "Guest claims, refunds and credits.",
        columns: ["Item", "Home", "Type", "Amount", "Status"],
        filters: ["Type"],
        work: "Open the ticket to update a claim or refund",
      },
      {
        key: "vendor-invoices",
        name: "Vendor invoices",
        former: "Was the Invoice Tracker",
        about: "Every vendor invoice and where it stands.",
        columns: ["Invoice", "Vendor", "Home", "Amount", "Status"],
        filters: ["Status"],
        work: "Open the ticket to add or approve an invoice",
      },
      {
        key: "direct-bookings",
        name: "Direct bookings",
        former: "Was Housing Requests, Tenant Lead Management and Quotes",
        about: "Every request, offer and quote.",
        columns: ["Request", "Referral source", "Dates", "Status", "Monthly rate"],
        filters: ["Status"],
        work: "Open Direct Bookings to work a request",
      },
      {
        key: "referral-sources",
        name: "Referral sources",
        former: "Was Inquiry Type Pricing",
        about: "Insurance companies and partners that send us guests, and their rules.",
        columns: ["Source", "Type", "Cleaning fee", "Deposit"],
        filters: ["Type"],
      },
    ],
  },
  {
    label: "Our Team",
    cards: [
      {
        key: "playbooks",
        name: "Playbooks",
        former: "Was the Company Wiki SOPs",
        about: "Our written way of doing things.",
        columns: ["Playbook", "Status", "Owner", "Updated"],
        filters: ["Status"],
      },
      {
        key: "team",
        name: "Team and coverage",
        former: "Was On Call Schedule",
        about: "Who works when, and who is on call.",
        columns: ["Person", "Team", "Shift", "On call"],
        filters: ["Team"],
      },
    ],
  },
];

export const ALL_DATABASES: DatabaseCard[] = DATABASE_GROUPS.flatMap((g) => g.cards);

export function databaseCard(key: string): DatabaseCard | null {
  return ALL_DATABASES.find((c) => c.key === key) ?? null;
}

export const DATABASES_FOOTER =
  "Names show what each database was called in Notion. The grey tag on each card shows what you can do in it.";
export const DATABASES_NO_DELETE = "Nothing can be deleted, only changed.";
export const VIEW_ONLY_BAR = "You can look at everything here and search it. Changes are made where the work happens.";
export const VIEW_ONLY_ROW = "View only. Update this where the work happens.";
export const CLAIMS_EDIT_BAR = "Changes you make here update the same claim on its ticket, with your name and the time.";

/* ------------------------------------------------------------------------- */
/* Who can do what                                                           */
/* ------------------------------------------------------------------------- */

export type DatabaseMode = "edit" | "view" | "ops_finance" | "hidden";

export const MODE_CHIP: Record<Exclude<DatabaseMode, "hidden">, string> = {
  edit: "You can edit",
  view: "View only",
  ops_finance: "Operations and Finance only",
};

/** The roles the register names, read from the account type and team roles. */
export type DbWho =
  | "admin"
  | "coordinator"
  | "supervisor"
  | "dirOps"
  | "finance"
  | "dirOnb"
  | "pm"
  | "utilities"
  | "design";

export type DbViewer = { roles: AppRole[]; seats?: AccessSeats };

export function whoIs(v: DbViewer): Set<DbWho> {
  const s = v.seats ?? {};
  const out = new Set<DbWho>();
  if (v.roles.includes("admin")) out.add("admin");
  if (v.roles.includes("tech")) out.add("coordinator");
  if (s.opsDirector) out.add("dirOps");
  if (s.finance) out.add("finance");
  // A Supervisor account is the Operations Supervisor unless it is held for Finance or the Director.
  if (s.opsSupervisor || (v.roles.includes("manager") && !s.finance && !s.opsDirector)) out.add("supervisor");
  if (s.onboardingDirector) out.add("dirOnb");
  if (s.projectManager) out.add("pm");
  if (s.utilities) out.add("utilities");
  if (v.roles.includes("onboarding") && !s.onboardingDirector && !s.projectManager && !s.utilities) out.add("design");
  return out;
}

const OPS: DbWho[] = ["admin", "coordinator", "supervisor", "dirOps"];
const ONB: DbWho[] = ["dirOnb", "pm", "utilities", "design"];

type Rule = { edit?: DbWho[]; view?: DbWho[]; ops_finance?: DbWho[] };
const PROPERTY_RULE: Rule = { edit: [...OPS, "dirOnb", "pm", "design"], view: ["utilities", "finance"] };

/** Register lines: A12 homes, A9 vendors, A16 onboarding, A10 claims, A18 finance, A11 bookings, A15 playbooks, A13 schedule. */
const RULES: Record<DatabaseKey, Rule> = {
  properties: PROPERTY_RULE,
  "house-items": PROPERTY_RULE,
  owners: PROPERTY_RULE,
  vendors: { edit: ["admin", "supervisor", "dirOps", "dirOnb", "pm", "utilities"], view: ["coordinator", "finance"] },
  utilities: { edit: [...OPS, "dirOnb", "pm", "design", "utilities"], view: ["finance"] },
  // No page owns these yet, so everyone views.
  inventory: { view: [...OPS, ...ONB, "finance"] },
  inspections: { view: [...OPS, ...ONB, "finance"] },
  "onboarding-projects": { edit: ["admin", "dirOnb", "pm", "utilities", "design"], view: ["dirOps", "finance"] },
  assessments: { edit: ["admin", "dirOnb", "pm", "utilities", "design"], view: ["coordinator", "supervisor", "dirOps", "finance"] },
  handoffs: { edit: ["admin", "dirOnb", "pm", "supervisor", "dirOps"], view: ["coordinator", "utilities", "design", "finance"] },
  budgets: { edit: ["admin", "dirOnb", "pm"], view: ["coordinator", "supervisor", "dirOps", "utilities", "design", "finance"] },
  tickets: { edit: OPS, view: [...ONB, "finance"] },
  "departure-reviews": { edit: OPS, view: [...ONB, "finance"] },
  reviews: { edit: OPS, view: [...ONB, "finance"] },
  claims: { edit: OPS, view: ["finance"], ops_finance: ONB },
  "vendor-invoices": { edit: ["admin", "finance"], view: ["coordinator", "supervisor", "dirOps", "dirOnb"], ops_finance: ["pm", "utilities", "design"] },
  "direct-bookings": { edit: OPS, view: ["finance"], ops_finance: ONB },
  "referral-sources": { edit: OPS, view: ["finance"], ops_finance: ONB },
  playbooks: { edit: ["admin", "supervisor", "dirOps", "dirOnb"], view: ["coordinator", "pm", "utilities", "design", "finance"] },
  team: { edit: ["admin", "supervisor", "dirOps"], view: ["coordinator", ...ONB] },
};

const RANK: Record<DatabaseMode, number> = { edit: 3, view: 2, ops_finance: 1, hidden: 0 };

/** What this person can do in a database. The best of their roles wins. */
export function databaseMode(key: DatabaseKey, viewer: DbViewer): DatabaseMode {
  const who = whoIs(viewer);
  const rule = RULES[key];
  let best: DatabaseMode = "hidden";
  for (const mode of ["edit", "view", "ops_finance"] as const) {
    if ((rule[mode] ?? []).some((w) => who.has(w)) && RANK[mode] > RANK[best]) best = mode;
  }
  return best;
}

/** Cards on the hub for this person: hidden ones are left out (register "Hidden"). */
export function hubGroups(viewer: DbViewer): { label: string; cards: (DatabaseCard & { mode: Exclude<DatabaseMode, "hidden"> })[] }[] {
  return DATABASE_GROUPS.map((g) => ({
    label: g.label,
    cards: g.cards.flatMap((c) => {
      const mode = databaseMode(c.key, viewer);
      return mode === "hidden" ? [] : [{ ...c, mode }];
    }),
  })).filter((g) => g.cards.length > 0);
}

/** May this person read the records of a list (by its card or by typing the address)? */
export function canReadList(key: DatabaseKey, viewer: DbViewer): boolean {
  const mode = databaseMode(key, viewer);
  return mode === "edit" || mode === "view";
}

/** Only claims and refunds change in the list (Emily, Nov 8). */
export function canEditInList(key: DatabaseKey, viewer: DbViewer): boolean {
  return key === "claims" && databaseMode(key, viewer) === "edit";
}

/** The link on an opened record, for people who work there. Tickets open for everyone who can open them. */
export function rowLinkLabel(card: DatabaseCard, mode: DatabaseMode): string | null {
  if (card.key === "tickets") return "Open the ticket";
  if (mode !== "edit") return null;
  const own: Partial<Record<DatabaseKey, string>> = {
    owners: "Open the home",
    "house-items": "Open the home",
    utilities: "Open the home",
    "referral-sources": "Open Referral sources",
    playbooks: "Open the playbook library",
    team: "Open Team and Coverage",
    "direct-bookings": "Open the request",
  };
  return own[card.key] ?? card.work ?? null;
}

/** Work buttons that sit at the top of the list (one page holds all the work). */
export const PAGE_WORK: Partial<Record<DatabaseKey, "/team-queue" | "/direct-bookings">> = {
  tickets: "/team-queue",
  "direct-bookings": "/direct-bookings",
};

export function opsFinanceOnlyLine(card: DatabaseCard): string {
  return `${card.name} are handled by Operations and Finance.`;
}

/* ------------------------------------------------------------------------- */
/* Rows, search and filters                                                  */
/* ------------------------------------------------------------------------- */

export type DbLink =
  | { kind: "property"; id: string; tab?: string }
  | { kind: "onboarding"; id: string }
  | { kind: "ticket"; id: string }
  | { kind: "booking"; id: string }
  | { kind: "page"; to: "/playbooks" | "/team" | "/inquiry-sources" | "/finance" | "/team-queue" | "/direct-bookings" };

export type DbField = { label: string; value: string };

export type DbRow = {
  id: string;
  /** One value per column, in column order. */
  cells: string[];
  /** Everything shown when the row is opened. */
  fields: DbField[];
  /** Extra words the search also finds (notes, names, codes). */
  extra?: string;
  /** Extra filter values that are not columns (Tickets: Historical, Claims to work). */
  tags?: Record<string, string>;
  /** Where the record is worked. */
  link?: DbLink;
  /** Claims and refunds only: what may change in the list. */
  edit?: ClaimEdit;
};

/** The values of a claim or refund that may change in the list. */
export type ClaimEdit = {
  kind: "claim" | "refund";
  id: string;
  updatedAt: string;
  values: Record<string, string>;
};

/** The fields that change in the list, in order. The database save allows exactly these. */
export const CLAIM_EDIT_FIELDS: Record<ClaimEdit["kind"], { key: string; label: string; type: "text" | "money" | "date" | "stage" }[]> = {
  claim: [
    { key: "title", label: "Item", type: "text" },
    { key: "stage", label: "Status", type: "stage" },
    { key: "estimated_amount", label: "Estimated cost", type: "money" },
    { key: "submitted_amount", label: "Amount sent", type: "money" },
    { key: "recovered_amount", label: "Amount paid back", type: "money" },
    { key: "follow_up_on", label: "Follow up on", type: "date" },
  ],
  refund: [
    { key: "title", label: "Item", type: "text" },
    { key: "proposed_amount", label: "Amount", type: "money" },
    { key: "follow_up_on", label: "Follow up on", type: "date" },
  ],
};

/** Only what changed, in the shape the database save takes. Blank money or dates clear the value. */
export function claimChanges(
  edit: ClaimEdit,
  draft: Record<string, string>,
): { changes: Record<string, string | number | null>; error: string | null } {
  const changes: Record<string, string | number | null> = {};
  for (const f of CLAIM_EDIT_FIELDS[edit.kind]) {
    const before = (edit.values[f.key] ?? "").trim();
    const after = (draft[f.key] ?? "").trim();
    if (before === after) continue;
    if (f.type === "text") {
      if (!after) return { changes: {}, error: `${f.label} cannot be empty.` };
      changes[f.key] = after;
    } else if (f.type === "money") {
      if (!after) changes[f.key] = null;
      else {
        const n = Number(after.replace(/[$,\s]/g, ""));
        if (!Number.isFinite(n)) return { changes: {}, error: "Amounts must be numbers." };
        if (n < 0) return { changes: {}, error: "Amounts cannot be below zero." };
        changes[f.key] = n;
      }
    } else {
      changes[f.key] = after || null;
    }
  }
  return { changes, error: null };
}

export const EMPTY = "";

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function rowText(row: DbRow): string {
  return normalize([...row.cells, ...row.fields.map((f) => f.value), row.extra ?? ""].join(" "));
}

/** Every word typed must appear somewhere in the record. */
export function rowMatches(row: DbRow, term: string): boolean {
  const words = normalize(term).split(" ").filter(Boolean);
  if (!words.length) return true;
  const text = rowText(row);
  return words.every((w) => text.includes(w));
}

export const ALL = "All";

/** The choices for a filter named after a column: All, then each value in the rows. */
export function filterOptions(rows: DbRow[], columns: string[], filter: string): string[] {
  const i = columns.indexOf(filter);
  const values = new Set<string>();
  for (const r of rows) {
    const v = i >= 0 ? r.cells[i] : r.tags?.[filter];
    if (v) values.add(v);
  }
  return [ALL, ...[...values].sort((a, b) => a.localeCompare(b))];
}

export function applyList(
  rows: DbRow[],
  columns: string[],
  term: string,
  chosen: Record<string, string>,
): DbRow[] {
  return rows.filter((r) => {
    if (!rowMatches(r, term)) return false;
    for (const [filter, value] of Object.entries(chosen)) {
      if (!value || value === ALL) continue;
      const i = columns.indexOf(filter);
      const v = i >= 0 ? r.cells[i] : r.tags?.[filter];
      if (v !== value) return false;
    }
    return true;
  });
}

export function countLine(shown: number, total: number): string {
  return `${shown} of ${total} records`;
}

export type HubResult = { key: DatabaseKey; database: string; row: DbRow; label: string; sub: string };

/** Search every list this person can open. */
export function searchEverything(lists: { card: DatabaseCard; rows: DbRow[] }[], term: string, limitPerList = 25): HubResult[] {
  if (!normalize(term)) return [];
  const out: HubResult[] = [];
  for (const { card, rows } of lists) {
    for (const row of rows.filter((r) => rowMatches(r, term)).slice(0, limitPerList)) {
      const [first, ...rest] = row.cells;
      out.push({ key: card.key, database: card.name, row, label: first || card.name, sub: rest.filter(Boolean).join(" · ") });
    }
  }
  return out;
}

export function resultsLine(n: number): string {
  return `${n} ${n === 1 ? "result" : "results"} across every database you can open`;
}

/* ------------------------------------------------------------------------- */
/* Tickets                                                                   */
/* ------------------------------------------------------------------------- */

export const HISTORICAL_FILTER = "Historical";
export const CLAIMS_TO_WORK_FILTER = "Claims to work";
export const HISTORICAL_OPTIONS = [ALL, "Historical record from Notion", "Older open ticket from Notion", "Not imported"] as const;
export const CLAIMS_TO_WORK_OPTIONS = [ALL, CLAIMS_TO_WORK_FILTER] as const;

/** The Historical filter value for a ticket. Recent and reopened imports count as ordinary work. */
export function historicalTag(t: NotionTicketLike, now: number = Date.now()): string {
  const s = notionTicketState(t, now);
  if (s === "historical") return "Historical record from Notion";
  if (s === "older_open") return "Older open ticket from Notion";
  return "Not imported";
}

/* ------------------------------------------------------------------------- */
/* Claims and refunds                                                        */
/* ------------------------------------------------------------------------- */

/** Needs evidence, Ready to send and Submitted on the board. */
export const AT_RISK_STAGES: ClaimStage[] = [
  "potential",
  "gathering",
  "costing",
  "ready_to_submit",
  "submitted",
  "waiting_external",
  "info_requested",
];
/** Submitted on the board: sent and waiting on the other side. */
export const PAYBACK_STAGES: ClaimStage[] = ["submitted", "waiting_external", "info_requested"];

type TileClaim = Parameters<typeof amountAtRisk>[0];

export function claimTiles(claims: TileClaim[]): { atRisk: number; payback: number } {
  let atRisk = 0;
  let payback = 0;
  for (const c of claims) {
    if (AT_RISK_STAGES.includes(c.stage)) atRisk += amountAtRisk(c) ?? 0;
    if (PAYBACK_STAGES.includes(c.stage)) payback += unrecovered(c) ?? amountAtRisk(c) ?? 0;
  }
  return { atRisk, payback };
}

export const CLAIM_TILE_LABELS = { atRisk: "Money we could still lose", payback: "Waiting to be paid back" } as const;

/** Claim, Refund or Credit, from the stored remedy. */
export function claimOrRefundType(kind: "claim" | "refund", action?: string | null): "Claim" | "Refund" | "Credit" {
  if (kind === "claim") return "Claim";
  return action === "credit" ? "Credit" : "Refund";
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return EMPTY;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** "Saved just now by you, at 9:42 PM." */
export function savedLine(at: Date): string {
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" });
  return `Saved just now by you, at ${time}.`;
}
