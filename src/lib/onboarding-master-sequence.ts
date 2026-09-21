/**
 * The ARHA Master Onboarding sequence — 26 steps across 8 operational stages,
 * with the named role that owns each step.
 *
 * This is the control spine of an onboarding project. The detailed Full
 * Furnishing plan (see onboarding-template.ts) is the execution work that
 * happens underneath it; this file states the sequence, who owns each step,
 * and where the authority gates sit.
 *
 * The control sequence, which nothing may shortcut:
 *   Assigned PM completes the work
 *     -> Kati Hand approves onboarding readiness (step 20)
 *     -> Micah Sinor approves operational readiness (step 21)
 *     -> Operations formally accepts the property (step 22)
 *     -> James Almario confirms Live (step 23).
 *
 * Data only. Nothing here reads or writes.
 */

export const ONBOARDING_ROLE_CODES = [
  "director_onboarding",
  "assigned_pm",
  "utilities_coordinator",
  "contract_designer",
  "compliance_coordinator",
  "finance_ar_ap",
  "field_support",
  "director_operations",
  "ops_supervisor",
  "property_coordinator",
  "owner",
] as const;

export type OnboardingRoleCode = (typeof ONBOARDING_ROLE_CODES)[number];

export type OnboardingRole = {
  code: OnboardingRoleCode;
  title: string;
  /** Who holds this role today, as ARHA names it. */
  holder: string;
  responsibility: string;
};

export const ONBOARDING_ROLES: OnboardingRole[] = [
  {
    code: "director_onboarding",
    title: "Director of Onboarding",
    holder: "Kati Hand",
    responsibility:
      "Department standards, staffing, portfolio oversight, owner relationship before handoff, exceptions, and final onboarding approval",
  },
  {
    code: "assigned_pm",
    title: "Assigned Project Manager",
    holder: "Iveth, Sofia, Joan, or another assigned PM",
    responsibility: "End-to-end execution of the individual property onboarding project",
  },
  {
    code: "utilities_coordinator",
    title: "Utilities Coordinator",
    holder: "Sofia Alvarez",
    responsibility: "Utility setup and tracking across all onboarding properties",
  },
  {
    code: "contract_designer",
    title: "Contract Designer",
    holder: "Paula, Jacqueline, Jackie, or assigned designer",
    responsibility: "Design, furniture, layout, and assigned design deliverables",
  },
  {
    code: "compliance_coordinator",
    title: "Compliance Coordinator",
    holder: "Kade",
    responsibility: "HOA, permits, rental restrictions, licensing, and compliance requirements",
  },
  {
    code: "finance_ar_ap",
    title: "Finance / AR-AP",
    holder: "K.D., under James Miller",
    responsibility:
      "Payments, reimbursements, invoices, reconciliation, and financial exceptions",
  },
  {
    code: "field_support",
    title: "Onboarding Field Support",
    holder: "Elizabeth or assigned vendors",
    responsibility:
      "Cleaning, staging support, inspections, installations, and field verification",
  },
  {
    code: "director_operations",
    title: "Director of Operations",
    holder: "Micah Sinor",
    responsibility: "Operational-readiness review and approval",
  },
  {
    code: "ops_supervisor",
    title: "Operations Supervisor",
    holder: "James Almario",
    responsibility: "Operations acceptance coordination and final Live confirmation",
  },
  {
    code: "property_coordinator",
    title: "Property Coordinator",
    holder: "Assigned PC",
    responsibility:
      "Post-acceptance property setup verification, guest-facing readiness, and early operational support",
  },
  {
    code: "owner",
    title: "Owner",
    holder: "Property owner",
    responsibility:
      "Documents, funding, approvals, access, decisions, and required corrective action",
  },
];

export function onboardingRole(code: OnboardingRoleCode): OnboardingRole {
  return ONBOARDING_ROLES.find((r) => r.code === code)!;
}

