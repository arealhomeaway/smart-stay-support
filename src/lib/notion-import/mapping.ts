/**
 * Notion "Maintenance Ticket Management" -> Resolve ticket mapping.
 * Pure and browser-safe. Every rule here is one of Emily's approved import
 * decisions (Nov 4 and Nov 8, 2026). The runner, the dry run and the sample
 * all use these same functions, so what the sample shows is what gets written.
 */

export const NOTION_TICKET_DATA_SOURCE_ID = "1b94658d-5f4f-8088-9562-000b4d5b6bdc";
/** Temporary Ticket Management is excluded entirely. */
export const EXCLUDED_DATA_SOURCE_IDS = ["31a4658d-5f4f-82d8-b6dd-0760bcdc2843"];
/** A former home that stays unlinked on purpose. */
export const FORMER_PROPERTY_OWNERREZ: Record<string, string> = { "410153": "21036 Owens Rd" };
export const RECENT_DAYS = 30;
/** Kept for older callers. */
export const SCOPE_DAYS = RECENT_DAYS;

export type NotionProp = {
  type: string;
  title?: unknown;
  rich_text?: unknown;
  status?: unknown;
  select?: unknown;
  number?: unknown;
  date?: unknown;
  people?: unknown;
  relation?: unknown;
};
export type NotionPage = {
  id: string;
  url?: string;
  created_time: string;
  last_edited_time: string;
  archived?: boolean;
  in_trash?: boolean;
  properties: Record<string, NotionProp>;
};

/** Active Resolve staff with a login. The server builds this list; removed and archived people are left out. */
export type StaffUser = { id: string; full_name: string | null; email?: string | null };

/** The three import groups. */
export type ImportGroup = "closed" | "recent_open" | "older_open";
export const IMPORT_GROUPS: ImportGroup[] = ["recent_open", "older_open", "closed"];
export const IMPORT_GROUP_LABELS: Record<ImportGroup, string> = {
  recent_open: "Open, past 30 days",
  older_open: "Open, older",
  closed: "Closed history",
};

export type TeamGroup = "team_a" | "team_b" | "unassigned";

export type AssigneeReason =
  | "matched"
  | "director"
  | "general"
  | "blank"
  | "no_login"
  | "not_unique"
  | "not_recent"
  | "needs_home";
export const ASSIGNEE_REASON_LABELS: Record<AssigneeReason, string> = {
  matched: "Assigned to a matching Resolve login",
  director: "Director of Operations, left unassigned",
  general: "General, left unassigned",
  blank: "No assignee in Notion",
  no_login: "No Resolve login with that exact name",
  not_unique: "More than one Resolve login with that name",
  not_recent: "Not open in the past 30 days, no assignee",
  needs_home: "Needs a home, left unassigned",
};

export type MappedTicket = {
  external_id: string;
  external_url: string | null;
  external_status: string;
  external_synced_at: string;
  title: string;
  description: string;
  priority: "p1" | "p2" | "p3";
  status: "in_progress" | "closed";
  property_id: string | null;
  assigned_to: string | null;
  assignment_note: string | null;
  reported_at: string;
  due_at: string | null;
  resolved_at: string | null;
  breezeway_task_url: string | null;
  waiting_on: string | null;
  waiting_reason: string | null;
  import_hold: "backlog_review" | "needs_home" | null;
  claim: { stage: "potential" | "gathering"; estimated_amount: number | null; recovered_amount: number | null; notes: string } | null;
};

export type MapOutcome = {
  ticket: MappedTicket;
  group: ImportGroup;
  /** The Notion assignee text, kept on every ticket. */
  notionAssignee: string | null;
  assigneeReason: AssigneeReason;
  missingLogin: string | null;
  teamGroup: TeamGroup | null;
  homeOwnerRezId: string | null;
  formerProperty: string | null;
  multipleHomes: boolean;
  blankCreatedDate: boolean;
};

// ---------- property readers ----------
function prop(page: NotionPage, name: string): NotionProp | undefined {
  if (page.properties[name]) return page.properties[name];
  const want = name.trim().toLowerCase();
  const key = Object.keys(page.properties).find((k) => k.trim().toLowerCase().startsWith(want));
  return key ? page.properties[key] : undefined;
}
const richText = (arr: unknown): string =>
  Array.isArray(arr) ? arr.map((t) => (t as { plain_text?: string }).plain_text ?? "").join("") : "";
