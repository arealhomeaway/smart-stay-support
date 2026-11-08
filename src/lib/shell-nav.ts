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
  /** Feature switch that must be on (Admin, Workflow controls). Unknown switches count as off. */
  flag?: string;
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
      { label: "Handoff standard", to: "/onboarding/handoff-standard" },
    ],
  },
  {
    key: "active-owner",
    label: "Active Owner",
    home: "/owner-programs",
    match: (p) =>
      ["/owner-programs", "/owner-oversight", "/owner-analytics", "/homeowners", "/owner-library", "/owner-handoff-plan", "/active-owner-followup", "/owner-card-library", "/owner-contributions", "/owner-report-wording", "/str-dispatch-check"].some(
        (r) => p === r || p.startsWith(r + "/"),
      ),
    links: [
      { label: "Programs", to: "/owner-programs", capability: "owner_programs" },
      { label: "Program oversight", to: "/owner-oversight", capability: "owner_oversight" },
      { label: "Homeowners", to: "/homeowners", capability: "homeowner_directory" },
      { label: "Participation insight", to: "/owner-analytics", capability: "owner_program_admin" },
      { label: "Optional Opportunity Library", to: "/owner-library", capability: "owner_program_admin" },
      { label: "After handoff plan", to: "/owner-handoff-plan", capability: "owner_programs" },
      { label: "Active Owner follow-up", to: "/active-owner-followup", capability: "owner_programs" },
      { label: "Card library", to: "/owner-card-library", capability: "owner_card_library" },
      { label: "Homeowner contributions", to: "/owner-contributions", capability: "owner_programs" },
      { label: "Report wording", to: "/owner-report-wording", capability: "owner_program_admin" },
      { label: "Cleaner hours check", to: "/str-dispatch-check", capability: "cleaner_dispatch_check" },
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
    key: "oversight",
    match: (p) => p === "/oversight" || p === "/supervisor-check",
    tabs: [
      { label: "Oversight", to: "/oversight", capability: "oversight" },
      { label: "Supervisor check", to: "/supervisor-check", capability: "oversight" },
    ],
  },
  {
    key: "playbooks",
    match: (p) => p === "/playbooks" || p === "/ticket-checklists",
    tabs: [
      { label: "Playbooks", to: "/playbooks", capability: "playbooks_edit" },
      { label: "Ticket checklists", to: "/ticket-checklists", capability: "playbooks_edit" },
    ],
  },
  {
    key: "bookings-leads",
    match: (p) =>
      ["/direct-bookings", "/leads", "/inquiry-sources"].some((r) => p === r || p.startsWith(r + "/")) ||
      p === "/availability-finder",
    tabs: [
      { label: "Requests", to: "/direct-bookings", capability: "direct_bookings_work" },
      { label: "Referral sources", to: "/inquiry-sources", capability: "work_orders_internal" },
      { label: "Settings", to: "/direct-bookings/settings", capability: "leads_work" },
    ],
  },
  {
    // My Work is retired (it is part of Home), so it is no longer a tab here.
    // One tab alone never shows a tab bar.
    key: "my-work",
    match: (p) => p.startsWith("/tickets") || p === "/routines",
    tabs: [{ label: "Routine Work", to: "/routines", capability: "routines" }],
  },
  {
    key: "properties",
    match: (p) =>
      p === "/properties" || p.startsWith("/property/") || p === "/map",
    tabs: [
      { label: "Properties", to: "/properties", capability: "properties" },
      { label: "Work Map", to: "/map", capability: "work_orders_internal", flag: "work_map" },
    ],
  },
  {
    key: "work-orders",
    match: (p) =>
        p === "/work-orders" || p.startsWith("/work-orders/") || p === "/vendors" || p.startsWith("/vendors/"),
    tabs: [
      { label: "Work Orders", to: "/work-orders", capability: "work_orders_internal", flag: "work_orders_page" },
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
      ["/integrations", "/audit", "/help-tickets", "/oversight-access-log", "/imported-tickets"].some(
        (r) => p === r || p.startsWith(r + "/"),
      ),
    tabs: [
      { label: "Integrations", to: "/integrations", capability: "integrations" },
      { label: "Audit History", to: "/audit", capability: "audit_history" },
      { label: "Help Tickets", to: "/help-tickets", capability: "audit_history" },
      { label: "Imported tickets", to: "/imported-tickets", capability: "audit_history" },
      { label: "Notion import", to: "/integrations/notion-import", capability: "integrations" },
    ],
  },
];

export function pageTabGroupFor(pathname: string): PageTabGroup | null {
  return PAGE_TAB_GROUPS.find((g) => g.match(pathname)) ?? null;
}

/** What the menu and tab bar need to know about the person looking at them. */
export type NavAccess = {
  can: (capability: Capability) => boolean;
  canOpen: (pathname: string) => boolean;
  /** Guest Experience and Reservations team members may also open old Leads. */
  guestExperienceSeat?: boolean;
  /** Feature switches. Missing means every switch counts as off. */
  flagEnabled?: (key: string) => boolean;
};

const flagOn = (access: NavAccess, flag?: string) => !flag || Boolean(access.flagEnabled?.(flag));

/** Tabs this person sees on a grouped page. */
export function visiblePageTabs(group: PageTabGroup, access: NavAccess): DepartmentLink[] {
  return group.tabs.filter(
    (t) =>
      flagOn(access, t.flag) &&
      (!t.capability ||
        access.can(t.capability) ||
        // The team exception covers old Leads only, never Direct Bookings settings.
        (t.capability === "leads_work" && t.to === "/leads" && Boolean(access.guestExperienceSeat))) &&
      access.canOpen(t.to),
  );
}

/** Pages the one "Direct Bookings" menu item stands for. */
export const DIRECT_BOOKINGS_MENU_PATHS = ["/direct-bookings", "/leads", "/inquiry-sources", "/availability-finder"];

/**
 * Where the one "Direct Bookings" menu item opens for this person, or null
 * when they see no item. Requests first; the old pages only for people who
 * could open them before and cannot open Requests.
 */
export function directBookingsMenuTarget(access: NavAccess): string | null {
  if (access.can("direct_bookings_work") && access.canOpen("/direct-bookings")) return "/direct-bookings";
  if (access.canOpen("/leads") && (access.can("leads_work") || access.guestExperienceSeat)) return "/leads";
  if (access.canOpen("/inquiry-sources") && access.can("work_orders_internal")) return "/inquiry-sources";
  return null;
}

/* ------------------------------------------------------------------------- */
/* Left menu                                                                  */
/* ------------------------------------------------------------------------- */

export type MenuItem = {
  /** Stable name for icons and the guided tour. */
  key: string;
  label: string;
  to: string;
  search?: Record<string, string>;
  capability?: Capability;
  flag?: string;
  /** Other pages that also light up this item (its tab pages). */
  alsoActive?: string[];
};
export type MenuGroup = { label: string; items: MenuItem[] };

/** Pages that are kept but no longer shown in the menu. Reachable by direct link. */
export const OFF_MENU_PATHS = [
  "/tickets", // My Work, now part of Home
  "/map", // Work Map, a Properties tab behind the work_map switch
  "/owner-oversight", // Program oversight, in the Active Owner menu
  "/homeowners", // Homeowners, in the Active Owner menu
  "/leads",
  "/availability-finder",
] as const;

/** Where the one "Analytics" item opens: the first of these this person can open. */
export const ANALYTICS_TARGETS: { to: string; capability: Capability }[] = [
  { to: "/analytics", capability: "analytics" },
  { to: "/owner-analytics", capability: "owner_programs" },
  { to: "/cleaner-hours", capability: "cleaner_hours" },
  { to: "/finance", capability: "finance_workspace" },
  { to: "/command-center", capability: "command_center" },
];
/** Where the one "Admin" item opens: the first of these this person can open. */
export const ADMIN_TARGETS: { to: string; capability: Capability }[] = [
  { to: "/integrations", capability: "integrations" },
  { to: "/audit", capability: "audit_history" },
  { to: "/help-tickets", capability: "audit_history" },
];

const tabPaths = (key: string) =>
  (PAGE_TAB_GROUPS.find((g) => g.key === key)?.tabs ?? []).map((t) => t.to);

/**
 * The Operations menu, in order. Each item still follows the page's own
 * permission rule (capability and canOpen) and its switch, so people only
 * see what they can open.
 */
const OPERATIONS_MENU: MenuGroup[] = [
  {
    label: "My day",
    items: [
      { key: "dashboard", label: "Home", to: "/dashboard" },
      { key: "team-queue", label: "Team Queue", to: "/team-queue" },
      // Placeholder: where Direct Bookings opens is decided per person below.
      { key: "bookings-leads", label: "Direct Bookings", to: "/direct-bookings", alsoActive: DIRECT_BOOKINGS_MENU_PATHS },
      { key: "vendors", label: "Vendors", to: "/vendors", capability: "vendor_directory" },
      // Returns with the vendor portal. Work Orders stay reachable from the ticket.
      { key: "work-orders", label: "Work Orders", to: "/work-orders", capability: "work_orders_internal", flag: "work_orders_page" },
      { key: "oversight", label: "Oversight", to: "/oversight", capability: "oversight", alsoActive: ["/supervisor-check"] },
      // Stays until the page that will hold claims history exists.
      { key: "claims", label: "Guest Claims & Refunds", to: "/claims", capability: "claims_work", alsoActive: ["/recovery"] },
    ],
  },
  {
    label: "Team",
    items: [
      { key: "team", label: "Team & Coverage", to: "/team", capability: "user_management" },
      { key: "playbooks", label: "Playbooks", to: "/playbooks", capability: "playbooks_edit", alsoActive: ["/ticket-checklists"] },
    ],
  },
  {
    label: "Homes and owners",
    items: [
      { key: "properties", label: "Properties", to: "/properties", capability: "properties", alsoActive: ["/property"] },
      { key: "onboarding", label: "Onboarding", to: "/onboarding", capability: "onboarding_workspace" },
      { key: "owner-programs", label: "Active Owner", to: "/owner-programs", capability: "owner_programs" },
      { key: "quarterly", label: "Quarterly Reviews", to: "/quarterly", capability: "vendor_admin", flag: "quarterly_reviews" },
    ],
  },
];

/** The left menu for Operations staff. Pure, so who sees what is testable. */
export function operationsMenu(access: NavAccess): MenuGroup[] {
  const allowed = (i: { to: string; capability?: Capability; flag?: string }) =>
    access.canOpen(i.to) && (!i.capability || access.can(i.capability)) && flagOn(access, i.flag);
  const bookingTarget = directBookingsMenuTarget(access);
  const groups: MenuGroup[] = OPERATIONS_MENU.map((g) => ({
    label: g.label,
    items: g.items.flatMap((i) => {
      if (i.key === "bookings-leads") return bookingTarget ? [{ ...i, to: bookingTarget }] : [];
      return allowed(i) ? [i] : [];
    }),
  }));
  const first = (list: { to: string; capability: Capability }[]) =>
    list.find((c) => access.can(c.capability) && access.canOpen(c.to));
  const analytics = first(ANALYTICS_TARGETS);
  if (analytics)
    groups.push({
      label: "Insight",
      items: [{ key: "analytics", label: "Analytics", to: analytics.to, alsoActive: tabPaths("reports") }],
    });
  const admin = first(ADMIN_TARGETS);
  if (admin)
    groups.push({
      label: "Admin",
      items: [{ key: "admin", label: "Admin", to: admin.to, alsoActive: tabPaths("admin") }],
    });
  return groups.filter((g) => g.items.length > 0);
}

/**
 * The menu for onboarding-only accounts: the Onboarding department links,
 * plus one doorway into Active Owner for people who can open it.
 */
export function onboardingOnlyMenu(access: NavAccess): MenuGroup[] {
  const onboarding = DEPARTMENTS.find((d) => d.key === "onboarding")?.links ?? [];
  const groups: MenuGroup[] = [
    {
      label: "Onboarding",
      items: onboarding
        .filter((l) => !l.capability || access.can(l.capability))
        .map((l) => ({
          key: `onboarding-${l.label}`,
          label: l.label,
          to: l.to,
          ...(l.search ? { search: l.search } : {}),
        })),
    },
  ];
  if (access.can("owner_programs"))
    groups.push({
      label: "Active Owner",
      items: [{ key: "owner-programs", label: "Active Owner", to: "/owner-programs" }],
    });
  return groups;
}

/** Last path segment → page label for department sub-pages. */
const SUBPAGE_LABELS: Record<string, string> = {
  "/onboarding/my-work": "My Tasks",
  "/imported-tickets": "Imported tickets",
  "/integrations/notion-import": "Notion import",
  "/onboarding/owner-completions": "Owner Completions",
  "/onboarding/team": "Team",
  "/onboarding/templates": "Workflow Templates",
  "/onboarding/handoff-standard": "Handoff standard",
  "/owner-oversight": "Program oversight",
  "/owner-analytics": "Participation insight",
  "/homeowners": "Homeowners",
  "/owner-library": "Optional Opportunity Library",
  "/owner-handoff-plan": "After handoff plan",
  "/active-owner-followup": "Active Owner follow-up",
  "/owner-card-library": "Card library",
  "/owner-contributions": "Homeowner contributions",
  "/owner-report-wording": "Report wording",
  "/str-dispatch-check": "Cleaner hours check",
  "/str-participation-report": "Participation report",
};

const ONBOARDING_TABS: Record<string, string> = {
  work: "Tasks",
  property: "Property Details",
  handoff: "Handoff",
  files: "Files & History",
};

const RESERVED_ONBOARDING = new Set(["properties", "my-work", "team", "templates", "handoff-standard", "utilities", "transitions"]);

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

/**
 * Top bar work actions. "Record work" and "Record routine work" sit side by
 * side and follow one visibility rule: Operations staff on an Operations page.
 * Onboarding only, vendor and owner accounts never see either. The form page
 * itself hides both because the person is already recording work there.
 */
export type TopBarWorkAccess = {
  can: (capability: Capability) => boolean;
  canOpen: (pathname: string) => boolean;
  vendorMode: boolean;
  ownerMode: boolean;
  readOnly: boolean;
};

export function topBarWorkActions(
  pathname: string,
  a: TopBarWorkAccess,
): { recordWork: boolean; recordRoutine: boolean } {
  const operationsSurface =
    !departmentFor(pathname) && a.canOpen(pathname) && a.canOpen("/tickets/new");
  const recordWork =
    !a.vendorMode &&
    !a.ownerMode &&
    !a.readOnly &&
    operationsSurface &&
    a.can("ticket_create") &&
    pathname !== "/tickets/new";
  return { recordWork, recordRoutine: recordWork && a.can("routines") };
}
