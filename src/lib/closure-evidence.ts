/**
 * Closure evidence, scoped to the scenario in front of the employee.
 *
 * `work_types.required_closure_evidence` is written once for a whole work type,
 * so "Immediate maintenance" carries a safety-device clause that belongs to an
 * alarm call, not to a porch railing or an under-sink leak. Asking a
 * coordinator to certify every smoke, CO and security device on an unrelated
 * repair trains people to tick boxes, which is the opposite of evidence.
 *
 * This module reads the requirement sentence and keeps only the clauses that
 * apply to the ticket actually being worked. It never adds a requirement and
 * never relaxes one that belongs to the scenario.
 */

/** Clause language that only makes sense on a safety / alarm / security job. */
const SAFETY_CLAUSE =
  /\b(smoke|carbon monoxide|\bco\b|alarm|detector|security system|security device)\b/i;

/** The ticket really is a safety scenario, so the safety clause stays. */
const SAFETY_SCENARIO =
  /\b(smoke|carbon monoxide|co alarm|co detector|alarm|detector|gas|fire|security|siren|chirp|chirping)\b/i;

export type EvidenceScenario = {
  category?: string | null;
  workTypeName?: string | null;
  /** Title + description of the ticket, as the employee wrote it. */
  text?: string | null;
};

function isSafetyScenario(scenario: EvidenceScenario): boolean {
  if (String(scenario.category ?? "").toLowerCase() === "safety") return true;
  const text = `${scenario.workTypeName ?? ""} ${scenario.text ?? ""}`;
  return SAFETY_SCENARIO.test(text);
}

/** Split a requirement sentence into the individual things it asks for. */
function clauses(requirement: string): string[] {
  return requirement
    .split(/,|;|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * The closure evidence this particular ticket must produce.
 *
 * Returns null when nothing is required once the unrelated clauses are removed.
 */
export function scopedClosureEvidence(
  requirement: string | null | undefined,
  scenario: EvidenceScenario,
): string | null {
  const raw = String(requirement ?? "").trim();
  if (!raw) return null;
  if (!SAFETY_CLAUSE.test(raw)) return raw;
  if (isSafetyScenario(scenario)) return raw;

  const kept = clauses(raw).filter((c) => !SAFETY_CLAUSE.test(c));
  if (kept.length === 0) return null;
  const joined = kept.length === 1 ? kept[0]! : `${kept.slice(0, -1).join(", ")} and ${kept.at(-1)}`;
  // Sentence case, so a kept fragment still reads like an instruction.
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
