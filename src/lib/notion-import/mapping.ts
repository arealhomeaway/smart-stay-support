/**
 * Notion "Maintenance Ticket Management" -> Resolve ticket mapping.
 * Pure and browser-safe. Every rule here is one of Emily's approved import
 * decisions (docs/pending/notion-ticket-import-dry-run.md).
 */

export const NOTION_TICKET_DATA_SOURCE_ID = "1b94658d-5f4f-8088-9562-000b4d5b6bdc";
/** Temporary Ticket Management is excluded entirely. */
export const EXCLUDED_DATA_SOURCE_IDS = ["31a4658d-5f4f-82d8-b6dd-0760bcdc2843"];
export const FORMER_PROPERTY_OWNERREZ: Record<string, string> = { "410153": "21036 Owens Rd" };
export const SCOPE_DAYS = 30;
export const BACKLOG_BEFORE_YEAR = 2026;

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

export type StaffUser = { id: string; full_name: string | null; email: string | null };

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
  missingLogin: string | null;
  homeOwnerRezId: string | null;
  formerProperty: string | null;
  multipleHomes: boolean;
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

/** The Notion claim status, matched exactly. Shown on screens only as "Claim review". */
export const NOTION_CLAIM_REVIEW_STATUS = "Pending Claim Review with Josh";
export const OPEN_NOTION_STATUSES = ["In progress", NOTION_CLAIM_REVIEW_STATUS];
export function mapStatus(v: string | null): { status: "in_progress" | "closed"; waitingOnClaimReview: boolean } {
  if (v === NOTION_CLAIM_REVIEW_STATUS) return { status: "in_progress", waitingOnClaimReview: true };
  if (v === "Done" || v === "Completed Same Day") return { status: "closed", waitingOnClaimReview: false };
  return { status: "in_progress", waitingOnClaimReview: false };
}

