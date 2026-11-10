/**
 * Route authorization — the one rule that decides which Resolve pages a person
 * may open. The app shell builds its navigation from the same rule and the
 * authenticated layout enforces it before any page renders, so a hidden link
 * and a typed URL always agree. New routes inherit it automatically: anything
 * not listed here belongs to the Operations portal.
 *
 * Pure functions only (no React, no data) so the rules are testable.
 */
import {
  capabilitiesFor,
  isFinanceOnly,
  type AccessSeats,
  type AppRole,
  type Capability,
} from "@/lib/permissions";
import { portalsFor } from "@/lib/portals";

export type AccessContext = { roles: AppRole[]; seats?: AccessSeats };

type Rule = {
  prefix: string;
  /** Portal the person must be authorised to work in. */
  portal?: "operations" | "onboarding" | "homeowner" | "vendor";
  /** Capability the person must hold (leadership / administration areas). A list means any one of them. */
  capability?: Capability | Capability[];
  /** Alternative capability that also opens it (read-only owner preview). */
  orCapability?: Capability;
  /** Anyone signed in with a role may open it (their own account etc.). */
  shared?: boolean;
};

// Longest/most specific prefixes first; matching is by whole path segment.
const RULES: Rule[] = [
  { prefix: "/account", shared: true },
  { prefix: "/notifications", shared: true },
  { prefix: "/hub", shared: true },
  { prefix: "/join", shared: true },
  { prefix: "/demo", capability: "view_as" },
  { prefix: "/onboarding", portal: "onboarding" },
  { prefix: "/owner-programs", capability: "owner_programs" },
  { prefix: "/owner-oversight", capability: "owner_oversight" },
  { prefix: "/owner-analytics", capability: "owner_insight_view" },
  { prefix: "/owner-library", capability: "owner_insight_view" },
  { prefix: "/owner-card-library", capability: "owner_card_library" },
  { prefix: "/owner-report-wording", capability: "owner_program_admin" },
  { prefix: "/owner-handoff-plan", capability: "owner_programs" },
  { prefix: "/active-owner-followup", capability: "owner_programs" },
  { prefix: "/owner-contributions", capability: "owner_programs" },
  { prefix: "/homeowners", capability: "homeowner_directory" },
  { prefix: "/owner", portal: "homeowner", orCapability: "owner_programs" },
  { prefix: "/vendors", capability: "vendor_directory" },
  { prefix: "/vendor", portal: "vendor" },
  { prefix: "/command-center", capability: "command_center" },
  // My reports: every staff member sees their own; the Admin sees all (register A20).
  { prefix: "/help-tickets", capability: "help_tickets_own" },
  // The other Admin pages are Admin only, by address too (register A20, M6).
  { prefix: "/audit", capability: "admin_pages" },
  { prefix: "/oversight-access-log", capability: "admin_pages" },
  { prefix: "/integrations", capability: "integrations" },
  // The read only nightly Export check (register N10): Admin, Operations Supervisor, Directors.
  { prefix: "/export-check", capability: "export_check" },
  // The playbook library opens read only for every staff account; saving is checked separately.
  { prefix: "/playbooks", capability: "playbooks_view" },
  // Ticket checklists follow the playbook rule: every staff account views, editing is checked separately.
  { prefix: "/ticket-checklists", capability: "playbooks_view" },
  // Team & Coverage: Schedule read only for every staff account (Operations and Onboarding).
  { prefix: "/team", capability: "team_schedule_view" },
  // Databases hub: every staff account (register P3). Each list checks its own access.
  { prefix: "/databases", capability: "databases" },
  { prefix: "/oversight", capability: "oversight" },
  { prefix: "/supervisor-check", capability: "oversight" },
  { prefix: "/analytics", capability: "analytics" },
  { prefix: "/ops-analytics", capability: "analytics" },
  // Work order oversight stays Operations only; the Work Orders pages also open read only
  // for the Director of Onboarding and Project Managers.
  { prefix: "/work-orders/manager", portal: "operations", capability: "work_orders_internal" },
  { prefix: "/work-orders", capability: ["work_orders_internal", "work_orders_view"] },
  { prefix: "/imported-tickets", capability: "admin_pages" },
  // Team Queue: Coordinator, Supervisor, Director of Operations, Admin (register A6).
  { prefix: "/team-queue", capability: "team_queue" },
  // Handoffs, read only: Operations leadership (register A1, A16; Emily, Nov 9).
  { prefix: "/handoffs", capability: "handoffs_view" },
  // Properties list and home pages: every role A12 names, Onboarding roles included.
  { prefix: "/properties", capability: "properties" },
  { prefix: "/property", capability: "properties" },
  { prefix: "/cleaner-hours", capability: "cleaner_hours" },
  { prefix: "/str-participation-report", capability: "str_participation_report" },
  { prefix: "/str-dispatch-check", capability: "cleaner_dispatch_check" },
  { prefix: "/finance", capability: ["finance_workspace", "finance_view"] },
  { prefix: "/direct-bookings/settings", capability: "leads_work" },
  { prefix: "/direct-bookings", capability: "direct_bookings_work" },
];

