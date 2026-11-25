/**
 * Homeowner card answers that reach a person (Nov 25): during onboarding the home's Project
 * Manager, after handoff the Active Owner follow-up role (its cover first). Same routing as
 * owner follow-ups (routeFollowUp). In-app only. Pure and browser-safe.
 */
import { routeFollowUp } from "./owner-behind";

export const ANSWER_DAYS = 14;

export type AnswerHome = {
  propertyId: string;
  project: { project_manager: string | null; director: string | null; ops_accepted_at: string | null; status: string } | null;
};

/** Who an answer on this home goes to. */
export function answerRecipient(home: AnswerHome, seat: { holder: string | null; cover: string | null; onboardingDirector: string | null }): string | null {
  const p = home.project;
  const inOnboarding = Boolean(p && !p.ops_accepted_at && !["completed", "archived", "cancelled"].includes(p.status));
  return routeFollowUp({
    inOnboarding,
    projectManager: p?.project_manager ?? null,
    onboardingDirector: p?.director ?? seat.onboardingDirector,
    followupSeatHolder: seat.holder,
    followupCover: seat.cover,
  }).assignee;
}

/** The answer text in one line, every value kept (links stay whole). */
export function answerText(values: unknown): string {
  if (!values || typeof values !== "object") return "";
  const parts: string[] = [];
  for (const v of Object.values(values as Record<string, unknown>)) {
    if (v == null || v === "") continue;
    if (Array.isArray(v)) parts.push(v.map(String).join(", "));
    else if (typeof v === "object") continue;
    else parts.push(v === true ? "Yes" : v === false ? "No" : String(v));
  }
  return parts.join(" · ").replace(/\s+/g, " ").trim();
}
