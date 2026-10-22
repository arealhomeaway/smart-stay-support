/**
 * Shared navigation model for every Resolve page.
 *
 * NAVIGATION RULE: no page is complete unless the user can navigate into it and
 * back out of it while keeping their property/department context. The app shell
 * renders the department menu and breadcrumbs from this one registry, so any new
 * route inherits them automatically — pages never hand-build their own.
 *
 * Pure functions only (no React, no data) so the rules are testable.
 */
import type { Capability } from "@/lib/permissions";

export type Crumb = { label: string; to: string; search?: Record<string, string> };

export type DepartmentLink = {
  label: string;
  to: string;
  search?: Record<string, string>;
  capability?: Capability;
  /** Treat as active only on an exact path match with this search. */
  exact?: boolean;
};

export type Department = {
  key: string;
  label: string;
  home: string;
  /** Paths that belong to this department. */
  match: (pathname: string) => boolean;
  links: DepartmentLink[];
};

export const DEPARTMENTS: Department[] = [
  {
    key: "onboarding",
    label: "Onboarding",
    home: "/onboarding",
    match: (p) => p === "/onboarding" || p.startsWith("/onboarding/"),
    links: [
      { label: "Onboarding Home", to: "/onboarding", exact: true },
      { label: "Properties", to: "/onboarding", search: { lens: "all" }, exact: true },
      { label: "My Tasks", to: "/onboarding/my-work" },
      { label: "Owner Completions", to: "/onboarding/owner-completions" },
      { label: "Team", to: "/onboarding/team" },
      { label: "Workflow Templates", to: "/onboarding/templates", capability: "onboarding_templates" },
      { label: "Utilities & Accounts", to: "/onboarding/utilities" },
    ],
  },
  {
    key: "active-owner",
    label: "Active Owner",
    home: "/owner-programs",
    match: (p) =>
      ["/owner-programs", "/owner-oversight", "/owner-analytics", "/homeowners", "/owner-library"].some(
        (r) => p === r || p.startsWith(r + "/"),
      ),
    links: [
      { label: "Programs", to: "/owner-programs", capability: "owner_programs" },
      { label: "Program oversight", to: "/owner-oversight", capability: "owner_oversight" },
      { label: "Homeowners", to: "/homeowners", capability: "homeowner_directory" },
      { label: "Participation insight", to: "/owner-analytics", capability: "owner_program_admin" },
      { label: "Optional Opportunity Library", to: "/owner-library", capability: "owner_program_admin" },
    ],
  },
  {
    key: "str-cleaner-time",
    label: "STR cleaner time",
    home: "/cleaner-hours",
    match: (p) => ["/cleaner-hours", "/str-participation-report"].some((r) => p === r || p.startsWith(r + "/")),
    links: [
      { label: "STR cleaner time", to: "/cleaner-hours", capability: "cleaner_hours" },
      { label: "Participation reports", to: "/str-participation-report", capability: "str_participation_report" },
    ],
  },
  {
    key: "vendors",
    label: "Vendors",
    home: "/vendors",
    match: (p) => p === "/vendors" || p.startsWith("/vendors/"),
    links: [
      { label: "Directory", to: "/vendors", search: { tab: "directory" }, exact: true, capability: "vendor_directory" },
      { label: "Database", to: "/vendors", search: { tab: "database" }, exact: true, capability: "vendor_admin" },
      { label: "Gold Standard", to: "/vendors", search: { tab: "gold" }, exact: true, capability: "vendor_directory" },
      { label: "Market Coverage", to: "/vendors", search: { tab: "coverage" }, exact: true, capability: "vendor_directory" },
      { label: "Needs Review", to: "/vendors", search: { tab: "review" }, exact: true, capability: "vendor_directory" },
    ],
  },
];

export function departmentFor(pathname: string): Department | null {
  return DEPARTMENTS.find((d) => d.match(pathname)) ?? null;
}

/**
 * Page groups shown as a top-of-page tab bar (the same pattern the Active
 * Owner and Vendors departments already use). One sidebar item opens the
 * first page of a group; every page in the group shows the same tabs, and
 * each tab is shown only to people who can open that page. Paths already
 * owned by a DEPARTMENTS menu (Onboarding, Active Owner, Vendors, STR
 * cleaner time) are deliberately excluded so the two never stack.
 */
export type PageTabGroup = {
  key: string;
  match: (pathname: string) => boolean;
  tabs: DepartmentLink[];
};

