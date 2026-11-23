/**
 * Active Owner enrollment is automatic on every path (Admin, Nov 23).
 * Pure, browser-safe rules: wording, links, who gets a setup item, and what the
 * 5 minute check does for each home. The server side lives in
 * active-owner-auto-enroll.server.ts and runs the existing one-step enrollment.
 */
import { ACTIVE_OWNER_TYPE, isLiveProgram } from "./owner-type-enrollment";
import { isTestRecord } from "./test-data";

export type AutoEnrollSource =
  | "owner_type"
  | "module"
  | "add_property"
  | "start_onboarding"
  | "closing_added"
  | "email_added"
  | "five_minute_check";

export type SetupItemKind = "add_email" | "add_closing" | "needs_attention";

/** History reasons for keeping the Owner Type label and the module in step. */
export const MODULE_FROM_OWNER_TYPE = "Owner Type set to Active Owner";
export const OWNER_TYPE_FROM_MODULE = "Owner Type set to Active Owner to match the Active Owner setting.";

/** Plain words for the Needs you now item. Roles only, no system words. */
export const SETUP_ITEM_TITLE: Record<SetupItemKind, string> = {
  add_email: "Add the homeowner's email to finish Active Owner setup.",
  add_closing: "Add the closing date for this Active Owner home.",
  needs_attention: "Active Owner setup needs attention.",
};

/** Where each item is fixed: the email on the home's Owner tab, the closing date on the onboarding details. */
export function setupItemLink(kind: SetupItemKind, propertyId: string) {
  if (kind === "add_closing") return `/onboarding/${propertyId}?tab=details&section=dates`;
  return `/property/${propertyId}?tab=owner`;
}

/** The history line written when a home is enrolled automatically. */
export function autoEnrollHistoryLine(source: AutoEnrollSource, saverName: string | null) {
  if (source === "five_minute_check") return "Enrolled automatically by the 5 minute check";
  const who = saverName?.trim() || "a teammate";
  if (source === "module" || source === "start_onboarding") return `Enrolled automatically: Active Owner turned on by ${who}`;
  if (source === "email_added") return `Active Owner setup finished: homeowner email added by ${who}`;
  if (source === "closing_added") return `Active Owner setup finished: closing date added by ${who}`;
  return `Enrolled automatically: Owner Type set to Active Owner by ${who}`;
}

/** Either the Owner Type label or the module marks a home as Active Owner. */
export function labelledActiveOwner(p: { owner_type: string | null; modules: string[] | null }) {
  return (p.owner_type ?? "").trim() === ACTIVE_OWNER_TYPE || (p.modules ?? []).includes("active_owner");
}

/** What has to change so the label and the module agree (setting either one sets the other; nothing is removed). */
export function labelSync(p: { owner_type: string | null; modules: string[] | null }) {
  const modules = p.modules ?? [];
  return {
    addModule: !modules.includes("active_owner"),
    setOwnerType: (p.owner_type ?? "").trim() !== ACTIVE_OWNER_TYPE,
    modules: modules.includes("active_owner") ? modules : [...modules, "active_owner"],
  };
}

export type LinkRow = {
  inclusion_status: string;
  program: { status: string; archived_at: string | null; owner_user_id: string | null } | null;
};

/**
 * The home's enrollment today.
 * - complete: a live program with a homeowner login. Never touched again.
 * - live_no_login: live program, no login yet (the email was missing).
 * - set_aside: a program for this home was closed, archived or the home was removed; never re-enrolled automatically.
 * - not_enrolled: nothing live (a draft program still counts as not enrolled).
 */
export function enrollmentState(links: LinkRow[]): "complete" | "live_no_login" | "set_aside" | "not_enrolled" {
  const live = links.find((l) => l.inclusion_status === "included" && l.program && isLiveProgram(l.program));
  if (live) return live.program?.owner_user_id ? "complete" : "live_no_login";
  const setAside = links.some(
    (l) =>
      l.inclusion_status !== "included" ||
      (l.program && (l.program.archived_at !== null || ["closed", "completed", "complete"].includes(l.program.status))),
  );
  return setAside ? "set_aside" : "not_enrolled";
}

export type SafetyNetHome = {
  propertyId: string;
  name: string | null;
  isDemo: boolean;
  archived: boolean;
  ownerType: string | null;
  modules: string[] | null;
  state: ReturnType<typeof enrollmentState>;
  hasEmail: boolean;
  hasClosing: boolean;
  openItems: { kind: SetupItemKind; lastAttemptAt: string | null }[];
};

export type SafetyNetAction = "enroll" | "finish" | "flag_set_aside" | "close_items" | "skip";

/** Retry a problem at most once an hour so a stuck home never floods history. */
export const RETRY_EVERY_MINUTES = 60;

/**
 * What the 5 minute check does for one home. Safe to run forever:
 * a fully enrolled home, a demo or test home, and a home waiting on a detail
 * nobody has added yet are all left alone.
 */
export function safetyNetAction(h: SafetyNetHome, now = new Date()): SafetyNetAction {
  if (h.isDemo || isTestRecord({ name: h.name, is_demo: h.isDemo }) || h.archived) return "skip";
  if (!labelledActiveOwner({ owner_type: h.ownerType, modules: h.modules })) return "skip";
  const open = new Map(h.openItems.map((i) => [i.kind, i]));
  if (h.state === "complete") return h.openItems.length > 0 ? "close_items" : "skip";
  if (h.state === "live_no_login") return open.has("add_email") && h.hasEmail ? "finish" : "skip";
  if (h.state === "set_aside") return open.has("needs_attention") ? "skip" : "flag_set_aside";
  // Not enrolled.
  if (open.has("add_closing") && !h.hasClosing) return "skip";
  const problem = open.get("needs_attention");
  if (problem?.lastAttemptAt) {
    const minutes = (now.getTime() - Date.parse(problem.lastAttemptAt)) / 60000;
    if (minutes < RETRY_EVERY_MINUTES) return "skip";
  }
  return "enroll";
}

/** Plain reason shown on a needs-attention item; database wording is never shown raw. */
export function plainSetupReason(detail: string | null | undefined) {
  const d = (detail ?? "").trim();
  if (!d) return "Active Owner setup did not finish. It will try again.";
  if (/function .* does not exist|Could not find the function|schema cache|PGRST/i.test(d))
    return "Active Owner setup will finish once the update is turned on.";
  return d.length > 300 ? `${d.slice(0, 297)}...` : d;
}
