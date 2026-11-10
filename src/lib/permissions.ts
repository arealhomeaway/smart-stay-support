/**
 * Resolve access model (browser-safe).
 *
 * Two dimensions, deliberately kept apart:
 *   1. Permission role  — what a person may DO (this file).
 *   2. Seat / team      — what work they OWN (functional_roles, unchanged).
 *
 * Database roles map onto business language:
 *   admin      -> Platform Owner   (internal system-wide administrator)
 *   manager    -> Supervisor       (escalation + interdepartmental routing)
 *   onboarding -> Onboarding staff (pre-handoff lifecycle work)
 *   tech       -> Staff            (assigned work only)
 *   vendor     -> Vendor           (external service provider)
 *   owner      -> Homeowner        (external property owner)
 */

export type AppRole = "admin" | "manager" | "onboarding" | "tech" | "vendor" | "owner";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Supervisor",
  onboarding: "Onboarding staff",
  tech: "Property Coordinator",
  vendor: "Vendor",
  owner: "Homeowner",
};

export const ROLE_BLURBS: Record<AppRole, string> = {
  admin: "Everything in Resolve, including roles, shifts, portals, settings and audit history.",
  manager: "Escalations, routing, oversight, analytics, coaching and playbook publishing.",
  onboarding: "Onboarding workspace, readiness checklists and handoff requests.",
  tech: "Their own work: assigned tickets, tickets and coaching.",
  vendor: "Assigned jobs, evidence, scheduling and their private scorecard.",
  owner: "Their own enrolled homes, approvals, communications and self-reported hours.",
};

export const ASSIGNABLE_ROLES: AppRole[] = [
  "admin",
  "manager",
  "onboarding",
  "tech",
  "vendor",
  "owner",
];

export type Portal = "operations" | "onboarding" | "homeowner" | "vendor" | "administration";

export const PORTALS: { value: Portal; label: string; landing: string }[] = [
  { value: "operations", label: "Operations", landing: "/dashboard" },
  { value: "onboarding", label: "Onboarding", landing: "/onboarding" },
  { value: "homeowner", label: "Homeowner", landing: "/owner-programs" },
  { value: "vendor", label: "Vendor", landing: "/vendor" },
  { value: "administration", label: "Administration", landing: "/team" },
];

