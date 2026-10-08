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
  admin: "Platform Owner",
  manager: "Supervisor",
  onboarding: "Onboarding staff",
  tech: "Staff",
  vendor: "Vendor",
  owner: "Homeowner",
};

export const ROLE_BLURBS: Record<AppRole, string> = {
  admin: "Everything in Resolve, including roles, seats, portals, settings and audit history.",
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
  | "view_as";

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
];

const SUPERVISOR_CAPS: Capability[] = [
  ...STAFF_BASE,
  "matters_all",
  "guest_contact",
  "leads_work",
  "oversight",
  "analytics",
  "properties",
  "playbooks_edit",
  "coaching_manage",
  "records_archive",
  "handoff_review",
  "claims_oversight",
  "onboarding_workspace",
  "onboarding_templates",
  "owner_programs",
  "owner_program_admin",
  "owner_oversight",
  "homeowner_directory",
  "vendor_admin",
  "vendor_directory",
  "audit_history",
  "user_management",
  // Supervisors carry vendor work end to end, so the Work Orders workspace is
  // part of the job — not a platform-owner tool.
  "work_orders_internal",
  "cleaner_hours",
  "cleaner_dispatch_check",
];

export const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    ...SUPERVISOR_CAPS,
    "command_center",
    "role_management",
    "settings",
    "integrations",
    "handoff_request",
    "view_as",
    "str_participation_report",
    "finance_workspace",
    "active_owner_enroll",
  ],
  manager: SUPERVISOR_CAPS,
  onboarding: [...STAFF_BASE, "onboarding_workspace", "handoff_request"],
  // Operations coordinators can see current guest/tenant contact details, the
  // shared Team Queue, and the work orders attached to what they are running.
  tech: [...STAFF_BASE, "guest_contact", "work_orders_internal", "cleaner_dispatch_check", "vendor_directory"],

  vendor: [],
  owner: [],
};

/**
 * Responsibility seats that carry authority on their own, independent of the
 * broad permission role. The Onboarding Director runs the whole Onboarding
 * department without needing the leadership (`manager`) role, which would also
 * open Operations.
 */
export type AccessSeats = { onboardingDirector?: boolean; opsDirector?: boolean; finance?: boolean };

export const ONBOARDING_DIRECTOR_CAPS: Capability[] = [
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
];

export function capabilitiesFor(roles: AppRole[], seats: AccessSeats = {}): Set<Capability> {
  const set = new Set<Capability>();
  for (const role of roles) for (const cap of ROLE_CAPABILITIES[role] ?? []) set.add(cap);
  if (seats.onboardingDirector) for (const cap of ONBOARDING_DIRECTOR_CAPS) set.add(cap);
  if (seats.opsDirector) {
    set.add("str_participation_report");
    set.add("vendor_admin");
    set.add("finance_workspace");
  }
  if (seats.finance) set.add("finance_workspace");
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
