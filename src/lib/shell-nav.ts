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
      { label: "Dashboard", to: "/onboarding", exact: true },
      { label: "Properties", to: "/onboarding", search: { lens: "all" }, exact: true },
      { label: "My Work", to: "/onboarding/my-work" },
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
      { label: "Participation insight", to: "/owner-analytics" },
      { label: "Optional Opportunity Library", to: "/owner-library", capability: "owner_programs" },
    ],
  },
];

export function departmentFor(pathname: string): Department | null {
  return DEPARTMENTS.find((d) => d.match(pathname)) ?? null;
}

/** Last path segment → page label for department sub-pages. */
const SUBPAGE_LABELS: Record<string, string> = {
  "/onboarding/my-work": "My Work",
  "/onboarding/team": "Team",
  "/onboarding/templates": "Workflow Templates",
  "/onboarding/utilities": "Utilities & Accounts",
  "/onboarding/transitions": "Transitions",
  "/owner-oversight": "Program oversight",
  "/owner-analytics": "Participation insight",
  "/homeowners": "Homeowners",
  "/owner-library": "Optional Opportunity Library",
};

const ONBOARDING_TABS: Record<string, string> = {
  work: "Tasks",
  property: "Property Details",
  handoff: "Handoff",
  files: "Files & History",
};

const RESERVED_ONBOARDING = new Set(["my-work", "team", "templates", "utilities", "transitions"]);

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