export const MASTER_STAGE_VALUES = [
  "intake_identity",
  "documents_assessment",
  "scope_utilities_compliance",
  "design_approvals_procurement",
  "fieldwork_setup_review",
  "listing_final_clean",
  "handoff_acceptance",
  "closeout_stabilization",
] as const;

export type MasterStage = (typeof MASTER_STAGE_VALUES)[number];

export const MASTER_STAGES: {
  value: MasterStage;
  number: number;
  label: string;
  steps: [number, number];
}[] = [
  { value: "intake_identity", number: 1, label: "Stage 1 — Intake & Identity", steps: [1, 2] },
  {
    value: "documents_assessment",
    number: 2,
    label: "Stage 2 — Documents & Assessment",
    steps: [3, 5],
  },
  {
    value: "scope_utilities_compliance",
    number: 3,
    label: "Stage 3 — Scope, Utilities & Compliance",
    steps: [6, 8],
  },
  {
    value: "design_approvals_procurement",
    number: 4,
    label: "Stage 4 — Design, Approvals & Procurement",
    steps: [9, 11],
  },
  {
    value: "fieldwork_setup_review",
    number: 5,
    label: "Stage 5 — Fieldwork, Setup & Mid-Project Review",
    steps: [12, 16],
  },
  {
    value: "listing_final_clean",
    number: 6,
    label: "Stage 6 — Listing Setup & Final Clean",
    steps: [17, 18],
  },
  {
    value: "handoff_acceptance",
    number: 7,
    label: "Stage 7 — Handoff Readiness & Operational Acceptance",
    steps: [19, 23],
  },
  {
    value: "closeout_stabilization",
    number: 8,
    label: "Stage 8 — Financial Closeout & Launch Stabilization",
    steps: [24, 26],
  },
];

/** The authority gates. A gate is passed by its named role, never by the PM. */
export type MasterGate =
  | "pm_readiness_package"
  | "onboarding_approval"
  | "operational_readiness"
  | "operations_acceptance"
  | "live_activation"
  | "project_closure";

export type MasterStep = {
  number: number;
  key: string;
  title: string;
  stage: MasterStage;
  /** Role that owns the step, first entry is the accountable role. */
  roles: OnboardingRoleCode[];
  /** Who does this, exactly as the onboarding department states it. */
  who: string;
  blocksHandoff: boolean;
  requiresOwnerApproval?: boolean;
  evidenceRequired?: boolean;
  gate?: MasterGate;
};