/** Capability keys. Enforced server-side too — the UI only mirrors them. */
export type Capability =
  | "command_center"
  | "oversight"
  | "analytics"
  | "playbooks_edit"
  | "playbooks_view"
  | "coaching"
  | "coaching_manage"
  | "ticket_create"
  | "claims_work"
  | "claims_oversight"
  | "leads_work"
  // Direct Bookings requests (list, request page, Home "Needs you now"):
  // Operations coordinators and leadership. Settings stay on leads_work.
  | "direct_bookings_work"
  | "work_orders_internal"
  | "matters_all"
  | "routines"
  | "matters_assigned"
  | "guest_contact"
  | "properties"
  | "onboarding_workspace"
  // Authoring the onboarding plan itself: the onboarding director and platform
  // owners only. PMs work projects; they do not rewrite the plan.
  | "onboarding_templates"
  | "handoff_request"
  | "handoff_review"
  | "records_archive"
  | "user_management"
  | "role_management"
  | "settings"
  | "integrations"
  | "audit_history"
  | "owner_programs"
  // Program-wide Active Owner oversight: leadership only, because it reads
  // every enrolled homeowner's participation at once.
  | "owner_oversight"
  // The homeowner directory holds personal contact details, so it stays with
  // the people who need the whole picture.
  | "homeowner_directory"
  | "vendor_admin"
  // Vendor Directory + Profile read and vendor picker on Tickets: every Operations seat.
  | "vendor_directory"
  // Optional Opportunity Library administration and participation analytics:
  // leadership only (kept apart from owner_programs so the Onboarding
  // Director's Active Owner access does not widen into executive tools).
  | "owner_program_admin"
  // Active Owner Card library (edit/release): Admin and the Onboarding
  // Director, mirroring DB private.ao_is_editor. Supervisors may open it read-only.
  | "owner_card_library"
  // STR Cleaner Hours Safeguard monitoring: Operations leadership only.
  | "cleaner_hours"
  // STR cleaner safeguard check before dispatch: Operations coordinators and leadership.
  | "cleaner_dispatch_check"
  // STR Participation & Work Activity Report: Admin + Director of Operations only.
  | "str_participation_report"
  // Finance workspace: Finance seats, Director of Operations and Platform Owners.
  | "finance_workspace"
  // Active Owner enrollment, welcome Retry and uncertain-delivery Reconcile:
  // the Onboarding Director seat and Platform Owners only (never Supervisor alone).
  | "active_owner_enroll"
  // Team & Coverage, read only (Schedule and shifts): every internal staff
  // account. Changing the schedule stays with Operations leadership.
  | "team_schedule_view"
  // Add Operations users (Coordinator and Supervisor account types only): the
  // Operations Supervisor and the Director of Operations. Admin manages everyone.
  | "ops_user_invite"
  // Work Orders, read only: the Director of Onboarding and Project Managers.
  | "work_orders_view"
  // Finance page, read only: the Director of Onboarding.
  | "finance_view"
  // Optional Opportunity Library and Participation insight, opening the pages:
  // leadership and the Director of Onboarding. Library editing stays on
  // owner_program_admin.
  | "owner_insight_view"
  // Vendors: status (Approved or Gold), Gold Standard and compliance fields,
  // screening decisions, documents, vendor logins, imports, columns and saved
  // views. Operations leadership only; everyone else who opens Vendors sees
  // them read only.
  | "vendor_leadership"
  // Databases hub (register P3): every internal staff account opens it; what each
  // person can do in each list is decided in src/lib/databases.ts.
  | "databases"
  | "view_as"
  // Team Queue (register A6): Coordinator, Supervisor, Director of Operations, Admin.
  | "team_queue"
  // Handoffs, read only (register A1, A16; Emily, Nov 9): the Operations Supervisor
  // sees Onboarding only through this page. Operations leadership and Admin.
  | "handoffs_view"
  // Admin pages other than Help tickets (register A20, M6): Audit History, the
  // oversight access log and the old Imported tickets list. Admin only.
  | "admin_pages"
  // Help tickets (register A20): every staff member sees their own reports.
  | "help_tickets_own"
  // Add people to the Onboarding department (register A14): the Director of Onboarding.
  | "onboarding_user_invite"
  // The read only nightly Export check (register N10; Emily, Nov 9): Admin, the Operations
  // Supervisor, the Director of Operations and the Director of Onboarding. Mirrors the
  // database rule can_view_export_check.
  | "export_check";

// Creating a ticket is internal-staff work. Vendors and homeowners never get it.
const STAFF_BASE: Capability[] = [
  "matters_assigned",
  "playbooks_view",
  "coaching",
  "ticket_create",
  // Recovery work belongs to whoever handled the incident.
  "claims_work",
  // The four routine controls are everyday frontline work.
  "routines",
  // Frontline coordinators need operational read access to Property Hub.
  // Administrative property actions stay permission-controlled inside the page.
  "properties",
  // Team & Coverage Schedule, read only. Editing is checked separately.
  "team_schedule_view",
  // Databases hub: every staff account (register P3).
  "databases",
  // My reports: every staff member sees their own help tickets (register A20).
  "help_tickets_own",
];

const SUPERVISOR_CAPS: Capability[] = [
  ...STAFF_BASE,
  "matters_all",
  "guest_contact",
  "leads_work",
  "direct_bookings_work",
  "oversight",
  "analytics",
  "properties",
  "playbooks_edit",
  "coaching_manage",
  "records_archive",
  "handoff_review",
  "claims_oversight",
  // Onboarding is not part of the Operations Supervisor's work (register A1, A16;
  // Emily, Nov 9): they see it only through the read only Handoffs page.
  "handoffs_view",
  "team_queue",
  "owner_programs",
  "owner_program_admin",
  "owner_card_library",
  "owner_oversight",
  "homeowner_directory",
  "vendor_admin",
  "vendor_directory",
  "vendor_leadership",
  "audit_history",
  "user_management",
  // Supervisors carry vendor work end to end, so the Work Orders workspace is
  // part of the job — not a platform-owner tool.
  "work_orders_internal",
  "cleaner_hours",
  "cleaner_dispatch_check",
  "owner_insight_view",
];