/** Open now, or created/edited in the last 30 days. */
export function inScope(page: NotionPage, now = Date.now()): boolean {
  if (page.archived || page.in_trash) return false;
  const status = select(page, "Issue Status");
  if (status && OPEN_NOTION_STATUSES.includes(status)) return true;
  const cutoff = now - SCOPE_DAYS * 86_400_000;
  const created = Date.parse(date(page, "Created Date") ?? page.created_time);
  return created >= cutoff || Date.parse(page.last_edited_time) >= cutoff;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Exact name or exact email match only, never a guess. "General" and blank are
 * unassigned with no report entry; any other name without a login is reported.
 */
export function resolveAssignee(name: string | null, staff: StaffUser[]): { userId: string | null; missingLogin: string | null } {
  const n = norm(name);
  if (!n || n === "general") return { userId: null, missingLogin: null };
  const byName = staff.filter((s) => norm(s.full_name) === n);
  if (byName.length === 1 && byName[0]) return { userId: byName[0].id, missingLogin: null };
  const byEmail = staff.filter((s) => norm(s.email) === n);
  if (byEmail.length === 1 && byEmail[0]) return { userId: byEmail[0].id, missingLogin: null };
  return { userId: null, missingLogin: name!.trim() };
}

/** Notion writes "ORP123456", Resolve stores "123456". */
export function normalizeOwnerRezId(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().replace(/^ORP/i, "");
  return /^\d+$/.test(s) ? s : null;
}

const money = (n: number | null) => (n == null ? "blank" : `$${n.toFixed(2)}`);

export function mapNotionPage(
  page: NotionPage,
  ctx: {
    staff: StaffUser[];
    /** Notion PID page id -> OwnerRez ID text from that page. */
    pidOwnerRez: Map<string, string | null>;
    /** OwnerRez ID -> Resolve property id. */
    propertyByOwnerRez: Map<string, string>;
    homeLabel?: string | null;
  },
): MapOutcome {
  const statusName = select(page, "Issue Status") ?? "In progress";
  const { status, waitingOnClaimReview } = mapStatus(statusName);

  // Home: ID only.
  const pids = relationIds(page, "Property Address");
  let propertyId: string | null = null;
  let homeOwnerRezId: string | null = null;
  for (const pid of pids) {
    const orz = normalizeOwnerRezId(ctx.pidOwnerRez.get(pid));
    if (orz && !homeOwnerRezId) homeOwnerRezId = orz;
    if (orz && ctx.propertyByOwnerRez.has(orz)) {
      propertyId = ctx.propertyByOwnerRez.get(orz)!;
      homeOwnerRezId = orz;
      break;
    }
  }
  const formerProperty = !propertyId && homeOwnerRezId ? FORMER_PROPERTY_OWNERREZ[homeOwnerRezId] ?? null : null;

  const { userId, missingLogin } = resolveAssignee(select(page, "Assignee"), ctx.staff);

  const createdIso = date(page, "Created Date") ?? page.created_time;
  const createdYear = new Date(createdIso).getUTCFullYear();
  let importHold: MappedTicket["import_hold"] = null;
  if (!propertyId) importHold = "needs_home";
  else if (status !== "closed" && createdYear < BACKLOG_BEFORE_YEAR) importHold = "backlog_review";

  const rawTitle = text(page, "Issue Description");
  const title = rawTitle || `Imported Notion ticket${ctx.homeLabel ? `: ${ctx.homeLabel}` : ""}`;

  // Unmapped fields go in one "Imported from Notion" block.
  const block: string[] = ["Imported from Notion"];
  if (formerProperty) block.push(`Former property: ${formerProperty}`);
  const submittedBy = select(page, "Submitted by");
  if (submittedBy) block.push(`Submitted by: ${submittedBy}`);
  const market = select(page, "Market");
  if (market) block.push(`Market: ${market}`);
  const completedBy = people(page, "Completed by");
  if (completedBy.length) block.push(`Completed by: ${completedBy.join(", ")}`);
  const guestInformed = select(page, "Guest Informed?");
  if (guestInformed) block.push(`Guest informed: ${guestInformed}`);
  if (pids.length > 1) block.push("Linked to more than one home in Notion. Please check the home.");
  if (missingLogin) block.push(`Notion assignee: ${missingLogin} (no Resolve login at import)`);
  block.push(`Notion status: ${statusName}`);
  if (page.url) block.push(`Notion page: ${page.url}`);
  const notes = text(page, "Notes");
  const description = [notes, block.join("\n")].filter(Boolean).join("\n\n");

  let claim: MappedTicket["claim"] = null;
  if (select(page, "Will this be a claim?") === "Yes") {
    const filed = select(page, "Claim Filed?");
    const lines = [
      "Imported from Notion",
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
      assigned_to: userId,
      assignment_note: missingLogin ? `Notion assignee ${missingLogin} has no Resolve login yet` : null,
      reported_at: createdIso,
      due_at: date(page, "Due Date"),
      resolved_at: status === "closed" ? completed ?? page.last_edited_time : null,
      breezeway_task_url: text(page, "Breezeway Link") || null,
      waiting_on: waitingOnClaimReview ? "other" : null,
      waiting_reason: waitingOnClaimReview ? "claim review" : null,
      import_hold: importHold,
      claim,
    },
    missingLogin,
    homeOwnerRezId,
    formerProperty,
    multipleHomes: pids.length > 1,
  };
}

export type RunReport = {
  pass: "dry_run" | "pass1" | "pass2";
  inScope: number;
  created: number;
  updated: number;
  skipped: number;
  unassignedMissingLogin: { title: string; assignee: string }[];
  needsHome: { title: string; home: string }[];
  backlog: number;
  claims: number;
  comments: number;
  files: number;
  failures: { title: string; error: string }[];
};

export function emptyReport(pass: RunReport["pass"]): RunReport {
  return { pass, inScope: 0, created: 0, updated: 0, skipped: 0, unassignedMissingLogin: [], needsHome: [], backlog: 0, claims: 0, comments: 0, files: 0, failures: [] };
}

export function mergeReport(a: RunReport, b: RunReport): RunReport {
  return {
    pass: a.pass,
    inScope: a.inScope + b.inScope,
    created: a.created + b.created,
    updated: a.updated + b.updated,
    skipped: a.skipped + b.skipped,
    unassignedMissingLogin: [...a.unassignedMissingLogin, ...b.unassignedMissingLogin],
    needsHome: [...a.needsHome, ...b.needsHome],
    backlog: a.backlog + b.backlog,
    claims: a.claims + b.claims,
    comments: a.comments + b.comments,
    files: a.files + b.files,
    failures: [...a.failures, ...b.failures],
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
