/**
 * Onboarding Home as the project database (approved by the Admin, Nov 12).
 *
 * Pure rules only, so the tiles, the list, every view, the CSV and the server read the same
 * facts and each rule is tested without a database: which tab and phase a home sits in, the
 * tiles chosen by who is signed in and what each counts, the reason line and where a row
 * opens, My homes, every filter, search across tabs, the Workload lists, the address
 * parameters Back restores, and who may do what. The server re-checks every save.
 */
import { NOTION_STATUSES, daysBetween, shortDate } from "@/lib/onboarding-board";

/* ------------------------------------------------------------ the rows */

export type Lifecycle = "active" | "upcoming" | "handed_off" | "fell_through";
export type Person = { id: string; name: string };
export type TeamRole = "pm" | "designer" | "utilities" | "stager";

export type HomeRow = {
  propertyId: string;
  projectId: string | null;
  name: string;
  /** "City, ST" */
  place: string;
  photo: string | null;
  activeOwner: boolean;
  ownerType: string | null;
  ownerName: string | null;
  status: string | null;
  invoiceStatus: string | null;
  lifecycle: Lifecycle;
  /** 1 to 6, the property page's computed stage (stage 1 with no plan). */
  stage: number;
  hasPlan: boolean;
  closingOn: string | null;
  /** True once the actual closing date is recorded. */
  closed: boolean;
  possessionOn: string | null;
  committedOn: string | null;
  estimateOn: string | null;
  /** Committed, else estimated. */
  handoffOn: string | null;
  /** Past homes: when the handoff was accepted or the contract fell through. */
  endedOn: string | null;
  note: string | null;
  schedule: { behind: boolean; days: number; label: string };
  team: { pm: Person | null; designer: Person | null; utilities: Person | null; director: Person | null; stagers: Person[] };
  /** The viewer is PM, Designer or Utilities on this home. */
  onTeam: boolean;
  /** Added with Add to my homes. */
  followed: boolean;
  /** The viewer's own open Tasks here that are late (the PM owns unassigned work). */
  lateMine: number;
  /** The viewer's own open Tasks here due in the next 7 days. */
  dueWeekMine: number;
  /** Owner replies waiting on staff, counted only when the viewer is on the team. */
  ownerWaiting: number;
  market: string | null;
  scope: string | null;
  utilityOption: string | null;
  hoa: boolean;
  breezeway: boolean;
  labels: string[];
  ownerRezId: string | null;
  isDemo: boolean;
};

/** An OwnerRez home with no Resolve property or no onboarding project, not live (2.6). */
export type OwnerRezRow = {
  listingId: string;
  name: string;
  place: string;
  addedOn: string | null;
  /** The Resolve home already linked to it, when there is one with no project. */
  propertyId: string | null;
};

/* ----------------------------------------------------------- the phases */

export const PHASES = [
  { value: "staging", label: "Staging and handoff" },
  { value: "closed", label: "Closed: design, ordering and repairs" },
  { value: "before", label: "Before closing" },
  { value: "upcoming", label: "Upcoming · not under contract yet" },
] as const;
export type Phase = (typeof PHASES)[number]["value"];

/** 2.3: stage 4 to 6, stage 2 to 3, stage 1; Upcoming homes (before contract) last. */
export function phaseFor(row: Pick<HomeRow, "lifecycle" | "stage">): Phase {
  if (row.lifecycle === "upcoming") return "upcoming";
  if (row.stage >= 4) return "staging";
  if (row.stage >= 2) return "closed";
  return "before";
}

/** Notion's Upcoming Property status maps to Upcoming; a home with a plan never is. */
export function lifecycleFor(input: {
  projectStatus: string | null | undefined;
  status: string | null | undefined;
  hasPlan: boolean;
  handedOff: boolean;
}): Lifecycle {
  const ps = (input.projectStatus ?? "").trim();
  if (ps === "Contract Fell Through") return "fell_through";
  if (input.handedOff || ps === "Property Handed Off" || input.status === "complete") return "handed_off";
  if (!input.hasPlan && (ps === "Upcoming Property" || input.status === "planning")) return "upcoming";
  return "active";
}