export const MASTER_STEPS: MasterStep[] = [
  {
    number: 1,
    key: "master_receive_property",
    title: "Receive the property from Business Development or DFY",
    stage: "intake_identity",
    roles: ["director_onboarding", "assigned_pm"],
    who: "Kati and assigned PM",
    blocksHandoff: true,
  },
  {
    number: 2,
    key: "master_create_validate_property_record",
    title: "Create and validate the property record",
    stage: "intake_identity",
    roles: ["assigned_pm"],
    who: "Assigned PM",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 3,
    key: "master_collect_owner_documents",
    title: "Collect owner documents, access, and initial decisions",
    stage: "documents_assessment",
    roles: ["assigned_pm", "owner"],
    who: "Assigned PM",
    blocksHandoff: true,
  },
  {
    number: 4,
    key: "master_verify_required_documents",
    title: "Verify the required documents",
    stage: "documents_assessment",
    roles: ["assigned_pm", "compliance_coordinator", "finance_ar_ap"],
    who: "Assigned PM; Kade for compliance; K.D./James Miller for financial",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 5,
    key: "master_initial_property_assessment",
    title: "Complete the initial property assessment",
    stage: "documents_assessment",
    roles: ["assigned_pm", "field_support"],
    who: "Assigned PM with Elizabeth/field support",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 6,
    key: "master_build_scope_plan_budget",
    title: "Build the onboarding scope, plan, and budget",
    stage: "scope_utilities_compliance",
    roles: ["assigned_pm"],
    who: "Assigned PM",
    blocksHandoff: true,
  },
  {
    number: 7,
    key: "master_begin_utility_setup",
    title: "Begin utility setup",
    stage: "scope_utilities_compliance",
    roles: ["utilities_coordinator"],
    who: "Sofia Alvarez, Utilities Coordinator",
    blocksHandoff: true,
  },
  {
    number: 8,
    key: "master_compliance_hoa_review",
    title: "Conduct compliance and HOA review",
    stage: "scope_utilities_compliance",
    roles: ["compliance_coordinator"],
    who: "Kade, Compliance Coordinator",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 9,
    key: "master_issue_design_assignment",
    title: "Issue the design assignment",
    stage: "design_approvals_procurement",
    roles: ["assigned_pm", "contract_designer"],
    who: "Assigned PM; Designer Paula/Jacqueline/Jackie completes",
    blocksHandoff: true,
  },
  {
    number: 10,
    key: "master_owner_decisions_approvals",
    title: "Obtain owner decisions and approvals",
    stage: "design_approvals_procurement",
    roles: ["assigned_pm", "director_onboarding", "owner"],
    who: "Assigned PM; Kati on sensitive items",
    blocksHandoff: true,
    requiresOwnerApproval: true,
  },
  {
    number: 11,
    key: "master_procure_furnishings_supplies",
    title: "Procure furnishings, supplies, and approved services",
    stage: "design_approvals_procurement",
    roles: ["assigned_pm", "finance_ar_ap"],
    who: "Assigned PM with K.D. support",
    blocksHandoff: true,
  },
  {
    number: 12,
    key: "master_coordinate_repairs_fieldwork",
    title: "Coordinate repairs, installations, and fieldwork",
    stage: "fieldwork_setup_review",
    roles: ["assigned_pm", "field_support"],
    who: "Assigned PM; vendors/field support Elizabeth",
    blocksHandoff: true,
  },
  {
    number: 13,
    key: "master_new_house_setup_review",
    title: "Complete New House Setup review",
    stage: "fieldwork_setup_review",
    roles: ["assigned_pm", "contract_designer", "field_support"],
    who: "Assigned PM with Designer & field support",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 14,
    key: "master_pre_work_review",
    title: "Complete Pre-Work review",
    stage: "fieldwork_setup_review",
    roles: ["assigned_pm"],
    who: "Assigned PM",
    blocksHandoff: true,
  },
  {
    number: 15,
    key: "master_standard_installation_safety_review",
    title: "Complete Standard installation and safety review",
    stage: "fieldwork_setup_review",
    roles: ["assigned_pm", "field_support"],
    who: "Assigned PM with field support",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 16,
    key: "master_mid_project_review",
    title: "Conduct the Mid-Project Review",
    stage: "fieldwork_setup_review",
    roles: ["assigned_pm", "director_onboarding"],
    who: "Assigned PM; Kati reviews exceptions",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 17,
    key: "master_build_listing_property_information",
    title: "Build the listing and operational property information",
    stage: "listing_final_clean",
    roles: ["assigned_pm", "contract_designer"],
    who: "Assigned PM with Operations/design",
    blocksHandoff: true,
  },
  {
    number: 18,
    key: "master_final_clean_guest_readiness",
    title: "Complete the final clean, staging, and guest-readiness assessment",
    stage: "listing_final_clean",
    roles: ["field_support", "assigned_pm"],
    who: "Cleaning vendor/field support Elizabeth; verified by PM",
    blocksHandoff: true,
    evidenceRequired: true,
  },
  {
    number: 19,
    key: "master_pm_readiness_package",
    title: "Assemble the PM readiness package",
    stage: "handoff_acceptance",
    roles: ["assigned_pm"],
    who: "Assigned PM — submits to the Director of Onboarding; the PM cannot approve their own handoff",
    blocksHandoff: true,
    evidenceRequired: true,
    gate: "pm_readiness_package",
  },
  {
    number: 20,
    key: "master_director_onboarding_review",
    title: "Conduct the Director of Onboarding review",
    stage: "handoff_acceptance",
    roles: ["director_onboarding"],
    who: "Kati Hand",
    blocksHandoff: true,
    gate: "onboarding_approval",
  },
  {
    number: 21,
    key: "master_operational_readiness_review",
    title: "Conduct the Operational Readiness Review",
    stage: "handoff_acceptance",
    roles: ["director_operations"],
    who: "Micah Sinor",
    blocksHandoff: true,
    gate: "operational_readiness",
  },
  {
    number: 22,
    key: "master_operations_acceptance",
    title: "Complete formal Operations acceptance",
    stage: "handoff_acceptance",
    roles: ["ops_supervisor"],
    who: "James Almario and receiving Operations team",
    blocksHandoff: true,
    gate: "operations_acceptance",
  },
  {
    number: 23,
    key: "master_confirm_systems_activate_live",
    title: "Confirm systems and activate Live status",
    stage: "handoff_acceptance",
    roles: ["ops_supervisor", "property_coordinator"],
    who: "James Almario or designated Ops Supervisor with assigned PC",
    blocksHandoff: true,
    evidenceRequired: true,
    gate: "live_activation",
  },
  {
    number: 24,
    key: "master_reconcile_onboarding_costs",
    title: "Reconcile onboarding costs and close financial items",
    stage: "closeout_stabilization",
    roles: ["assigned_pm", "finance_ar_ap"],
    who: "Assigned PM, K.D., James Miller",
    blocksHandoff: false,
  },
  {
    number: 25,
    key: "master_close_onboarding_project",
    title: "Close the onboarding project",
    stage: "closeout_stabilization",
    roles: ["assigned_pm", "director_onboarding"],
    who: "Assigned PM, approved by Kati",
    blocksHandoff: false,
    gate: "project_closure",
  },
  {
    number: 26,
    key: "master_monitor_launch_stabilization",
    title: "Monitor the launch-stabilization period",
    stage: "closeout_stabilization",
    roles: ["property_coordinator", "ops_supervisor", "director_operations"],
    who: "Assigned PC and James Almario, Micah oversight",
    blocksHandoff: false,
  },
];

