/**
 * Deterministic "Looks like…" classification for frontline ticket intake.
 *
 * The employee understands the problem. Resolve understands the system.
 *
 * This is pure text matching over the existing situation catalogue. It decides
 * nothing on its own: it only preselects the same situation a coordinator
 * could have picked by hand, and the intake form always shows what it chose
 * with a way to change it. Priority, SLA, routing, evidence and playbooks are
 * still produced by the existing engines.
 */

import { SITUATIONS, type Situation } from "./situations";

export type Classification = {
  situation: Situation;
  /** 0–1, higher means more distinct keyword evidence. */
  confidence: number;
  /** The keywords that matched, for an honest explanation. */
  matched: string[];
};

function normalise(text: string) {
  return ` ${text.toLowerCase().replace(/[\u2019']/g, "'").replace(/[^a-z0-9'/ ]+/g, " ").replace(/\s+/g, " ")} `;
}

/**
 * Safety language always wins: a coordinator describing smoke, gas, fire,
 * flooding or a break-in must never be classified as ordinary maintenance.
 */
const SAFETY_FIRST = "unsafe";

export function classifyTicketText(text: string | null | undefined): Classification | null {
  const raw = (text ?? "").trim();
  if (raw.length < 3) return null;
  const hay = normalise(raw);

  let best: Classification | null = null;

  for (const situation of SITUATIONS) {
    const keywords = situation.keywords ?? [];
    if (!keywords.length) continue;
    const matched = keywords.filter((k) => hay.includes(` ${normalise(k).trim()} `) || hay.includes(normalise(k)));
    if (!matched.length) continue;
    // Longer, more specific phrases carry more weight than single words.
    const weight = matched.reduce((sum, k) => sum + (k.includes(" ") ? 2 : 1), 0);
    const confidence = Math.min(1, weight / 3);
    const candidate: Classification = { situation, confidence, matched };
    if (situation.id === SAFETY_FIRST) return candidate;
    if (!best || candidate.confidence > best.confidence) best = candidate;
  }

  return best;
}

/** Plain-language sentence for what Resolve thinks it is looking at. */
export function classificationSummary(c: Classification | null) {
  if (!c) return "Tell us what happened and Resolve will classify it.";
  return c.situation.label;
}
