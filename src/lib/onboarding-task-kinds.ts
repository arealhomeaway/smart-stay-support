/**
 * Kinds of onboarding Task (Nov 12 build, Part A). One field on each plan step and Task
 * decides the middle of the Task drawer, its main button and when the Task completes.
 *
 * Pure and browser-safe. The stored value is `task_kind` (staged file 01 in
 * docs/pending/onboarding-kinds/); until it exists, `effectiveTaskKind` applies the
 * approved backfill rule so screens agree with what the file will write.
 */
import { isBreezewayWorkOrderStep } from "@/lib/onboarding-breezeway";

export const TASK_KINDS = [
  "do_it",
  "fill_in",
  "upload_files",
  "work_order",
  "send_to_owner",
  "outside_resolve",
  "email",
  "vendor_request",
  "approval",
] as const;
export type TaskKindCode = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABEL: Record<TaskKindCode, string> = {
  do_it: "Do it",
  fill_in: "Fill in Resolve",
  upload_files: "Upload files",
  work_order: "Work order",
  send_to_owner: "Send to the homeowner",
  outside_resolve: "Done outside Resolve",
  email: "Email",
  vendor_request: "Vendor or team request",
  approval: "Approval",
};

/** Fill in Resolve fields, in the approved order. */
export const FILL_FIELDS = [
  { code: "closing_date", label: "Closing date" },
  { code: "target_handoff", label: "Target handoff" },
  { code: "access_plan", label: "Access plan" },
  { code: "inspection_date", label: "Inspection date" },
  { code: "budget", label: "Budget" },
  { code: "wifi", label: "Wi-Fi name and password" },
  { code: "default_cleaner", label: "Default cleaner" },
  { code: "team_roles", label: "Team roles" },
  { code: "verified_address", label: "Verified address" },
  { code: "utility_accounts", label: "Utility accounts" },
] as const;
export type FillFieldCode = (typeof FILL_FIELDS)[number]["code"];

/** Template setting for Done outside Resolve steps. */
export const OUTSIDE_PLACES = [
  { code: "docusign", label: "DocuSign" },
  { code: "houzz_pro", label: "Houzz Pro" },
  { code: "quickbooks", label: "QuickBooks" },
  { code: "other", label: "Other" },
] as const;
/** What staff pick on the Task ("Where it went"), preset from the step. */
export const WHERE_IT_WENT = [
  { code: "docusign", label: "DocuSign" },
  { code: "houzz_pro", label: "Houzz Pro" },
  { code: "quickbooks", label: "QuickBooks" },
  { code: "email", label: "Email" },
  { code: "text", label: "Text" },
  { code: "other", label: "Other" },
] as const;
export type WhereCode = (typeof WHERE_IT_WENT)[number]["code"];

export type KindSettings = {
  emailTemplateId?: string | null | undefined;
  trade?: string | null | undefined;
  fields?: FillFieldCode[] | undefined;
  where?: WhereCode | null | undefined;
  /** Send to the homeowner steps on a standard owner's home (no live program). */
  fallback?: "outside_resolve" | "email" | null | undefined;
};

export function isTaskKind(v: unknown): v is TaskKindCode {
  return typeof v === "string" && (TASK_KINDS as readonly string[]).includes(v);
}

/**
 * The stored kind, else the approved backfill rule: Work order by title, Send to the
 * homeowner when the step needs the owner's approval or a business decision, else Do it.
 * No other kind is ever guessed from a title.
 */
export function effectiveTaskKind(t: {
  task_kind?: string | null;
  title?: string | null;
  requires_owner_approval?: boolean | null;
  owner_dependency?: string | null;
}): TaskKindCode {
  if (isTaskKind(t.task_kind)) return t.task_kind;
  if (isBreezewayWorkOrderStep(t.title)) return "work_order";
  if (t.requires_owner_approval || t.owner_dependency === "business_decision") return "send_to_owner";
  return "do_it";
}

export function kindSettings(raw: unknown): KindSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as { emailTemplateId?: unknown; trade?: unknown; fields?: unknown; where?: unknown; fallback?: unknown };
  const out: KindSettings = {};
  if (typeof r.emailTemplateId === "string" && r.emailTemplateId) out.emailTemplateId = r.emailTemplateId;
  if (typeof r.trade === "string" && r.trade) out.trade = r.trade;
  if (Array.isArray(r.fields)) {
    const known = FILL_FIELDS.map((f) => f.code) as string[];
    out.fields = r.fields.filter((f): f is FillFieldCode => typeof f === "string" && known.includes(f));
  }
  if (typeof r.where === "string" && WHERE_IT_WENT.some((w) => w.code === r.where)) out.where = r.where as WhereCode;
  if (r.fallback === "outside_resolve" || r.fallback === "email") out.fallback = r.fallback;
  return out;
}

/**
 * The middle of the drawer actually shown. A Send to the homeowner step on a home with no
 * live Active Owner program uses the step's fallback (Done outside Resolve or Email).
 */