export const PAGE_TAB_GROUPS: PageTabGroup[] = [
  {
    key: "my-work",
    match: (p) => p.startsWith("/tickets") || p === "/routines" || p === "/str-dispatch-check",
    tabs: [
      { label: "My Work", to: "/tickets", exact: true },
      { label: "Routine Work", to: "/routines", capability: "routines" },
      { label: "STR Cleaner Check", to: "/str-dispatch-check", capability: "cleaner_dispatch_check" },
    ],
  },
  {
    key: "properties",
    match: (p) =>
      p === "/properties" || p.startsWith("/property/") || p === "/map" || p === "/availability-finder",
    tabs: [
      { label: "Properties", to: "/properties", capability: "properties" },
      { label: "Work Map", to: "/map", capability: "work_orders_internal" },
      { label: "Availability Finder", to: "/availability-finder", capability: "work_orders_internal" },
    ],
  },
  {
    key: "work-orders",
    match: (p) =>
        p === "/work-orders" || p.startsWith("/work-orders/") || p === "/vendors" || p.startsWith("/vendors/"),
    tabs: [
      { label: "Work Orders", to: "/work-orders", capability: "work_orders_internal" },
      { label: "Vendors", to: "/vendors", capability: "vendor_directory" },
    ],
  },
  {
    key: "claims",
    match: (p) => p.startsWith("/claims") || p.startsWith("/recovery"),
    tabs: [
      { label: "Claims", to: "/claims", capability: "claims_work" },
      { label: "Refunds & Credits", to: "/recovery", capability: "claims_work" },
    ],
  },
  {
    key: "reports",
    match: (p) =>
      [
        "/analytics",
        "/ops-analytics",
        "/owner-analytics",
        "/cleaner-hours",
        "/str-participation-report",
        "/finance",
        "/command-center",
      ].some(
        (r) => p === r || p.startsWith(r + "/"),
      ),
    tabs: [
      { label: "Analytics", to: "/analytics", capability: "analytics" },
      { label: "Owner Participation", to: "/owner-analytics", capability: "owner_programs" },
      { label: "STR Cleaner Time", to: "/cleaner-hours", capability: "cleaner_hours" },
      { label: "Finance", to: "/finance", capability: "finance_workspace" },
      { label: "Executive View", to: "/command-center", capability: "command_center" },
    ],
  },
  {
    key: "admin",
    match: (p) =>
      ["/integrations", "/audit", "/help-tickets", "/oversight-access-log"].some(
        (r) => p === r || p.startsWith(r + "/"),
      ),
    tabs: [
      { label: "Integrations", to: "/integrations", capability: "integrations" },
      { label: "Audit History", to: "/audit", capability: "audit_history" },
      { label: "Help Tickets", to: "/help-tickets", capability: "audit_history" },
    ],
  },
];

export function pageTabGroupFor(pathname: string): PageTabGroup | null {
  return PAGE_TAB_GROUPS.find((g) => g.match(pathname)) ?? null;
}

/** Last path segment → page label for department sub-pages. */
const SUBPAGE_LABELS: Record<string, string> = {
  "/onboarding/my-work": "My Tasks",
  "/onboarding/owner-completions": "Owner Completions",
  "/onboarding/team": "Team",
  "/onboarding/templates": "Workflow Templates",
  "/onboarding/utilities": "Utilities & Accounts",
  "/onboarding/transitions": "Transitions",
  "/owner-oversight": "Program oversight",
  "/owner-analytics": "Participation insight",
  "/homeowners": "Homeowners",
  "/owner-library": "Optional Opportunity Library",
  "/str-participation-report": "Participation report",
};

const ONBOARDING_TABS: Record<string, string> = {
  work: "Tasks",
  property: "Property Details",
  handoff: "Handoff",
  files: "Files & History",
};

const RESERVED_ONBOARDING = new Set(["properties", "my-work", "team", "templates", "utilities", "transitions"]);

/**
 * Build the breadcrumb trail for a location. `propertyName` is the resolved
 * name of the property in the URL, when there is one; `pageLabel` lets a page
 * name its current view (e.g. a template name) without owning navigation.
 */
export function buildTrail(input: {
  pathname: string;
  search: Record<string, unknown>;
  propertyName?: string | null;
  pageLabel?: string | null;
}): Crumb[] {
  const { pathname, search } = input;
  const name = input.propertyName || "Property";
  const trail: Crumb[] = [];

  const onbProperty = pathname.match(/^\/onboarding\/([^/]+)$/);
  if (onbProperty && !RESERVED_ONBOARDING.has(onbProperty[1]!)) {
    const id = onbProperty[1]!;
    trail.push({ label: "Onboarding", to: "/onboarding" });
    trail.push({ label: name, to: `/onboarding/${id}` });
    const tab = typeof search["tab"] === "string" ? ONBOARDING_TABS[search["tab"]] : undefined;
    if (tab) trail.push({ label: tab, to: `/onboarding/${id}`, search: { tab: search["tab"] as string } });
  } else if (pathname.startsWith("/property/")) {
    trail.push({ label: "Properties", to: "/properties" });
    trail.push({ label: name, to: pathname });
  } else {
    const dept = departmentFor(pathname);
    if (dept) {
      trail.push({ label: dept.label, to: dept.home });
      const sub = SUBPAGE_LABELS[pathname];
      if (sub && pathname !== dept.home) trail.push({ label: sub, to: pathname });
    }
  }

  if (input.pageLabel && trail.length) {
    const last = trail[trail.length - 1]!;
    if (last.label !== input.pageLabel) trail.push({ label: input.pageLabel, to: pathname });
  }
  return trail;
}

/** The logical parent of the current page: the crumb before the last one. */
export function parentOf(trail: Crumb[]): Crumb | null {
  return trail.length >= 2 ? trail[trail.length - 2]! : null;
}
