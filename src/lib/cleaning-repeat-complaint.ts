import type { ChecklistTemplate } from "./ticket-checklists";

/** Manual checklist review uses the same cleaner's complaints in this window. */
export const CLEANING_REPEAT_WINDOW_DAYS = 60;

export function isRepeatCleaningComplaint(
  current: { cleanerId: string | null; at: string },
  previous: { cleanerId: string | null; at: string },
) {
  if (!current.cleanerId || current.cleanerId !== previous.cleanerId) return false;
  const elapsed = Date.parse(current.at) - Date.parse(previous.at);
  return Number.isFinite(elapsed) && elapsed > 0 && elapsed <= CLEANING_REPEAT_WINDOW_DAYS * 86400000;
}

/** Prepare a new version without modifying the seed or any published template. */
export function cleaningRepeatRevision(template: ChecklistTemplate): ChecklistTemplate {
  if (template.category !== "cleaning" || !template.steps.some((s) => s.key === "repeat")) {
    throw new Error("Cleaning checklist repeat step is missing.");
  }
  return {
    ...template,
    settings: [
      ...(template.settings ?? []).filter((s) => s.key !== "repeat_window_days"),
      { key: "repeat_window_days", label: "Repeat complaint window (days)", value: String(CLEANING_REPEAT_WINDOW_DAYS) },
    ],
    steps: template.steps.map((s) => s.key === "repeat" ? {
      ...s,
      question: "Repeat complaint within the past {repeat_window_days} days for the same cleaner? If so, flag the cleaning team lead.",
      help: "Check earlier complaints for this cleaner. This is a manual review.",
    } : s),
  };
}