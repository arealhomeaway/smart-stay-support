/** Program audit summaries/values are staff records, not an owner publication channel. */
const ACTIONS: Readonly<Record<string, string>> = {
  program_created: "ARHA created the participation program.",
  program_updated: "ARHA updated the participation program details.",
  program_activated: "ARHA activated the participation program.",
  program_completed: "ARHA completed the formal program closeout.",
  time_entry_reviewed:
    "ARHA reviewed a participation entry. See the entry for its current review status.",
};

export function ownerReportAction(event: { kind: string; created_at: string | null }) {
  const summary = Object.hasOwn(ACTIONS, event.kind) ? ACTIONS[event.kind] : undefined;
  if (!summary) return null;
  return {
    date: (event.created_at ?? "").slice(0, 10),
    kind: event.kind.replace(/_/g, " "),
    summary,
    document: "",
  };
}