const STATES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
  florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
  louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
  "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
/** 2.3: "City, ST". A full state name is shortened; anything unknown is kept as stored. */
export function placeLine(city: string | null | undefined, state: string | null | undefined): string {
  const st = (state ?? "").trim();
  const short = STATES[st.toLowerCase()] ?? st;
  return [(city ?? "").trim(), short].filter(Boolean).join(", ");
}

export type HomeTab = "active" | "all";
/** 2.1: Active projects holds onboarding and Upcoming homes; the other tab holds past homes. */
export function tabFor(row: Pick<HomeRow, "lifecycle">): HomeTab {
  return row.lifecycle === "active" || row.lifecycle === "upcoming" ? "active" : "all";
}

/** Past homes newest first. */
export function pastOrder(a: HomeRow, b: HomeRow): number {
  return (b.endedOn ?? b.handoffOn ?? "").localeCompare(a.endedOn ?? a.handoffOn ?? "");
}

/* ------------------------------------------------------------ the tiles */

export type TileKey =
  | "late_mine"
  | "owners_waiting"
  | "due_week"
  | "next_handoff"
  | "behind"
  | "missing_setup"
  | "not_in_resolve"
  | "closing_no_pm"
  | "handoffs_14";
export type TileTone = "red" | "amber" | "blue" | "teal";

export const TEAM_TILES: { key: TileKey; label: string; tone: TileTone; clear: string }[] = [
  { key: "late_mine", label: "Late on your homes", tone: "red", clear: "Nothing past due" },
  { key: "owners_waiting", label: "Owners waiting on you", tone: "amber", clear: "No owner is waiting" },
  { key: "due_week", label: "Due this week", tone: "blue", clear: "Nothing due this week" },
  { key: "next_handoff", label: "Your next handoff", tone: "teal", clear: "No handoff coming up" },
];
export const LEAD_TILES: { key: TileKey; label: string; tone: TileTone; clear: string }[] = [
  { key: "behind", label: "Homes behind schedule", tone: "red", clear: "Every home on track" },
  { key: "missing_setup", label: "Missing setup", tone: "amber", clear: "Every home is set up" },
  { key: "not_in_resolve", label: "Not in Resolve yet", tone: "amber", clear: "Every OwnerRez home is here" },
  { key: "closing_no_pm", label: "Closing soon without a PM", tone: "blue", clear: "Every closing has a PM and a plan" },
  { key: "handoffs_14", label: "Handoffs in the next 14 days", tone: "teal", clear: "No handoff in the next 14 days" },
];
export const ALL_TILES = [...TEAM_TILES, ...LEAD_TILES];
export const tileLabel = (key: TileKey) => ALL_TILES.find((t) => t.key === key)?.label ?? "";

export type Viewer = { userId: string | null; isAdmin: boolean; isDirector: boolean };
/** Admin and the Director of Onboarding lead; never view only. */
export const isLead = (v: Pick<Viewer, "isAdmin" | "isDirector">) => v.isAdmin || v.isDirector;

/** 1.2: the Director and Admin get the lead tiles; the Project Manager, Designer and Utilities the team tiles. */
export function tilesFor(v: Viewer) {
  return isLead(v) ? LEAD_TILES : TEAM_TILES;
}

const inDays = (today: string, date: string | null, from: number, to: number) => {
  if (!date) return false;
  const d = daysBetween(today, date);
  return d >= from && d <= to;
};

/** The missing pieces of a home's setup (1.2 Missing setup). */
export function missingSetup(row: Pick<HomeRow, "team" | "closed" | "committedOn" | "lifecycle">): string[] {
  if (row.lifecycle !== "active") return [];
  const out: string[] = [];
  if (!row.team.pm) out.push("PM");
  if (!row.team.designer) out.push("Designer");
  if (!row.team.utilities) out.push("Utilities");
  if (row.closed && !row.committedOn) out.push("committed handoff date");
  return out;
}