export const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    ...SUPERVISOR_CAPS,
    "onboarding_workspace",
    "onboarding_templates",
    "admin_pages",
    "command_center",
    "role_management",
    "settings",
    "integrations",
    "handoff_request",
    "view_as",
    "str_participation_report",
    "finance_workspace",
    "active_owner_enroll",
    "export_check",
  ],
  manager: SUPERVISOR_CAPS,
  // Record routine work is Operations only (register A5), so Onboarding never gets routines.
  onboarding: [...STAFF_BASE.filter((c) => c !== "routines"), "onboarding_workspace", "handoff_request"],
  // Operations coordinators can see current guest/tenant contact details, the
  // shared Team Queue, and the Work Orders attached to what they are running.
  tech: [
    ...STAFF_BASE,
    "guest_contact",
    "work_orders_internal",
    "cleaner_dispatch_check",
    "vendor_directory",
    "direct_bookings_work",
    "team_queue",
  ],

  vendor: [],
  owner: [],
};

/**
 * Responsibility seats that carry authority on their own, independent of the
 * broad permission role. The Onboarding Director runs the whole Onboarding
 * department without needing the leadership (`manager`) role, which would also
 * open Operations.
 */
export type AccessSeats = {
  onboardingDirector?: boolean;
  opsDirector?: boolean;
  finance?: boolean;
  /** Holds or covers the Operations Supervisor role. */
  opsSupervisor?: boolean;
  /** Holds a Project Manager role (Onboarding or leadership). */
  projectManager?: boolean;
  /** Holds the Utilities role. */
  utilities?: boolean;
};

/** Team role codes that carry a permission on their own. */
export const PROJECT_MANAGER_ROLE_CODES = ["onboarding_project_manager", "project_manager"] as const;
export const UTILITIES_ROLE_CODES = ["utilities"] as const;
export const OPS_SUPERVISOR_ROLE_CODE = "ops_supervisor";

/** Turn the team role codes a person holds into the seats that grant access. */
export function seatsFromRoleCodes(codes: readonly string[]): Pick<AccessSeats, "opsSupervisor" | "projectManager" | "utilities"> {
  const has = (list: readonly string[]) => codes.some((c) => list.includes(c));
  return {
    opsSupervisor: codes.includes(OPS_SUPERVISOR_ROLE_CODE),
    projectManager: has(PROJECT_MANAGER_ROLE_CODES),
    utilities: has(UTILITIES_ROLE_CODES),
  };
}

/** Vendor editing (open and edit): Director of Onboarding, Project Manager, Utilities. Design stays out. */
const VENDOR_EDITOR_CAPS: Capability[] = ["vendor_directory", "vendor_admin"];

export const ONBOARDING_DIRECTOR_CAPS: Capability[] = [
  "playbooks_edit",
  "onboarding_workspace",
  "onboarding_templates",
  "handoff_request",
  // Stage/readiness review and Task exceptions inside Onboarding Projects.
  "handoff_review",
  // Active Owner management needed while Onboarding runs owner participation.
  "owner_programs",
  "owner_oversight",
  "homeowner_directory",
  "active_owner_enroll",
  "owner_card_library",
  ...VENDOR_EDITOR_CAPS,
  "work_orders_view",
  "team_schedule_view",
  "finance_view",
  "owner_insight_view",
  "onboarding_user_invite",
];

/**
 * Finance on a Supervisor type account (register A2: real Finance account types come
 * later). Finance has no Operations Supervisor role (held or covered), no Director role
 * and no Admin or Coordinator account, so Finance's own limits apply (register A4 to
 * A13, A18). A person who also holds the Operations Supervisor or a Director role keeps
 * that role's wider access. Mirrors whoIs in src/lib/databases.ts.
 */
export function isFinanceOnly(roles: readonly AppRole[], seats: AccessSeats = {}): boolean {
  return (
    Boolean(seats.finance) &&
    roles.includes("manager") &&
    !roles.includes("admin") &&
    !roles.includes("tech") &&
    !seats.opsSupervisor &&
    !seats.opsDirector &&
    !seats.onboardingDirector
  );
}

