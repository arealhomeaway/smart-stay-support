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
  emailTemplateId?: string | null;
  trade?: string | null;
  fields?: FillFieldCode[];
  where?: WhereCode | null;
  /** Send to the homeowner steps on a standard owner's home (no live program). */
  fallback?: "outside_resolve" | "email" | null;
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
  const r = raw as Record<string, unknown>;
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