/** Whether one active home belongs on a tile (not used for Not in Resolve yet, which lists OwnerRez homes). */
export function tileMatches(key: TileKey, row: HomeRow, today: string): boolean {
  if (row.lifecycle !== "active" && row.lifecycle !== "upcoming") return false;
  switch (key) {
    case "late_mine":
      return row.lateMine > 0;
    case "owners_waiting":
      return row.onTeam && row.ownerWaiting > 0;
    case "due_week":
      return row.dueWeekMine > 0;
    case "next_handoff":
      return row.onTeam && row.lifecycle === "active" && inDays(today, row.handoffOn, 0, 100000);
    case "behind":
      return row.lifecycle === "active" && row.schedule.behind;
    case "missing_setup":
      return missingSetup(row).length > 0;
    case "not_in_resolve":
      return false;
    case "closing_no_pm":
      return inDays(today, row.closingOn, 0, 30) && (!row.team.pm || !row.hasPlan);
    case "handoffs_14":
      return row.lifecycle === "active" && inDays(today, row.handoffOn, 0, 14);
  }
}

export type TileValue = { key: TileKey; count: number; value: string; line: string; clear: boolean };

/** Each tile's large number and one line of detail, from the same rows the list shows. */
export function tileValue(key: TileKey, rows: HomeRow[], ownerRez: OwnerRezRow[], today: string): TileValue {
  const def = ALL_TILES.find((t) => t.key === key)!;
  const hits = rows.filter((r) => tileMatches(key, r, today));
  const homes = (n: number) => `${n} home${n === 1 ? "" : "s"}`;
  const sum = (f: (r: HomeRow) => number) => hits.reduce((n, r) => n + f(r), 0);
  const done = (count: number, line: string): TileValue =>
    count === 0 ? { key, count, value: "All clear", line: def.clear, clear: true } : { key, count, value: String(count), line, clear: false };
  switch (key) {
    case "late_mine": {
      const n = sum((r) => r.lateMine);
      return done(n, `Open Tasks past due on ${homes(hits.length)}`);
    }
    case "owners_waiting": {
      const n = sum((r) => r.ownerWaiting);
      return done(n, `Owner replies on ${homes(hits.length)}`);
    }
    case "due_week": {
      const n = sum((r) => r.dueWeekMine);
      return done(n, `Your Tasks due in the next 7 days`);
    }
    case "next_handoff": {
      const next = [...hits].sort((a, b) => (a.handoffOn ?? "").localeCompare(b.handoffOn ?? ""))[0];
      if (!next || !next.handoffOn) return done(0, "");
      const d = daysBetween(today, next.handoffOn);
      return { key, count: d, value: d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"}`, line: `${next.name} · ${shortDate(next.handoffOn)}`, clear: false };
    }
    case "behind":
      return done(hits.length, "Late Tasks or a slipped handoff");
    case "missing_setup":
      return done(hits.length, "No PM, Designer, Utilities or committed date");
    case "not_in_resolve":
      return done(ownerRez.length, "In OwnerRez with no onboarding project");
    case "closing_no_pm":
      return done(hits.length, "Closing in the next 30 days");
    case "handoffs_14":
      return done(hits.length, "Committed, else estimated");
  }
}

/* --------------------------------------------- reason line and opening */

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** 1.4 / 2.3: why the row is on the list under a tile; with no tile, what waits on the viewer. */
export function reasonLine(row: HomeRow, tile: TileKey | null, today: string): string | null {
  switch (tile) {
    case "late_mine":
      return row.lateMine ? `${plural(row.lateMine, "late Task")} on your home` : null;
    case "owners_waiting":
      return row.ownerWaiting ? plural(row.ownerWaiting, "owner reply") : null;
    case "due_week":
      return row.dueWeekMine ? `${plural(row.dueWeekMine, "Task")} due this week` : null;
    case "next_handoff":
    case "handoffs_14":
      return row.handoffOn
        ? `Handoff ${shortDate(row.handoffOn)}${row.committedOn ? "" : " (est.)"}${daysBetween(today, row.handoffOn) === 0 ? " · today" : ` · in ${plural(daysBetween(today, row.handoffOn), "day")}`}`
        : null;
    case "behind":
      return row.schedule.behind ? row.schedule.label : null;
    case "missing_setup": {
      const m = missingSetup(row);
      return m.length ? `Missing: ${m.join(", ")}` : null;
    }
    case "closing_no_pm":
      return row.closingOn ? `Closes ${shortDate(row.closingOn)} · ${[!row.team.pm ? "no PM" : null, !row.hasPlan ? "no plan" : null].filter(Boolean).join(", ")}` : null;
    default: {
      const parts: string[] = [];
      if (row.onTeam && row.ownerWaiting) parts.push(plural(row.ownerWaiting, "owner reply"));
      if (row.lateMine) parts.push("Late Tasks on your home");
      return parts.length ? parts.join(" · ") : null;
    }
  }
}

export type OpenAt = { tab?: "tasks" | "owner"; show?: "late"; stage?: "6"; at?: "needs" };
/** 1.4: a row opens the home at the place the active tile points to; anything else opens Overview. */
export function openAtFor(tile: TileKey | null): OpenAt {
  if (tile === "late_mine") return { tab: "tasks", show: "late" };
  if (tile === "owners_waiting") return { tab: "owner", at: "needs" };
  if (tile === "next_handoff" || tile === "handoffs_14") return { tab: "tasks", stage: "6" };
  return {};
}

/* ------------------------------------------------------------- My homes */

export type Scope = "my" | "all";
/** 1.3: My homes = PM, Designer or Utilities on the home, plus homes added with Add to my homes. */
export const isMine = (row: Pick<HomeRow, "onTeam" | "followed">) => row.onTeam || row.followed;
/** PMs, Designers and Utilities open on My homes; the Director and Admin on All homes. */
export const defaultScope = (v: Pick<Viewer, "isAdmin" | "isDirector">): Scope => (isLead(v) ? "all" : "my");

/** 3.3: a home opens view only for someone who is not Admin, the Director or on its team. */
export function viewOnlyFor(v: Pick<Viewer, "isAdmin" | "isDirector">, onTeam: boolean): boolean {
  return !isLead(v) && !onTeam;
}

/** Which team roles the viewer holds on a home. */
export function viewerRoles(team: HomeRow["team"], userId: string | null): TeamRole[] {
  if (!userId) return [];
  const out: TeamRole[] = [];
  if (team.pm?.id === userId) out.push("pm");
  if (team.designer?.id === userId) out.push("designer");
  if (team.utilities?.id === userId) out.push("utilities");
  return out;
}

/* -------------------------------------------------------------- filters */

export const FILTER_KEYS = [
  "owner",
  "sched",
  "pm",
  "status",
  "market",
  "invoice",
  "fscope",
  "util",
  "hoa",
  "bz",
  "designer",
  "stager",
  "label",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;
export const NONE = "none";

export const FILTER_LABELS: Record<FilterKey, string> = {
  owner: "Owner type",
  sched: "Schedule",
  pm: "PM",
  status: "Status",
  market: "Market",
  invoice: "Invoice status",
  fscope: "Scope",
  util: "Utility option",
  hoa: "HOA",
  bz: "Breezeway connected",
  designer: "Designer",
  stager: "Stager",
  label: "Labels",
};
/** The filters behind More filters. */
export const MORE_FILTERS: FilterKey[] = ["fscope", "util", "hoa", "bz", "designer", "stager", "label"];

const ownerTypeOf = (r: HomeRow) => r.ownerType ?? (r.activeOwner ? "Active Owner" : null);

/** The value a filter reads from a row (people and vendors by id; "none" when empty). */
export function filterValue(key: FilterKey, r: HomeRow): string[] {
  const v = (x: string | null | undefined) => [x && x.trim() ? x : NONE];
  switch (key) {
    case "owner":
      return v(ownerTypeOf(r));
    case "sched":
      return [r.schedule.behind ? "behind" : "on_track"];
    case "pm":
      return v(r.team.pm?.id);
    case "status":
      return v(r.status);
    case "market":
      return v(r.market);
    case "invoice":
      return v(r.invoiceStatus);
    case "fscope":
      return v(r.scope);
    case "util":
      return v(r.utilityOption);
    case "hoa":
      return [r.hoa ? "yes" : "no"];
    case "bz":
      return [r.breezeway ? "yes" : "no"];
    case "designer":
      return v(r.team.designer?.id);
    case "stager":
      return r.team.stagers.length ? r.team.stagers.map((s) => s.id) : [NONE];
    case "label":
      return r.labels.length ? r.labels : [NONE];
  }
}

/** Every option a filter offers, from the rows (only values in use), with its words. */
export function filterOptions(key: FilterKey, rows: HomeRow[]): { value: string; label: string }[] {
  const seen = new Map<string, string>();
  const name = (value: string, r: HomeRow): string => {
    if (value === NONE) return "None";
    if (key === "sched") return value === "behind" ? "Behind" : "On track";
    if (key === "hoa" || key === "bz") return value === "yes" ? "Yes" : "No";
    if (key === "pm") return r.team.pm?.name ?? value;
    if (key === "designer") return r.team.designer?.name ?? value;
    if (key === "stager") return r.team.stagers.find((s) => s.id === value)?.name ?? value;
    return value;
  };
  for (const r of rows) for (const value of filterValue(key, r)) if (!seen.has(value)) seen.set(value, name(value, r));
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => (a.value === NONE ? 1 : b.value === NONE ? -1 : a.label.localeCompare(b.label)));
}

export function applyFilters(rows: HomeRow[], filters: Filters): HomeRow[] {
  const on = FILTER_KEYS.filter((k) => filters[k]);
  return rows.filter((r) => on.every((k) => filterValue(k, r).includes(filters[k]!)));
}

export const anyFilter = (filters: Filters) => FILTER_KEYS.some((k) => Boolean(filters[k]));

/** Search: address, owner or PM. */
export function matchesSearch(r: HomeRow, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [r.name, r.place, r.ownerName, r.team.pm?.name].some((x) => (x ?? "").toLowerCase().includes(t));
}

/* ------------------------------------------------------------- the list */

export type ListInput = {
  rows: HomeRow[];
  tab: HomeTab;
  scope: Scope;
  tile: TileKey | null;
  q: string;
  filters: Filters;
  today: string;
};

/** The rows the current tab, switch, tile, search and filters show. */
export function visibleRows(i: ListInput): HomeRow[] {
  let rows = i.rows.filter((r) => tabFor(r) === i.tab);
  if (i.tab === "active" && i.scope === "my") rows = rows.filter(isMine);
  if (i.tile && i.tab === "active") rows = rows.filter((r) => tileMatches(i.tile!, r, i.today));
  rows = applyFilters(rows, i.filters).filter((r) => matchesSearch(r, i.q));
  return i.tab === "all" ? [...rows].sort(pastOrder) : rows;
}

/** 1.4: "Also in past projects: N" when the search finds homes in the other tab. */
export function otherTabMatches(rows: HomeRow[], tab: HomeTab, q: string): number {
  if (!q.trim()) return 0;
  const other: HomeTab = tab === "active" ? "all" : "active";
  return rows.filter((r) => tabFor(r) === other && matchesSearch(r, q)).length;
}

/** The counts on the My homes / All homes switch (active tab). */
export function scopeCounts(rows: HomeRow[]) {
  const active = rows.filter((r) => tabFor(r) === "active");
  return { my: active.filter(isMine).length, all: active.length };
}

/** 2.3: grouped by phase, in phase order, empty groups left out. */
export function groupByPhase(rows: HomeRow[]): { phase: Phase; label: string; rows: HomeRow[] }[] {
  return PHASES.map((p) => ({ phase: p.value, label: p.label, rows: rows.filter((r) => phaseFor(r) === p.value) })).filter(
    (g) => g.rows.length > 0,
  );
}

/** 2.4 By status: one column per Notion status in plan order, only statuses in use. */
export function statusColumns(rows: HomeRow[]): { status: string; rows: HomeRow[] }[] {
  const order: string[] = [...NOTION_STATUSES];
  const cols = order.map((status) => ({ status, rows: rows.filter((r) => r.status === status) })).filter((c) => c.rows.length > 0);
  const unset = rows.filter((r) => !r.status || !order.includes(r.status));
  return unset.length ? [...cols, { status: "No status yet", rows: unset }] : cols;
}

/** 2.4 Workload: active homes per Project Manager and per Stager; a bar turns coral at 4 or more. */
export const WORKLOAD_FULL_AT = 4;
export function workloadLists(rows: HomeRow[]) {
  const active = rows.filter((r) => r.lifecycle === "active");
  const count = (people: (r: HomeRow) => Person[]) => {
    const m = new Map<string, { name: string; homes: number }>();
    for (const r of active)
      for (const p of people(r)) m.set(p.id, { name: p.name, homes: (m.get(p.id)?.homes ?? 0) + 1 });
    return [...m.values()]
      .map((x) => ({ ...x, full: x.homes >= WORKLOAD_FULL_AT }))
      .sort((a, b) => b.homes - a.homes || a.name.localeCompare(b.name));
  };
  return {
    pms: count((r) => (r.team.pm ? [r.team.pm] : [])),
    stagers: count((r) => r.team.stagers),
  };
}

/* ------------------------------------------------------------- columns */

export const OPTIONAL_COLUMNS = [
  { key: "possession", label: "Possession" },
  { key: "owner", label: "Owner" },
  { key: "market", label: "Market" },
  { key: "scope", label: "Scope" },
  { key: "utility", label: "Utility option" },
  { key: "hoa", label: "HOA" },
  { key: "committed", label: "Committed handoff" },
  { key: "breezeway", label: "Breezeway connected" },
] as const;
export type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["key"];

export function optionalCell(key: OptionalColumn, r: HomeRow): string {
  switch (key) {
    case "possession":
      return r.possessionOn ? shortDate(r.possessionOn) : "";
    case "owner":
      return r.ownerName ?? "";
    case "market":
      return r.market ?? "";
    case "scope":
      return r.scope ?? "";
    case "utility":
      return r.utilityOption ?? "";
    case "hoa":
      return r.hoa ? "Yes" : "No";
    case "committed":
      return r.committedOn ? shortDate(r.committedOn) : "";
    case "breezeway":
      return r.breezeway ? "Yes" : "No";
  }
}

/* ----------------------------------------------------------------- CSV */

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Download CSV: the rows and columns shown. */
export function homesCsv(rows: HomeRow[], columns: OptionalColumn[]): string {
  const head = ["Home", "Place", "Status", "Invoice", "Closing", "Handoff", "Handoff committed", "PM", "Designer", "Utilities", "Stager", "Schedule"];
  const extra = OPTIONAL_COLUMNS.filter((c) => columns.includes(c.key));
  const lines = [[...head, ...extra.map((c) => c.label)].map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.place,
        r.status ?? "",
        r.invoiceStatus ?? "",
        r.closingOn ?? "",
        r.handoffOn ?? "",
        r.committedOn ? "Yes" : "No",
        r.team.pm?.name ?? "",
        r.team.designer?.name ?? "",
        r.team.utilities?.name ?? "",
        r.team.stagers.map((s) => s.name).join("; "),
        r.schedule.label,
        ...extra.map((c) => optionalCell(c.key, r)),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------- the address (1.4) */

export const HOME_VIEWS = [
  { value: "table", label: "Table" },
  { value: "gallery", label: "Gallery" },
  { value: "status", label: "By status" },
  { value: "gantt", label: "Gantt" },
  { value: "workload", label: "Workload" },
] as const;
export type HomeView = (typeof HOME_VIEWS)[number]["value"];

export type HomeSearch = {
  tab?: HomeTab | undefined;
  scope?: Scope | undefined;
  tile?: TileKey | undefined;
  view?: HomeView | undefined;
  q?: string | undefined;
  /** Test and demo homes are hidden unless asked for, as before. */
  showTest?: boolean | undefined;
} & { [K in FilterKey]?: string | undefined };

/** Reads the address. Older links keep working: ?lens=all opens past projects, ?view=active the table. */
export function parseHomeSearch(raw: Record<string, unknown>): HomeSearch {
  const out: HomeSearch = {};
  const str = (k: string) => (typeof raw[k] === "string" && (raw[k] as string).trim() ? (raw[k] as string) : undefined);
  const tab = str("tab");
  if (tab === "active" || tab === "all") out.tab = tab;
  else if (str("lens") === "all") out.tab = "all";
  const scope = str("scope");
  if (scope === "my" || scope === "all") out.scope = scope;
  const tile = str("tile");
  if (tile && ALL_TILES.some((t) => t.key === tile)) out.tile = tile as TileKey;
  const view = str("view");
  if (view && HOME_VIEWS.some((v) => v.value === view)) out.view = view as HomeView;
  else if (view === "active") out.view = "table";
  const q = str("q") ?? str("find");
  if (q) out.q = q.slice(0, 120);
  if (raw["showTest"] === true || raw["showTest"] === "true") out.showTest = true;
  for (const k of FILTER_KEYS) {
    const v = str(k);
    if (v) out[k] = v.slice(0, 120);
  }
  return out;
}

export const filtersOf = (s: HomeSearch): Filters => {
  const f: Filters = {};
  for (const k of FILTER_KEYS) if (s[k]) f[k] = s[k];
  return f;
};

/** 1.2: a tile click switches to Active projects and the Table view; the same tile again clears it. */
export function tileClick(s: HomeSearch, key: TileKey): HomeSearch {
  if (s.tile === key) return { ...s, tile: undefined };
  return { ...s, tile: key, tab: "active", view: "table" };
}

/** Clear filters: tile, search and every filter go; tab, switch and view stay. */
export function clearAll(s: HomeSearch): HomeSearch {
  return { tab: s.tab, scope: s.scope, view: s.view, showTest: s.showTest };
}

/* ------------------------------------------------------- saved views */

export type SavedView = { id: string; name: string; filters: Filters & { q?: string; tab?: HomeTab; scope?: Scope; tile?: TileKey }; view: HomeView; sort: string | null };

/** What Save this view keeps: the filters, view and sort (the tab, switch, tile and search ride with the filters). */
export function viewToSave(s: HomeSearch): Omit<SavedView, "id" | "name"> {
  const f: SavedView["filters"] = { ...filtersOf(s) };
  if (s.q) f.q = s.q;
  if (s.tab) f.tab = s.tab;
  if (s.scope) f.scope = s.scope;
  if (s.tile) f.tile = s.tile;
  return { filters: f, view: s.view ?? "table", sort: "phase" };
}

export function searchFromSaved(v: Pick<SavedView, "filters" | "view">): HomeSearch {
  return parseHomeSearch({ ...v.filters, view: v.view });
}

/* --------------------------------------------------------------- access */

/**
 * 3.3: Contract fell through, Under contract, Not an onboarding home, the Designer and Stager pickers
 * and list assignment. Add a home (including Upcoming) is the onboarding team's: canAddHome.
 */
export const LEAD_ONLY_REFUSAL = "Only the Director of Onboarding or an Admin can do this.";
export function mayManageHomes(v: Pick<Viewer, "isAdmin" | "isDirector">, readOnly = false): boolean {
  return !readOnly && isLead(v);
}

/** The greeting, by the hour in Central time. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const TAGLINE = "Keys to kickoff. Set it up right. Hand it off proud.";
