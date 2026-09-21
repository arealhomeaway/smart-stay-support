/**
 * Who owns an onboarding task the moment the project is created.
 *
 * ARHA's plan already names a role on every step ("Project Manager",
 * "Onboarding Manager", …). Those names are job descriptions, not employees,
 * so Resolve maps them onto functional SEATS (`functional_roles.code`) and
 * resolves the person from whoever holds the seat today. A staffing change
 * moves the work; it does not orphan 180 tasks.
 *
 * Explicit reassignment on an individual task always wins — this only decides
 * where a task starts.
 */

export type SeatCode =
  | "director_onboarding"
  | "project_manager"
  | "director_ops"
  | "ops_supervisor"
  | "cfo_owner_liaison"
  | "po_day";

/** The template's own role strings, mapped to seats. */
export const TEMPLATE_ROLE_TO_SEAT: Record<string, SeatCode> = {
  "Onboarding Manager": "director_onboarding",
  "Project Manager": "project_manager",
  "Onboarding Admin": "project_manager",
  "Utilities Coordinator": "project_manager",
  "Lead Designer": "project_manager",
  // Master Onboarding sequence roles.
  "Director of Onboarding": "director_onboarding",
  "Assigned Project Manager": "project_manager",
  "Contract Designer": "project_manager",
  "Compliance Coordinator": "project_manager",
  "Onboarding Field Support": "project_manager",
  "Finance / AR-AP": "cfo_owner_liaison",
  "Director of Operations": "director_ops",
  "Operations Supervisor": "ops_supervisor",
  "Property Coordinator": "po_day",
  // Owner steps are shepherded by the assigned PM; the owner is not a seat.
  Owner: "project_manager",
};

/**
 * Stage-level fallback for any task whose role string is missing or unknown.
 * Handoff belongs to Operations, per the Aug 31 decision.
 */
export const STAGE_DEFAULT_SEAT: Record<string, SeatCode> = {
  post_contract: "director_onboarding",
  phase1_inspection: "project_manager",
  phase2_estimates: "project_manager",
  phase3_work_orders: "project_manager",
  phase4_purchasing: "project_manager",
  phase5_monitor: "project_manager",
  phase6_handoff: "director_ops",
  intake_identity: "director_onboarding",
  documents_assessment: "project_manager",
  scope_utilities_compliance: "project_manager",
  design_approvals_procurement: "project_manager",
  fieldwork_setup_review: "project_manager",
  listing_final_clean: "project_manager",
  handoff_acceptance: "director_ops",
  closeout_stabilization: "project_manager",
};

export const FINAL_FALLBACK_SEAT: SeatCode = "director_onboarding";

/** Resolve the owning seat for one template row. */
export function seatForTask(input: {
  role?: string | null;
  stage: string;
  blocksHandoff?: boolean;
}): SeatCode {
  const byRole = input.role ? TEMPLATE_ROLE_TO_SEAT[input.role.trim()] : undefined;
  if (byRole) return byRole;
  return STAGE_DEFAULT_SEAT[input.stage] ?? FINAL_FALLBACK_SEAT;
}

/** Human label for a seat, for interfaces that show ownership. */
export const SEAT_LABELS: Record<SeatCode, string> = {
  director_onboarding: "Director of Onboarding",
  project_manager: "Project Manager",
  director_ops: "Director of Operations",
  ops_supervisor: "Operations Supervisor",
  cfo_owner_liaison: "CFO / Owner Liaison",
  po_day: "Operations Staff",
};