export function text(page: NotionPage, name: string): string {
  const p = prop(page, name);
  if (!p) return "";
  if (p.type === "title") return richText(p.title).trim();
  if (p.type === "rich_text") return richText(p.rich_text).trim();
  return "";
}
export function select(page: NotionPage, name: string): string | null {
  const p = prop(page, name);
  if (!p) return null;
  const v = (p.type === "status" ? p.status : p.type === "select" ? p.select : null) as { name?: string } | null;
  return v?.name?.trim() || null;
}
export function num(page: NotionPage, name: string): number | null {
  const p = prop(page, name);
  return p && p.type === "number" && typeof p.number === "number" ? p.number : null;
}
export function date(page: NotionPage, name: string): string | null {
  const p = prop(page, name);
  const d = p && p.type === "date" ? (p.date as { start?: string } | null) : null;
  return d?.start ?? null;
}
export function people(page: NotionPage, name: string): string[] {
  const p = prop(page, name);
  if (!p || p.type !== "people" || !Array.isArray(p.people)) return [];
  return (p.people as { name?: string }[]).map((x) => x.name ?? "").filter(Boolean);
}
export function relationIds(page: NotionPage, name: string): string[] {
  const p = prop(page, name);
  if (!p || p.type !== "relation" || !Array.isArray(p.relation)) return [];
  return (p.relation as { id: string }[]).map((r) => r.id);
}

// ---------- rules ----------
/** Urgent -> P1, High -> P2, Medium / Low / blank -> P3. */
export function mapPriority(v: string | null): "p1" | "p2" | "p3" {
  const k = (v ?? "").trim().toLowerCase();
  if (k === "urgent") return "p1";
  if (k === "high") return "p2";
  return "p3";
}

/**
 * The Notion claim status starts with "Pending Claim Review" and then names a
 * person. It is matched by that start so no name lives in code, and it is shown
 * on screens only as "Claim review".
 */
export const CLAIM_REVIEW_PREFIX = "Pending Claim Review";
export function isClaimReviewStatus(v: string | null | undefined): boolean {
  return /^\s*pending\s+claim\s+review\b/i.test(v ?? "");
}
export const CLOSED_NOTION_STATUSES = ["Done", "Completed Same Day"];
export function isClosedNotionStatus(v: string | null | undefined): boolean {
  return CLOSED_NOTION_STATUSES.includes((v ?? "").trim());
}
export function mapStatus(v: string | null): { status: "in_progress" | "closed"; waitingOnClaimReview: boolean } {
  if (isClaimReviewStatus(v)) return { status: "in_progress", waitingOnClaimReview: true };
  if (isClosedNotionStatus(v)) return { status: "closed", waitingOnClaimReview: false };
  return { status: "in_progress", waitingOnClaimReview: false };
}

/** The 30 day line for a run. Fixed when the run starts so a resume uses the same line. */
export function recentCutoff(now: number = Date.now()): number {
  return now - RECENT_DAYS * 86_400_000;
}

/** The Notion "Created Date". Never the last edit and never the page copy time. */
export function notionCreatedDate(page: NotionPage): string | null {
  const d = date(page, "Created Date");
  return d && Number.isFinite(Date.parse(d)) ? d : null;
}

/**
 * Rule 1 and 2: closed (any age), open and created in the past 30 days, or open
 * and older. A blank created date is always older, never recent.
 */