/** The rules the sequence exists to enforce, in the words the department uses. */
export const MASTER_SEQUENCE_RULES = [
  "Received is not the same as verified.",
  "Completed is not the same as approved.",
  "Approved is not the same as accepted.",
  "Accepted is not the same as Live.",
  "The PM cannot approve their own handoff — step 19 submits to Kati, step 20 is Kati's review, step 21 is Micah's review, steps 22–23 are Operations acceptance and Live activation.",
  "Exceptions and carryover work automatically convert into Operations tickets on handoff.",
] as const;

export function masterStepsForStage(stage: MasterStage): MasterStep[] {
  return MASTER_STEPS.filter((s) => s.stage === stage);
}

export function masterStep(number: number): MasterStep | null {
  return MASTER_STEPS.find((s) => s.number === number) ?? null;
}

export function masterStepByKey(key: string): MasterStep | null {
  return MASTER_STEPS.find((s) => s.key === key) ?? null;
}

export function masterStageFor(stepNumber: number): MasterStage | null {
  return masterStep(stepNumber)?.stage ?? null;
}

export function masterStageLabel(stage: string): string | null {
  return MASTER_STAGES.find((s) => s.value === stage)?.label ?? null;
}

/**
 * Who may sign off a step. An approval gate belongs to its named role only —
 * the assigned PM is deliberately excluded from every gate after step 19, so
 * "the checklist is done" can never mean "the property is live".
 */
export function canApproveStep(step: MasterStep, role: OnboardingRoleCode): boolean {
  if (!step.gate) return step.roles.includes(role);
  if (role === "assigned_pm") return step.gate === "pm_readiness_package";
  return step.roles.includes(role);
}
