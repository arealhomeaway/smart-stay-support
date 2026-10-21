/**
 * Where each of the detailed Full Furnishing tasks belongs in the eight
 * operational stages.
 *
 * The task itself never changes — same title, same detail, same role, same
 * anchor, same order. Only the heading it sits under moves, so the plan reads
 * as one 26-step sequence with the granular work filed beneath the stage it
 * actually serves.
 *
 * Mapping is by the task's old phase, with named exceptions for work that
 * plainly belongs elsewhere (utilities, compliance, design, listing and
 * marketing, financial closeout).
 */
import type { MasterStage } from "./onboarding-master-sequence";

export const LEGACY_STAGES = [
  "post_contract",
  "phase1_inspection",
  "phase2_estimates",
  "phase3_work_orders",
  "phase4_purchasing",
  "phase5_monitor",
  "phase6_handoff",
] as const;

export type LegacyStage = (typeof LEGACY_STAGES)[number];

export function isLegacyStage(stage: string): stage is LegacyStage {
  return (LEGACY_STAGES as readonly string[]).includes(stage);
}

/** The stage a phase's work lands in when nothing more specific applies. */
const DEFAULT_BY_PHASE: Record<LegacyStage, MasterStage> = {
  post_contract: "intake_identity",
  phase1_inspection: "documents_assessment",
  phase2_estimates: "design_approvals_procurement",
  phase3_work_orders: "fieldwork_setup_review",
  phase4_purchasing: "design_approvals_procurement",
  phase5_monitor: "fieldwork_setup_review",
  phase6_handoff: "handoff_acceptance",
};

/** Checked in order; the first match wins. */
const RULES: { stage: MasterStage; match: RegExp }[] = [
  // Utilities, permits, HOA and rental restrictions.
  {
    stage: "scope_utilities_compliance",
    match:
      /\b(utilit|internet|cox|electric|gas service|water\/sewer|trash service|str permit|str requirement|permit|compliance|rental restriction|covenant|pma)\b/i,
  },
  // Design work is design, even when the task talks about its budget.
  {
    stage: "design_approvals_procurement",
    match: /\b(design|mood ?boards?)\b/i,
  },
  // Scope, estimates and budget.
  {
    stage: "scope_utilities_compliance",
    match: /\b(estimate|cost projection|budget)\b/i,
  },
  // Design, owner approvals and buying.
  {
    stage: "design_approvals_procurement",
    match:
      /\b(design|mood board|houzz|blinds|purchase|order (custom|supplies|appliance)|procure|furnishings|appliances|mattress)\b/i,
  },
  // Listing, marketing, photos and the final clean.
  {
    stage: "listing_final_clean",
    match:
      /\b(photo|photos|marketing|ownerrez|pricelabs|airbnb|vrbo|listing|truvi|default cleaner|trash valet|lawn maintenance schedule|breezeway)\b/i,
  },
  // Money and post-launch.
  {
    stage: "closeout_stabilization",
    match: /\b(invoice|invoices|accounting|sales tax|property costs|reconcil)\b/i,
  },
  // Onsite work, installs, inspections, staging and cleaning.
  {
    stage: "fieldwork_setup_review",
    match:
      /\b(Work Order|install|inspection|staging|stage decor|clean|paint|carpet|landscap|pest|assembly|unbox|linens|repair work)\b/i,
  },
  // The handoff meeting and everything around it.
  {
    stage: "handoff_acceptance",
    match: /\b(handoff|portal link|synced)\b/i,
  },
];

/** The operational stage a detailed task belongs to. */
export function masterStageForLegacyTask(stage: string, title: string): MasterStage | null {
  if (!isLegacyStage(stage)) return null;
  // The compliance/utility and money rules outrank a phase default; the
  // fieldwork rule never pulls late handoff work back into the field.
  for (const rule of RULES) {
    if (!rule.match.test(title)) continue;
    if (
      rule.stage === "fieldwork_setup_review" &&
      stage === "phase6_handoff"
    )
      continue;
    return rule.stage;
  }
  return DEFAULT_BY_PHASE[stage];
}