function ruleFor(pathname: string): Rule {
  return (
    RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/")) ?? {
      prefix: "",
      portal: "operations",
    }
  );
}

function portalIds(ctx: AccessContext): Set<string> {
  const ids = new Set(portalsFor(ctx.roles).map((p) => p.id));
  if (ctx.seats?.onboardingDirector) ids.add("onboarding");
  // A Supervisor type account opens Onboarding only for the Director of Operations
  // (register A16 View, handoff acceptance) and Finance (A16 View). The Operations
  // Supervisor sees Onboarding only through the read only Handoffs page (Emily, Nov 9).
  const s = ctx.seats ?? {};
  if (
    ctx.roles.includes("manager") &&
    !ctx.roles.includes("admin") &&
    !ctx.roles.includes("onboarding") &&
    !s.onboardingDirector &&
    !s.opsDirector &&
    !s.finance
  ) {
    ids.delete("onboarding");
  }
  return ids;
}

/** Portals this person may enter (the hub and the portal cards read this). */
export function portalIdsFor(ctx: AccessContext): Set<string> {
  return portalIds(ctx);
}

/** May this person open this page? Mirrors what the server enforces for data. */
export function canOpenPath(pathname: string, ctx: AccessContext): boolean {
  const path = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  const rule = ruleFor(path);
  const portals = portalIds(ctx);
  if (portals.size === 0) return false;
  if (rule.shared) return true;
  if (rule.portal && !portals.has(rule.portal)) {
    // Staff who manage Active Owner may open the read-only homeowner preview.
    if (!rule.orCapability || !capabilitiesFor(ctx.roles, ctx.seats).has(rule.orCapability))
      return false;
  }
  if (rule.capability) {
    const caps = capabilitiesFor(ctx.roles, ctx.seats);
    const needed = Array.isArray(rule.capability) ? rule.capability : [rule.capability];
    if (!needed.some((c) => caps.has(c))) return false;
  }
  return true;
}

/** The most useful place this person is authorised to work. */
export function homePathFor(ctx: AccessContext): string {
  const portals = portalIds(ctx);
  if (portals.has("operations") && ctx.roles.includes("admin")) return "/command-center";
  if (portals.size === 1) {
    const only = [...portals][0];
    return only === "onboarding"
      ? "/onboarding"
      : only === "homeowner"
        ? "/owner"
        : only === "vendor"
          ? "/vendor"
          : "/dashboard";
  }
  if (portals.has("operations")) return "/dashboard";
  return "/hub";
}

/**
 * Pages Finance opens to look, not to change (register A4 Home, A8 Work orders, A9
 * Vendors, A10 Claims and refunds, A12 Properties, A16 Onboarding). Finance pages
 * (A18) and Direct Bookings (A11) stay as they are.
 */
export const FINANCE_VIEW_ONLY_PATHS = [
  "/dashboard",
  "/work-orders",
  "/vendors",
  "/claims",
  "/recovery",
  "/properties",
  "/property",
  "/onboarding",
] as const;

/** True when this person may only look at this page (Finance on the pages above). */
export function viewOnlyPath(pathname: string, ctx: AccessContext): boolean {
  if (!isFinanceOnly(ctx.roles, ctx.seats)) return false;
  const path = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  return FINANCE_VIEW_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

/** Onboarding is the only portal this person works in. */
export function isOnboardingOnly(ctx: AccessContext): boolean {
  const portals = portalIds(ctx);
  return portals.size === 1 && portals.has("onboarding");
}
