/**
 * Route authorization — the one rule that decides which Resolve pages a person
 * may open. The app shell builds its navigation from the same rule and the
 * authenticated layout enforces it before any page renders, so a hidden link
 * and a typed URL always agree. New routes inherit it automatically: anything
 * not listed here belongs to the Operations portal.
 *
 * Pure functions only (no React, no data) so the rules are testable.
 */
import { capabilitiesFor, type AccessSeats, type AppRole, type Capability } from "@/lib/permissions";
import { portalsFor } from "@/lib/portals";

export type AccessContext = { roles: AppRole[]; seats?: AccessSeats };

type Rule = {
  prefix: string;
  /** Portal the person must be authorised to work in. */
  portal?: "operations" | "onboarding" | "homeowner" | "vendor";
  /** Capability the person must hold (leadership / administration areas). */
  capability?: Capability;
  /** Anyone signed in with a role may open it (their own account etc.). */
  shared?: boolean;
};

// Longest/most specific prefixes first; matching is by whole path segment.
const RULES: Rule[] = [
  { prefix: "/account", shared: true },
  { prefix: "/hub", shared: true },
  { prefix: "/join", shared: true },
  { prefix: "/demo", capability: "view_as" },
  { prefix: "/onboarding", portal: "onboarding" },
  { prefix: "/owner-programs", capability: "owner_programs" },
  { prefix: "/owner-oversight", capability: "owner_oversight" },
  { prefix: "/owner-analytics", capability: "owner_programs" },
  { prefix: "/owner-library", capability: "owner_programs" },
  { prefix: "/homeowners", capability: "homeowner_directory" },
  { prefix: "/owner", portal: "homeowner" },
  { prefix: "/vendors", capability: "vendor_admin" },
  { prefix: "/vendor", portal: "vendor" },
  { prefix: "/command-center", capability: "command_center" },
  { prefix: "/help-tickets", capability: "audit_history" },
  { prefix: "/audit", capability: "audit_history" },
  { prefix: "/oversight-access-log", capability: "audit_history" },
  { prefix: "/integrations", capability: "integrations" },
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
  return ids;
}

/** May this person open this page? Mirrors what the server enforces for data. */
export function canOpenPath(pathname: string, ctx: AccessContext): boolean {
  const path = pathname.split("?")[0]!.replace(/\/+$/, "") || "/";
  const rule = ruleFor(path);
  const portals = portalIds(ctx);
  if (portals.size === 0) return false;
  if (rule.shared) return true;
  if (rule.portal && !portals.has(rule.portal)) return false;
  if (rule.capability && !capabilitiesFor(ctx.roles, ctx.seats).has(rule.capability)) return false;
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

/** Onboarding is the only portal this person works in. */
export function isOnboardingOnly(ctx: AccessContext): boolean {
  const portals = portalIds(ctx);
  return portals.size === 1 && portals.has("onboarding");
}