export function drawerMiddle(kind: TaskKindCode, settings: KindSettings, hasPortal: boolean): TaskKindCode {
  if (kind === "send_to_owner" && !hasPortal && settings.fallback) return settings.fallback;
  return kind;
}

/** The main button at the bottom of the drawer, or null when the Task follows Breezeway. */
export function mainButtonLabel(kind: TaskKindCode): string | null {
  switch (kind) {
    case "work_order":
      return null;
    case "fill_in":
      return "Save and complete";
    case "send_to_owner":
      return "Send to the homeowner";
    case "email":
      return "Send email";
    case "approval":
      return "Approve";
    default:
      return "Complete";
  }
}

export type CompletionState = {
  /** Proof note (at least 5 characters) or a stored file. */
  proofNote?: string | null;
  fileCount?: number;
  evidenceRequired?: boolean;
  /** Fill in Resolve: the step's fields that still have no value. */
  missingFields?: string[];
  /** Done outside Resolve. */
  where?: string | null;
  outsideProof?: string | null;
  /** Email and Send to the homeowner: the send went out. */
  sent?: boolean;
  /** Approval: the step review is approved. */
  approved?: boolean;
};

const proofGiven = (s: CompletionState) => (s.proofNote ?? "").trim().length >= 5 || (s.fileCount ?? 0) > 0;

/** Each kind's completion rule: null when the Task may complete, else the plain reason. */
export function completionBlock(kind: TaskKindCode, s: CompletionState): string | null {
  switch (kind) {
    case "do_it":
      return s.evidenceRequired && !proofGiven(s) ? "Add where the proof is, or attach a file." : null;
    case "fill_in":
      return (s.missingFields ?? []).length ? `Fill in ${s.missingFields!.join(", ")}.` : null;
    case "upload_files":
      return (s.fileCount ?? 0) > 0 ? null : "Upload at least one file.";
    case "work_order":
      return "Completes by itself when Breezeway marks the job done.";
    case "send_to_owner":
      return s.sent ? null : "Completes when you send it to the homeowner.";
    case "outside_resolve":
      if (!s.where) return "Choose where it went.";
      return (s.outsideProof ?? "").trim().length >= 5 || (s.fileCount ?? 0) > 0
        ? null
        : "Paste a link or envelope number, or upload a screenshot.";
    case "email":
      return s.sent ? null : "Completes when the email sends.";
    case "vendor_request":
      return proofGiven(s) ? null : "Attach the reply or quote, or note it.";
    case "approval":
      return s.approved ? null : "Approve, or send it back with a note.";
  }
}

/** What the owner sees on a Done outside Resolve step that also has an owner card. */
export function outsideOwnerLine(where: string | null | undefined): string {
  const label = WHERE_IT_WENT.find((w) => w.code === where)?.label;
  const place = !label || where === "other" || where === "text" || where === "email" ? "document" : label;
  return `Check your email for the ${place} from ARHA`;
}

/* ------------------------------------------------------------- Email fill-ins */

const BRACKET_RE = /\[([^\]\n]{1,60})\]/g;

/** Plain bracket words mapped to the Task email merge keys. */
const BRACKET_KEYS: Record<string, string> = {
  "owner first name": "owner_first_name",
  "first name": "owner_first_name",
  "homeowner first name": "owner_first_name",
  "owner name": "owner_name",
  "homeowner name": "owner_name",
  "owner": "owner_name",
  "property": "property",
  "home": "property",
  "property name": "property",
  "address": "property_address",
  "property address": "property_address",
  "home address": "property_address",
  "street address": "property_address",
  "your name": "sender_name",
  "sender name": "sender_name",
  "sender": "sender_name",
  "arha contact": "arha_contact",
  "due date": "task_due",
  // Vendor or team request letters: filled from the chosen vendor and the home.
  "vendor name": "vendor_name",
  "vendor": "vendor_name",
  "vendor company": "vendor_name",
  "market": "market",
  "home market": "market",
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Replaces every [bracketed] fill-in the home or sender can answer; unknown ones stay. */
export function fillBrackets(text: string, values: Record<string, string | null | undefined>): string {
  return text.replace(BRACKET_RE, (whole, inner: string) => {
    const key = BRACKET_KEYS[norm(inner)];
    const v = key ? values[key] : undefined;
    return v ? String(v) : whole;
  });
}

/** The [bracketed] fill-ins still empty; Send is blocked while any remain. */
export function emptyBrackets(text: string): string[] {
  return [...new Set([...text.matchAll(BRACKET_RE)].map((m) => `[${m[1]}]`))];
}

/** The text cut into plain runs and empty [bracketed] fill-ins, for highlighting in place. */
export function bracketSegments(text: string): { text: string; empty: boolean }[] {
  const out: { text: string; empty: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(BRACKET_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), empty: false });
    out.push({ text: m[0], empty: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), empty: false });
  return out;
}

/** Item 4: the merge values a Vendor or team request adds for the chosen vendor and the home. */
export function vendorMergeValues(vendorName: string | null | undefined, market: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (vendorName?.trim()) out["vendor_name"] = vendorName.trim();
  if (market?.trim()) out["market"] = market.trim();
  return out;
}