export function importGroup(page: NotionPage, cutoff: number): ImportGroup {
  if (isClosedNotionStatus(select(page, "Issue Status"))) return "closed";
  const created = notionCreatedDate(page);
  if (!created) return "older_open";
  return Date.parse(created) >= cutoff ? "recent_open" : "older_open";
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Rule 3. A person is assigned only on an exact name match (extra spaces and
 * capital letters aside) with exactly one active Resolve staff member who has a
 * login. The Director of Operations, "General" and blank stay unassigned. A
 * login is never created.
 */
export function resolveAssignee(
  name: string | null,
  staff: StaffUser[],
  directorIds: ReadonlySet<string> = new Set(),
): { userId: string | null; reason: AssigneeReason; missingLogin: string | null } {
  const n = norm(name);
  if (!n) return { userId: null, reason: "blank", missingLogin: null };
  if (n === "general") return { userId: null, reason: "general", missingLogin: null };
  const hits = staff.filter((s) => norm(s.full_name) === n);
  if (hits.length > 1) return { userId: null, reason: "not_unique", missingLogin: null };
  const hit = hits[0];
  if (!hit) return { userId: null, reason: "no_login", missingLogin: name!.trim() };
  if (directorIds.has(hit.id)) return { userId: null, reason: "director", missingLogin: null };
  return { userId: hit.id, reason: "matched", missingLogin: null };
}

/**
 * Rule 4 and 7, used by the runner and by the Team Queue group. Needs a home is
 * Unassigned. An open claim goes to Team B. Otherwise the assigned person's team;
 * no person is Unassigned.
 */
export function importTeamGroup(
  t: { assigned_to: string | null; needs_home: boolean; has_claim: boolean },
  homeTeamOf: (userId: string | null) => string | null,
): TeamGroup {
  if (t.needs_home) return "unassigned";
  if (t.has_claim) return "team_b";
  if (!t.assigned_to) return "unassigned";
  const team = homeTeamOf(t.assigned_to);
  if (team === "guest_experience") return "team_a";
  if (team === "property_operations") return "team_b";
  return "unassigned";
}

/** Notion writes "ORP123456", Resolve stores "123456". */
export function normalizeOwnerRezId(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().replace(/^ORP/i, "");
  return /^\d+$/.test(s) ? s : null;
}

const money = (n: number | null) => (n == null ? "blank" : `$${n.toFixed(2)}`);

/** Rule 6: a claim when "Will this be a claim?" is Yes or the status is the claim review status. */
export function wantsClaim(page: NotionPage): boolean {
  return select(page, "Will this be a claim?") === "Yes" || isClaimReviewStatus(select(page, "Issue Status"));
}
/** Written into an imported claim's notes; the claim stage label reads it. */
export const CLAIM_REVIEW_NOTE_LINE = "Notion status: Claim review";

export type MapContext = {
  staff: StaffUser[];
  directorIds?: ReadonlySet<string>;
  homeTeamOf?: (userId: string | null) => string | null;
  /** Notion PID page id -> OwnerRez ID text from that page. */
  pidOwnerRez: Map<string, string | null>;
  /** OwnerRez ID -> Resolve property id. */
  propertyByOwnerRez: Map<string, string>;
  homeLabel?: string | null;
  /** Start of the 30 day window, fixed per run. */
  cutoff?: number;
};

export function mapNotionPage(page: NotionPage, ctx: MapContext): MapOutcome {
  const cutoff = ctx.cutoff ?? recentCutoff();
  const statusName = select(page, "Issue Status") ?? "In progress";
  const { status, waitingOnClaimReview } = mapStatus(statusName);
  const group = importGroup(page, cutoff);
  const createdDate = notionCreatedDate(page);

  // Rule 7: home by ID only.
  const pids = relationIds(page, "Property Address");
  let propertyId: string | null = null;
  let homeOwnerRezId: string | null = null;
  for (const pid of pids) {
    const orz = normalizeOwnerRezId(ctx.pidOwnerRez.get(pid));
    if (orz && !homeOwnerRezId) homeOwnerRezId = orz;
    if (orz && FORMER_PROPERTY_OWNERREZ[orz]) continue;
    if (orz && ctx.propertyByOwnerRez.has(orz)) {
      propertyId = ctx.propertyByOwnerRez.get(orz)!;
      homeOwnerRezId = orz;
      break;
    }
  }
  const formerProperty = !propertyId && homeOwnerRezId ? FORMER_PROPERTY_OWNERREZ[homeOwnerRezId] ?? null : null;
  const needsHome = !propertyId;

  // Rule 3: the Notion assignee is kept as text always; a person only for group (b).
  const notionAssignee = select(page, "Assignee");
  const match = resolveAssignee(notionAssignee, ctx.staff, ctx.directorIds);
  let assignedTo: string | null = null;
  let assigneeReason: AssigneeReason = match.reason;
  if (group !== "recent_open") {
    if (match.reason === "matched") assigneeReason = "not_recent";
  } else if (needsHome) {
    if (match.reason === "matched") assigneeReason = "needs_home";
  } else {
    assignedTo = match.userId;
  }

  const claimWanted = wantsClaim(page);
  const teamGroup =
    group === "recent_open"
      ? importTeamGroup({ assigned_to: assignedTo, needs_home: needsHome, has_claim: claimWanted }, ctx.homeTeamOf ?? (() => null))
      : null;

  // Rule 2: older open stays out of the queue (Backlog review); no home is Needs a home.
  // A blank created date whose page was made in the past 30 days is held as
  // Backlog review so it can never look recent.
  const blankRecentPage = !createdDate && Date.parse(page.created_time) >= cutoff;
  let importHold: MappedTicket["import_hold"] = null;
  if (status !== "closed" && blankRecentPage) importHold = "backlog_review";
  else if (needsHome) importHold = "needs_home";
  else if (group === "older_open") importHold = "backlog_review";

  const rawTitle = text(page, "Issue Description");
  const title = rawTitle || `Imported Notion ticket${ctx.homeLabel ? `: ${ctx.homeLabel}` : ""}`;

  // Unmapped fields go in one "Imported from Notion" block.
  const block: string[] = ["Imported from Notion"];
  if (formerProperty) block.push(`Former property: ${formerProperty}`);
  if (needsHome) block.push("Needs a home");
  const submittedBy = select(page, "Submitted by");
  if (submittedBy) block.push(`Submitted by: ${submittedBy}`);
  const market = select(page, "Market");
  if (market) block.push(`Market: ${market}`);
  const completedBy = people(page, "Completed by");
  if (completedBy.length) block.push(`Completed by: ${completedBy.join(", ")}`);
  const guestInformed = select(page, "Guest Informed?");
  if (guestInformed) block.push(`Guest informed: ${guestInformed}`);
  if (pids.length > 1) block.push("Linked to more than one home in Notion. Please check the home.");
  if (notionAssignee && notionAssignee.trim().toLowerCase() !== "general") block.push(`Assigned in Notion to: ${notionAssignee.trim()}`);
  if (!createdDate) block.push("Created date in Notion: blank");
  block.push(`Notion status: ${isClaimReviewStatus(statusName) ? "Claim review" : statusName}`);
  if (page.url) block.push(`Notion page: ${page.url}`);
  const notes = text(page, "Notes");
  const description = [notes, block.join("\n")].filter(Boolean).join("\n\n");

  let claim: MappedTicket["claim"] = null;
  if (claimWanted) {
    const filed = select(page, "Claim Filed?");
    const lines = [
      "Imported from Notion",
      ...(isClaimReviewStatus(statusName) ? [CLAIM_REVIEW_NOTE_LINE] : []),
      `Will this be a claim in Notion: ${select(page, "Will this be a claim?") ?? "blank"}`,
      `Claim filed in Notion: ${filed ?? "blank"}`,
      `Is the claim less than $75: ${select(page, "Is the claim less than $75?") ?? "blank"}`,
      `Management/Operational Fee: ${money(num(page, "Management/Operational Fee"))}`,
      `Total damages: ${money(num(page, "Total Damages"))}`,
      `Reimbursed amount: ${money(num(page, "Reimbursed Amount"))}`,
    ];
    claim = {
      // Submitted stages need proof of submission in Resolve, so a filed claim lands in Gathering.
      stage: filed === "Yes" ? "gathering" : "potential",
      estimated_amount: num(page, "Total Damages"),
      recovered_amount: num(page, "Reimbursed Amount"),
      notes: lines.join("\n"),
    };
  }

  const completed = date(page, "Date Completed");
  return {
    ticket: {
      external_id: page.id,
      external_url: page.url ?? null,
      external_status: statusName,
      external_synced_at: page.last_edited_time,
      title,
      description,
      priority: mapPriority(select(page, "Priority")),
      status,
      property_id: propertyId,
      assigned_to: assignedTo,
      assignment_note: assignedTo ? "Matched the Notion assignee at import" : null,
      // A blank created date keeps the Notion page time; the hold above keeps it out of recent.
      reported_at: createdDate ?? page.created_time,
      due_at: date(page, "Due Date"),
      resolved_at: status === "closed" ? completed ?? page.last_edited_time : null,
      breezeway_task_url: text(page, "Breezeway Link") || null,
      waiting_on: waitingOnClaimReview ? "other" : null,
      waiting_reason: waitingOnClaimReview ? "claim review" : null,
      import_hold: importHold,
      claim,
    },
    group,
    notionAssignee,
    assigneeReason,
    missingLogin: match.missingLogin,
    teamGroup,
    homeOwnerRezId,
    formerProperty,
    multipleHomes: pids.length > 1,
    blankCreatedDate: !createdDate,
  };
}

/** Notion comment -> read-only history row. */
export function mapComment(c: { id: string; created_time: string; created_by?: { name?: string }; rich_text?: unknown; display_name?: { resolved_name?: string } }, authorName?: string | null) {
  return {
    external_id: c.id,
    created_at: c.created_time,
    author: authorName || c.display_name?.resolved_name || c.created_by?.name || "Unknown Notion user",
    body: richText(c.rich_text),
  };
}

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
}