/** What a Supervisor type account loses when Finance is its only work role. */
const FINANCE_HIDDEN: Capability[] = [
  "ticket_create", // A5 Record work: Operations only
  "routines", // A5 Record routine work: Operations only
  "team_queue", // A6
  "oversight", // A7 Oversight and Supervisor check
  "team_schedule_view", // A13 Schedule hidden
  "work_orders_internal", // A8 view only (work_orders_view below)
  "vendor_admin", // A9 view only
  "vendor_leadership", // A9 view only
  "owner_programs", // A4, A17 no Active Owner staff pages
  "owner_oversight",
  "owner_program_admin",
  "owner_card_library",
  "homeowner_directory",
  "owner_insight_view",
  "handoffs_view", // not a Finance page
  "claims_oversight", // A10 view only
  "handoff_review", // A16 view only
  "playbooks_edit", // A15 view only
  "user_management", // A14 Finance does not add users
  "audit_history", // A20 Admin pages: Admin only; Finance keeps its own help reports
];

/** Finance's page access (register A4 to A13, A16 view, A18 edit). */
export const FINANCE_CAPS: Capability[] = [
  ...SUPERVISOR_CAPS.filter((c) => !FINANCE_HIDDEN.includes(c)),
  "work_orders_view",
  "finance_workspace",
  // A16: Finance views the Onboarding board (read only, see financeViewOnlyPath).
  "onboarding_workspace",
];

export function capabilitiesFor(roles: AppRole[], seats: AccessSeats = {}): Set<Capability> {
  const set = new Set<Capability>();
  const financeOnly = isFinanceOnly(roles, seats);
  for (const role of roles) {
    const caps = role === "manager" && financeOnly ? FINANCE_CAPS : (ROLE_CAPABILITIES[role] ?? []);
    for (const cap of caps) set.add(cap);
  }
  if (seats.onboardingDirector) for (const cap of ONBOARDING_DIRECTOR_CAPS) set.add(cap);
  // The Export check follows the person's role, never the Supervisor type account alone (N10).
  if (seats.onboardingDirector || seats.opsDirector || seats.opsSupervisor) set.add("export_check");
  if (seats.opsDirector) {
    set.add("playbooks_edit");
    set.add("str_participation_report");
    set.add("vendor_admin");
    set.add("vendor_leadership");
    set.add("finance_workspace");
    set.add("ops_user_invite");
    // The Director of Operations keeps seeing and accepting handoffs in Onboarding as before.
    set.add("onboarding_workspace");
    set.add("onboarding_templates");
  }
  if (seats.finance) {
    set.add("finance_workspace");
    // A16 (Build 9 F1): a Supervisor who also holds Finance keeps Finance's view of Onboarding.
    set.add("onboarding_workspace");
  }
  if (seats.opsSupervisor) set.add("ops_user_invite");
  if (seats.projectManager) {
    for (const cap of VENDOR_EDITOR_CAPS) set.add(cap);
    set.add("work_orders_view");
  }
  if (seats.utilities) for (const cap of VENDOR_EDITOR_CAPS) set.add(cap);
  return set;
}

export function can(roles: AppRole[], capability: Capability, seats: AccessSeats = {}) {
  return capabilitiesFor(roles, seats).has(capability);
}

/** Where a person lands after sign-in. Exception-first for leadership. */
export function landingFor(roles: AppRole[]): string {
  if (roles.includes("admin")) return "/command-center";
  if (roles.includes("manager")) return "/oversight";
  if (roles.includes("vendor") && roles.length === 1) return "/vendor";
  if (roles.includes("owner") && !roles.some((r) => r === "admin" || r === "manager")) {
    return "/owner";
  }
  if (roles.includes("onboarding") && !roles.includes("tech")) return "/onboarding";
  return "/dashboard";
}

export function primaryRole(roles: AppRole[]): AppRole {
  const order: AppRole[] = ["admin", "manager", "onboarding", "tech", "vendor", "owner"];
  return order.find((r) => roles.includes(r)) ?? "tech";
}
