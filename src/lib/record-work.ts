import { resolveWorkType, situationById, type Situation } from "./situations";
import { classifyTicketText } from "./ticket-classify";
import type { AppRole } from "./permissions";
import { guessMaintenanceCategory, type EntryKind } from "./work-entry";
import { mechanicalPriority, URGENCY_NAMES } from "./tickets";

export function canOverrideRecordWorkType(roles: readonly AppRole[]) {
  return roles.includes("admin") || roles.includes("manager");
}

export function situationEntryKind(id: string): "ops" | "maintenance" {
  return ["unsafe", "broken_now", "broken_later"].includes(id) ? "maintenance" : "ops";
}

/** Carry the entire draft, changing only the existing situation prefills. */
export function applyRecordWorkSituation<T extends {
  situation_id: string; work_type_id: string; guest_impact: string; occupancy_status: string;
}, W extends { id: string; name: string }>(draft: T, id: string, catalog: W[] | undefined): T {
  const situation = situationById(id);
  const workType = resolveWorkType(situation, catalog);
  return {
    ...draft,
    situation_id: id,
    work_type_id: workType?.id ?? "",
    guest_impact: situation?.guestImpact ?? draft.guest_impact,
    occupancy_status: situation?.occupancy ?? draft.occupancy_status,
  };
}

/** Suggestions stop after a manual choice and never replace a maintenance draft with Ops. */
export function suggestedRecordWorkSituation(text: string, touched: boolean, mode: EntryKind | null) {
  if (touched || (mode !== "ops" && mode !== "maintenance")) return null;
  const guess = classifyTicketText(text);
  if (mode === "maintenance" && guess && situationEntryKind(guess.situation.id) !== "maintenance") return null;
  return guess;
}

/* ------------------------------------------------------------------ */
/* Record work as one flow (register T8, T9, T10, T11).                */
/* ------------------------------------------------------------------ */

export type RepairAnswer = "yes" | "no" | "not_sure";
export const REPAIR_WORDS: Record<RepairAnswer, string> = { yes: "Yes", no: "No", not_sure: "Not sure" };
export const NOT_SURE_PROBLEM = "Not sure yet";

export type ProblemType = {
  id: string;
  name: string;
  category?: string | null;
  default_priority?: string | null;
};

/** Words that mean the problem could be an insurance claim (flooding, fire, smoke, storm, roof, structural). */
const INSURANCE_WORDS = /\b(flood\w*|water damage|fire|smoke|storm\w*|hail|roof\w*|structural|foundation)\b/i;

export function insuranceRiskFromText(text: string | null | undefined): boolean {
  return INSURANCE_WORDS.test(String(text ?? ""));
}

/** A guest counts as in the home while the reservation is on (T9: in the home = affected). */
export function guestInHomeFrom(occupancy: string | null | undefined): boolean {
  return occupancy === "occupied" || occupancy === "same_day_departure";
}

export type Understood<W extends ProblemType> = {
  situation: Situation | null;
  workType: W | null;
  problem: string;
  repair: RepairAnswer;
  /** The stored Ops or Maintenance label, set from Repair needed at the home. */
  entryKind: "ops" | "maintenance";
  guestImpact: string;
  occupancy: string;
  priority: string;
  reason: string;
  insurance: boolean;
  maintenanceCategory: string | null;
};

/**
 * What Resolve understood from the home and the description. Pure.
 * The problem type comes from the existing text reading over the situation
 * catalog, mapped to the existing work types; Change the problem picks another
 * work type. Urgency is the existing mechanical rule with a guest in the home
 * counted as affected automatically.
 */
export function understandRecordWork<W extends ProblemType>(input: {
  text: string;
  catalog: W[] | null | undefined;
  chosenWorkTypeId?: string | null;
  occupancy?: string | null;
}): Understood<W> {
  const text = input.text ?? "";
  const guess = classifyTicketText(text);
  const fromText = guess?.situation ?? null;
  const textType = fromText && !fromText.openCatalog ? resolveWorkType(fromText, input.catalog ?? []) : null;
  const chosen = input.chosenWorkTypeId ? (input.catalog ?? []).find((w) => w.id === input.chosenWorkTypeId) ?? null : null;
  const workType = chosen ?? textType;
  // The situation's own answers (safety, ceilings) apply only while its problem type stands.
  const situation = chosen && chosen.id !== textType?.id ? null : fromText;

  const occupancy = input.occupancy ?? "vacant";
  const inHome = guestInHomeFrom(occupancy);
  const guestImpact =
    situation?.guestImpact === "safety_security" ? "safety_security" : inHome ? "active_guest_affected" : "none";

  const repair: RepairAnswer = workType ? (workType.category === "maintenance" ? "yes" : "no") : "not_sure";
  const entryKind = repair === "yes" ? "maintenance" : "ops";
  const priority = mechanicalPriority(workType?.default_priority ?? null, guestImpact, occupancy, situation?.priorityCeiling ?? null);

  const reason =
    guestImpact === "safety_security"
      ? "Urgent level is set because safety or getting into the home is at risk."
      : guestImpact === "active_guest_affected"
        ? "Urgent level is set because a guest is in the home."
        : occupancy === "same_day_arrival"
          ? "Urgent level is set because a guest arrives today."
          : workType
            ? "Urgent level is set by the problem type."
            : "Urgent level is set because the problem is not clear yet.";

  let maintenanceCategory: string | null = null;
  if (entryKind === "maintenance") {
    maintenanceCategory = guessMaintenanceCategory(text) ?? (/\b(fire|smoke)\b/i.test(text) ? "fire_smoke" : "other");
  }

  return {
    situation,
    workType,
    problem: workType?.name ?? NOT_SURE_PROBLEM,
    repair,
    entryKind,
    guestImpact,
    occupancy,
    priority,
    reason,
    insurance: insuranceRiskFromText(text),
    maintenanceCategory,
  };
}

/** Right now (P1), Today (P2), Routine (P3). */
export function urgencyWords(priority: string): string {
  const key = (["p1", "p2", "p3"].includes(priority) ? priority : "p3") as keyof typeof URGENCY_NAMES;
  return `${URGENCY_NAMES[key]} (${key.toUpperCase()})`;
}

export type RoutePreview = { who_kind: string | null; role_name?: string | null } | null | undefined;

/** The routing by time result in plain words, a role and never a person. */
export function whoWillDoIt(preview: RoutePreview, hasProblemType: boolean): string {
  const kind = preview?.who_kind ?? null;
  if (!kind) return "Checking";
  if (kind === "coordinator") return "Property Coordinator on duty";
  if (kind === "on_call") return "The person on call tonight";
  if (kind === "supervisor") return hasProblemType ? "Operations Supervisor" : "A supervisor will sort it";
  if (kind === "role") return preview?.role_name?.trim() || "The role that owns this work";
  return "A supervisor will sort it";
}

/** Appliance not working: 2 times in 90 days at this home. */
export function repeatLine(problem: string, times: number, days: number): string {
  return `${problem}: ${times} ${times === 1 ? "time" : "times"} in ${days} days at this home.`;
}

/** The home history category a one touch save is filed under. */
export function activityCategoryFor(workTypeCategory: string | null | undefined): string {
  switch (workTypeCategory) {
    case "guest":
      return "guest";
    case "access":
      return "access";
    case "maintenance":
      return "property_condition";
    case "cleaning":
      return "cleaner";
    case "admin":
      return "administrative";
    default:
      return "other";
  }
}

/** One touch stores what was done; the panel has one box, so the save says there was nothing more to do. */
export const ONE_TOUCH_OUTCOME = "Nothing more to do.";