/* ---------------------------------------------------------- Vendor request */

export type VendorRow = {
  orgId: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  usesBreezeway: boolean;
  homeFirstChoice: boolean;
  note: string | null;
};

/** The home's own first-choice vendors first (with their note), then the market list by name. */
export function orderVendors(rows: VendorRow[]): VendorRow[] {
  return rows.slice().sort((a, b) =>
    a.homeFirstChoice !== b.homeFirstChoice ? (a.homeFirstChoice ? -1 : 1) : a.name.localeCompare(b.name),
  );
}

export function noVendorLine(trade: string | null | undefined, market: string | null | undefined): string {
  return `No ${trade || "matching"} vendor in ${market || "this market"} yet`;
}

/* ---------------------------------------------------------- Forms */

/** The first https link in the step text, for "Open the form". */
export function firstLink(text: string | null | undefined): string | null {
  const m = /https:\/\/[^\s)>\]]+/i.exec(text ?? "");
  return m ? m[0].replace(/[.,;]+$/, "") : null;
}

/** "Mid-Project Review" and "New House Handoff form" steps get a large Open the form button. */
export function isOutsideForm(title: string | null | undefined): boolean {
  return /mid-?project review|new house handoff form|\bform\b/i.test(title ?? "");
}


/* ---------------------------------------------------------- Reopen (item 7) */

/** Who may reopen a completed Task: Admin, the Director of Onboarding, or the person who completed it. */
export function canReopenCompletedTask(who: { userId: string | null; isAdmin: boolean; isOnboardingDirector: boolean }, completedBy: string | null | undefined): boolean {
  if (who.isAdmin || who.isOnboardingDirector) return true;
  return Boolean(who.userId && completedBy && completedBy === who.userId);
}

/* ---------------------------------------------------------- Follow-ups (item 8) */

type LinkTask = { id: string; title: string; follow_up_of?: string | null };

/** The Task a follow-up came from, and the follow-ups added from this Task, by the stored link. */
export function followUpLinks<T extends LinkTask>(task: T, tasks: readonly T[]): { from: T | null; followUps: T[] } {
  const from = task.follow_up_of ? tasks.find((t) => t.id === task.follow_up_of) ?? null : null;
  return { from, followUps: tasks.filter((t) => t.follow_up_of === task.id && t.id !== task.id) };
}

/* ---------------------------------------------------------- Approval (item 9) */

/**
 * An Approval Task with a configured step review keeps the step review. Without one, the
 * Task's assigned person reviews it: they decide; everyone else waits on them.
 */
export function approvalMode(input: { reviewConfigured: boolean; reviewerId: string | null; userId: string | null }):
  "step_review" | "decide" | "waiting" | "no_reviewer" {
  if (input.reviewConfigured) return "step_review";
  if (!input.reviewerId) return "no_reviewer";
  return input.userId && input.userId === input.reviewerId ? "decide" : "waiting";
}

/* ---------------------------------------------------------- Default cleaner (item 1) */

/** The service category Operations uses for a home's cleaner on its vendor coverage. */
export const DEFAULT_CLEANER_TRADE = "Turnover Cleaning";

export type CoverageRow = { org_id: string; service_category: string; coverage_priority: string; effective_from?: string | null; effective_to?: string | null; excluded?: boolean | null };

/** A home's default cleaner: its live primary Turnover Cleaning coverage row (Central date). */
export function liveDefaultCleaner<T extends CoverageRow>(rows: readonly T[], today: string): T | null {
  return (
    rows.find(
      (r) =>
        r.service_category === DEFAULT_CLEANER_TRADE &&
        r.coverage_priority === "primary" &&
        !r.excluded &&
        (!r.effective_from || r.effective_from <= today) &&
        (!r.effective_to || r.effective_to >= today),
    ) ?? null
  );
}

/* ---------------------------------------------------------- Owner Completions (item 6) */

/** A completion row with a Task opens that Task's drawer at the conversation; any other row opens the evidence view. */
export function completionRowOpens(row: { source_task_id: string | null }): "task" | "evidence" {
  return row.source_task_id ? "task" : "evidence";
}

/* ---------------------------------------------------------- Vendor request history (item 4) */

/** How a Task email is written into history: a vendor request is never a homeowner email. */
export function taskEmailHistory(input: { subject: string; vendorName?: string | null }): { kind: "vendor_requested" | "homeowner_emailed"; category: "vendor" | "administrative"; summary: string; outcome: string } {
  const subject = input.subject.trim().slice(0, 200);
  if (input.vendorName?.trim()) {
    return {
      kind: "vendor_requested",
      category: "vendor",
      summary: `Vendor request sent to ${input.vendorName.trim()}: ${subject}`.slice(0, 300),
      outcome: "Vendor request sent from an onboarding Task.",
    };
  }
  return { kind: "homeowner_emailed", category: "administrative", summary: "", outcome: "Email sent from an onboarding Task." };
}
