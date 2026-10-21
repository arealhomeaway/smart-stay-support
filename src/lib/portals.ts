import {
  Banknote,
  Building2,
  Gauge,
  HardHat,
  KeyRound,
  PackageCheck,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/permissions";

/**
 * Portal registry.
 *
 * Adding an ARHA department later means appending one entry here — the
 * overview page, the signed-in hub and the switcher all read from this list.
 * Nothing about a portal is hard-coded into a page.
 */
export type PortalVisibility =
  /** Named on the public overview page. */
  | "public"
  /** Never named publicly; appears only to an authorised signed-in user. */
  | "private";

export type PortalDefinition = {
  id: string;
  name: string;
  /** Who this portal is for, in one short line. */
  audience: string;
  /** Short, personality-forward line shown on the card. */
  tagline?: string;
  description: string;
  icon: LucideIcon;
  route: string;
  action: string;
  /** Inactive portals are never rendered — no empty or dead cards. */
  active: boolean;
  order: number;
  roles: AppRole[];
  visibility: PortalVisibility;
  /** Shown on the card when the portal is not live yet (internal views only). */
  note?: string;
};

export const PORTAL_REGISTRY: PortalDefinition[] = [
  {
    id: "operations",
    name: "ARHA Operations Hub",
    audience: "Property coordinators, supervisors and internal staff",
    tagline: "Keep the wheels on.",
    description:
      "Manage property tickets, guest and homeowner requests, assignments, escalations, communications, follow-ups, and property history.",
    icon: Building2,
    route: "/dashboard",
    action: "Enter Operations",
    active: true,
    order: 1,
    roles: ["admin", "manager", "tech"],
    visibility: "public",
  },
  {
    id: "vendor",
    name: "Vendor Portal",
    audience: "Service partners and their crews",
    tagline: "Get in. Get it done.",
    description:
      "View scheduled work, manage assignments, complete property checklists, upload evidence, manage your company's team, and review performance.",
    icon: HardHat,
    route: "/vendor",
    action: "Enter Vendor Portal",
    active: true,
    order: 2,
    roles: ["vendor", "admin"],
    visibility: "public",
  },
  {
    id: "onboarding",
    name: "Onboarding Portal",
    audience: "Onboarding team and homeowners bringing a new property on",
    tagline: "From keys to kickoff.",
    description:
      "Coordinate new-property onboarding, complete required steps, submit information, manage decisions, and track progress from contract through launch.",
    icon: PackageCheck,
    route: "/onboarding",
    action: "Enter Onboarding Portal",
    active: true,
    order: 3,
    roles: ["onboarding", "manager", "admin"],
    visibility: "public",
  },
  {
    id: "homeowner",
    name: "Active Homeowner Portal",
    audience: "Homeowners with a live property under management",
    tagline: "Stay in the loop without living in the weeds.",
    description:
      "Access active property information, requests, decisions, reports, participation activities, documentation, and important updates.",
    icon: KeyRound,
    route: "/owner",
    action: "Enter Homeowner Portal",
    active: true,
    order: 4,
    roles: ["owner", "admin"],
    visibility: "public",
  },
  {
    id: "executive",
    name: "Executive Oversight",
    audience: "Admins",
    description:
      "Monitor company health, departmental performance, operational risks, vendor performance, homeowner experience, financial indicators, and cross-department accountability.",
    icon: Gauge,
    route: "/command-center",
    action: "Enter Executive View",
    active: true,
    order: 5,
    // Deliberately not advertised publicly: naming the leadership surface on a
    // signed-out page tells an outsider where to aim.
    roles: ["admin"],
    visibility: "private",
  },
  {
    id: "finance",
    name: "Finance Workspace",
    audience: "Finance and accounting",
    description:
      "Manage financial workflows, approvals, exceptions, reporting, and connected QuickBooks information.",
    icon: Banknote,
    route: "/finance",
    action: "Enter Finance",
    // Not built yet — kept here so switching it on is a one-line change.
    active: false,
    order: 6,
    roles: ["admin"],
    visibility: "private",
  },
];

const byOrder = (a: PortalDefinition, b: PortalDefinition) => a.order - b.order;

/** Portals named on the signed-out overview page. */
export function publicPortals(): PortalDefinition[] {
  return PORTAL_REGISTRY.filter((p) => p.active && p.visibility === "public").sort(byOrder);
}

/** Portals a signed-in person is authorised to open. */
export function portalsFor(roles: AppRole[]): PortalDefinition[] {
  return PORTAL_REGISTRY.filter((p) => p.active && p.roles.some((r) => roles.includes(r))).sort(
    byOrder,
  );
}

export function portalByRoute(route: string): PortalDefinition | undefined {
  return PORTAL_REGISTRY.find((p) => p.route === route);
}

/** Only registry routes may be used as a post-sign-in destination. */
export function isKnownPortalRoute(route: string | undefined): route is string {
  return Boolean(route && PORTAL_REGISTRY.some((p) => p.active && p.route === route));
}

const RECENT_KEY = "resolve:last-portal";

export function rememberPortal(id: string) {
  try {
    window.localStorage.setItem(RECENT_KEY, id);
  } catch {
    /* private browsing — a missing "recently used" hint is not worth an error */
  }
}

export function recentPortalId(): string | null {
  try {
    return window.localStorage.getItem(RECENT_KEY);
  } catch {
    return null;
  }
}

/**
 * Where a person lands after signing in when they did not ask for a specific
 * portal. One portal → straight in; more than one → the personalised hub.
 */
export function entryPathFor(roles: AppRole[]): string {
  const mine = portalsFor(roles);
  if (mine.length === 0) return "/hub";
  if (mine.length === 1) return mine[0]!.route;
  return "/hub";
}
