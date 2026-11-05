import { resolveWorkType, situationById } from "./situations";
import { classifyTicketText } from "./ticket-classify";
import type { AppRole } from "./permissions";
import type { EntryKind } from "./work-entry";

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