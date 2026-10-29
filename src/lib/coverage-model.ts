/**
 * The coverage model, as pure logic.
 *
 * Everything the routing engine decides is expressed here so the same rules
 * can be asserted in tests and reused by the UI. There is exactly one coverage
 * model: seats (`functional_roles`), the recurring schedule (`coverage_shifts`),
 * temporary overrides (`coverage_overrides`), the approved cross-team triage
 * windows (`coverage_triage_windows`) and the overnight roster
 * (`oncall_roster`). Nothing here keeps a second, display-only copy.
 */

export const TEAM_A = "guest_experience";
export const TEAM_B = "property_operations";

/**
 * Team & Coverage seat sections: the Ticket teams plus seat-only teams
 * (such as Operations for Active Owner follow-up) that never route Tickets.
 */
export function seatSections<T extends { value: string; label: string }>(teams: readonly T[]) {
  return [...teams.map((t) => ({ value: t.value, label: t.label })), { value: "operations", label: "Operations" }];
}

/** Operational seats and the team that owns them. */
export const SEAT_TEAMS: Record<string, string> = {
  ge_day: TEAM_A,
  ge_evening: TEAM_A,
  po_day: TEAM_B,
  po_evening: TEAM_B,
  ops_supervisor: "leadership",
};

export const SEAT_LABELS: Record<string, string> = {
  ge_day: "Guest Experience & Reservations Coordinator — Day/Weekend",
  ge_evening: "Guest Experience & Reservations Coordinator — Evening",
  po_day: "Property Operations Coordinator — Weekday Day",
  po_evening: "Property Operations Coordinator — Evening/Weekend",
  ops_supervisor: "Operations Supervisor",
};

/** The seats Breezeway-origin work belongs to by default. */
export const TEAM_B_ROLE_CODES = ["po_day", "po_evening"] as const;

export function teamOf(roleCode: string): string | null {
  return SEAT_TEAMS[roleCode] ?? null;
}

export function isTeamB(roleCode: string) {
  return teamOf(roleCode) === TEAM_B;
}

export function isTeamA(roleCode: string) {
  return teamOf(roleCode) === TEAM_A;
}

/** Whether a minute-of-day falls inside a possibly overnight window. */
export function isWithinWindow(nowMinutes: number, start: number, end: number) {
  return start > end
    ? nowMinutes >= start || nowMinutes < end
    : nowMinutes >= start && nowMinutes < end;
}

export type TriageWindow = {
  weekday: number;
  start_minute: number;
  end_minute: number;
  covers_team: string;
  role_code: string;
  active?: boolean;
};

/**
 * The approved cross-team role on duty for a team at this local moment, if any.
 * These windows are deliberate coverage, not gaps.
 */
export function triageRoleFor(
  windows: TriageWindow[],
  weekday: number,
  minutes: number,
  team: string,
): string | null {
  const hit = windows.find(
    (w) =>
      w.active !== false &&
      w.covers_team === team &&
      w.weekday === weekday &&
      isWithinWindow(minutes, w.start_minute, w.end_minute),
  );
  return hit?.role_code ?? null;
}

export const PRIORITY_WEIGHTS: Record<string, number> = { p1: 5, p2: 3, p3: 1 };

export function weightOf(priority: string | null | undefined) {
  return PRIORITY_WEIGHTS[String(priority ?? "p3")] ?? 1;
}

/**
 * Lowest weighted load wins. Ties break deterministically: whoever was
 * auto-routed longest ago (never-routed first), then the lowest user id — that
 * is the round-robin, and it needs no extra counter to stay stable.
 */
export function pickLightestCandidate<T extends { userId: string; weight: number }>(
  candidates: T[],
  lastRouted: Map<string, string>,
): T | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort(
    (a, b) =>
      a.weight - b.weight ||
      (lastRouted.get(a.userId) ?? "").localeCompare(lastRouted.get(b.userId) ?? "") ||
      a.userId.localeCompare(b.userId),
  )[0]!;
}

export type RoutingDecision = {
  userId: string | null;
  roleCode: string | null;
  reason: string;
  fallback: boolean;
  candidates: { userId: string; roleCode: string; weight: number }[];
};

export type RoutingInputs = {
  /** On-call person for the overnight window, already checked for eligibility. */
  afterHours: boolean;
  onCallUserId: string | null;
  /** Eligible Team B seat holders with their current weighted open load. */
  teamB: { userId: string; roleCode: string; weight: number }[];
  lastRouted: Map<string, string>;
  /** Approved cross-team role on duty right now, with an eligible holder. */
  triage: { userId: string; roleCode: string } | null;
  /** Supervisor, only supplied when actually on duty and assignable. */
  supervisorOnDuty: { userId: string; roleCode: string } | null;
};

/**
 * One decision, in priority order: overnight on-call, then the weighted Team B
 * queue, then the approved cross-team triage role, then an *on-duty*
 * supervisor. An off-duty supervisor is never silently assigned — the ticket
 * stays unassigned and surfaces in Oversight instead.
 */
export function decideRoute(input: RoutingInputs): RoutingDecision {
  if (input.afterHours && input.onCallUserId) {
    return {
      userId: input.onCallUserId,
      roleCode: null,
      reason:
        "Created from Breezeway inside the after-hours window; routed to the rostered on-call person. Priority is unchanged.",
      fallback: false,
      candidates: [],
    };
  }

  const winner = pickLightestCandidate(input.teamB, input.lastRouted);
  if (winner) {
    return {
      userId: winner.userId,
      roleCode: winner.roleCode,
      reason: `Created from Breezeway; routed to the lightest eligible Property Operations queue (weighted load ${winner.weight}, P1=5/P2=3/P3=1).`,
      fallback: false,
      candidates: input.teamB,
    };
  }

  if (input.triage) {
    return {
      userId: input.triage.userId,
      roleCode: input.triage.roleCode,
      reason: `Property Operations is off duty in an approved cross-team triage window; routed to ${SEAT_LABELS[input.triage.roleCode] ?? input.triage.roleCode}. This window is covered, not a gap.`,
      fallback: false,
      candidates: [],
    };
  }

  if (input.supervisorOnDuty) {
    return {
      userId: input.supervisorOnDuty.userId,
      roleCode: input.supervisorOnDuty.roleCode,
      reason:
        "No Property Operations seat and no cross-team triage role is eligible; held by the on-duty Operations Supervisor.",
      fallback: true,
      candidates: [],
    };
  }

  return {
    userId: null,
    roleCode: null,
    reason:
      "Nobody is scheduled and eligible right now, and the Operations Supervisor is off duty. Left unassigned so it surfaces immediately in Oversight.",
    fallback: true,
    candidates: [],
  };
}

/** Weekday/minute of a moment in a timezone, without a date library. */
export function localWeekdayMinutes(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = map[parts.find((p) => p.type === "weekday")?.value ?? "Sun"] ?? 0;
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const hour = Number(hourRaw) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { weekday, minutes: hour * 60 + minute };
}
