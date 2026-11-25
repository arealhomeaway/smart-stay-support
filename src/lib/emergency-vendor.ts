/** Emergency Only vendor rules — one place. Never Primary/Backup, never routine coverage. DB guard re-checks. */
export type EmergencyBasis = "p1" | "no_routine_vendor" | "after_hours" | "supervisor_approval" | "supervisor_override";

export const EMERGENCY_BASIS_LABELS: Record<EmergencyBasis, string> = {
  p1: "P1 Ticket",
  no_routine_vendor: "No routine vendor available",
  after_hours: "After-hours coverage needed",
  supervisor_approval: "Supervisor approval",
  supervisor_override: "Supervisor override",
};

/** Whether Emergency Only vendors appear in the picker by default. */
export function emergencyVisibleByDefault(priority: string | null | undefined, routineAvailable: number): boolean {
  if (priority === "p1") return true;
  if (priority === "p2") return routineAvailable === 0;
  return false;
}

/** Can this viewer reveal Emergency Only vendors at all? P3 needs a Supervisor. */
export function canRevealEmergency(priority: string | null | undefined, isSupervisor: boolean): boolean {
  return priority === "p1" || priority === "p2" || isSupervisor;
}

/** Bases the viewer may record when picking an Emergency Only vendor. Empty = no reason needed (P1). */
export function allowedEmergencyBases(priority: string | null | undefined, isSupervisor: boolean): EmergencyBasis[] {
  if (priority === "p1") return [];
  if (priority === "p2") return ["no_routine_vendor", "after_hours", ...(isSupervisor ? (["supervisor_approval"] as const) : [])];
  return isSupervisor ? ["supervisor_override"] : [];
}
