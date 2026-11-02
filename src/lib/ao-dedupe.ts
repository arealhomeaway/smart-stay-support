/**
 * Active Owner card de-duplication: screen rules only. The database decides what is
 * covered and blocks repeats (private.ao_card_coverage, private.ao_guard_owner_item).
 */

export const COVERED_REASON_LABEL: Record<string, string> = {
  linked_task: "This home already has an owner item for the linked step",
  same_task_other_card: "Another card on this plan uses the same step",
  confirmed_map: "Matches an existing owner item you confirmed",
  staff_marked: "Marked as covered by staff",
};

export function coveredReasonLabel(reason: string | null | undefined, itemTitle?: string | null): string {
  const base = COVERED_REASON_LABEL[reason ?? ""] ?? "Already covered";
  return itemTitle ? `${base}: ${itemTitle}` : base;
}

/** True when a send was refused because the home's plan already has this card. */
export function isCardExistsError(message: string | null | undefined): boolean {
  return /already has ".*" on its Active Owner plan/.test(message ?? "");
}

export const ONE_OFF_ACTION = "Send a different one-off";

export const LOCK_SUGGESTION_LABEL: Record<string, string> = {
  open_day_one: "Switch to Open on day one",
  unlock_now_only: "Keep locked; open with Unlock now only",
};

export type MapRow = { id: string; match_kind: string; match_value: string; card_code: string; status: string; note: string };
export type LinkSuggestionRow = {
  id: string; card_code: string; suggestion_kind: "link" | "lock"; template_task_ids: string[];
  proposed_lock: string | null; confidence: string; note: string; status: string;
};

/** Plain wording for a map entry, e.g. 'Title contains "readiness call"'. */
export function describeMatch(m: Pick<MapRow, "match_kind" | "match_value">, templateTitles: Record<string, string> = {}): string {
  if (m.match_kind === "template_id") return `Owner item from "${templateTitles[m.match_value] ?? "a saved template"}"`;
  return `Title contains "${m.match_value.replace(/^%|%$/g, "")}"`;
}
