/**
 * Automated sources stay unowned (Emily, Nov 7, 2026; register T15).
 *
 * Tickets created by the info inbox, by OwnerRez (including OwnerRez review follow ups) and by
 * Breezeway are created with no owner. The database rule (auto_assign_ticket) skips them by
 * the ticket's `external_source`, which only those automated paths set; this module mirrors
 * that check for the screen. They wait in the Team Queue in their team's group, under From
 * email, From OwnerRez and From Breezeway, until a coordinator presses Take it.
 * Browser-safe and display-only, apart from the Take it change itself.
 */
import { TEAM_A, TEAM_B, teamOf } from "@/lib/coverage-model";
import { OPEN_STATUSES } from "@/lib/tickets";

export type AutomatedSource = "email" | "ownerrez" | "breezeway";

/** The same list the database rule checks (docs/pending/fix-batch-4/01). */
export const AUTOMATED_SOURCES: readonly AutomatedSource[] = ["email", "ownerrez", "breezeway"];

export const AUTOMATED_SOURCE_LABELS: Record<AutomatedSource, string> = {
  email: "From email",
  ownerrez: "From OwnerRez",
  breezeway: "From Breezeway",
};

export const AUTOMATED_QUEUE_COPY = {
  title: "Waiting to be taken",
  take: "Take it",
  taking: "Taking…",
  taken: "It's yours.",
  alreadyTaken: "Someone else took it first.",
  teams: { [TEAM_A]: "Team A", [TEAM_B]: "Team B", none: "No team yet" } as Record<string, string>,
} as const;

export function automatedSourceOf(t: { external_source?: string | null }): AutomatedSource | null {
  const s = (t.external_source ?? "").trim().toLowerCase();
  return (AUTOMATED_SOURCES as readonly string[]).includes(s) ? (s as AutomatedSource) : null;
}

export type AutomatedTicket = {
  id: string;
  status: string;
  external_source?: string | null;
  functional_role_code?: string | null;
  work_types?: { functional_role_code?: string | null } | null;
  assigned_to?: string | null;
  current_action_owner?: string | null;
  record_owner?: string | null;
  accountable_owner?: string | null;
  archived_at?: string | null;
  reported_at?: string | null;
};

/**
 * The ticket's team: from its role, else its work type. A Breezeway ticket with no work type
 * belongs to Team B (Property Operations). An inbox or OwnerRez ticket with no work type has
 * no team yet and shows for both teams.
 */
export function automatedTeam(t: AutomatedTicket): string | null {
  const code = t.functional_role_code ?? t.work_types?.functional_role_code ?? null;
  const team = code ? teamOf(code) : null;
  if (team === TEAM_A || team === TEAM_B) return team;
  return automatedSourceOf(t) === "breezeway" ? TEAM_B : null;
}

const unowned = (t: AutomatedTicket) =>
  !t.assigned_to && !t.current_action_owner && !t.record_owner && !t.accountable_owner;

export type AutomatedGroup<T> = {
  team: string | null;
  label: string;
  sources: { source: AutomatedSource; label: string; rows: T[] }[];
};

/**
 * Open, unowned, not archived tickets from an automated source, grouped by team (Team A,
 * Team B, then No team yet) and source, oldest first. `myTeam` narrows to one team plus the
 * tickets with no team yet.
 */
export function automatedQueueGroups<T extends AutomatedTicket>(rows: T[], myTeam: string | null = null): AutomatedGroup<T>[] {
  const waiting = rows
    .filter((t) => !t.archived_at && OPEN_STATUSES.includes(t.status) && unowned(t) && automatedSourceOf(t))
    .sort((a, b) => (a.reported_at ?? "").localeCompare(b.reported_at ?? ""));
  const teams: (string | null)[] = [TEAM_A, TEAM_B, null];
  return teams
    .filter((team) => !myTeam || team === null || team === myTeam)
    .map((team) => ({
      team,
      label: AUTOMATED_QUEUE_COPY.teams[team ?? "none"]!,
      sources: AUTOMATED_SOURCES.map((source) => ({
        source,
        label: AUTOMATED_SOURCE_LABELS[source],
        rows: waiting.filter((t) => automatedSourceOf(t) === source && automatedTeam(t) === team),
      })).filter((s) => s.rows.length > 0),
    }))
    .filter((g) => g.sources.length > 0);
}

/**
 * What Take it writes: the same fields as the ticket's own "Take this ticket" (both owners,
 * the record and accountable owners if empty, a manual assignment). Only applied while the
 * ticket still has no owner, so two people pressing at once cannot both take it.
 */
export function takeTicketPatch(t: { record_owner?: string | null; accountable_owner?: string | null }, userId: string) {
  return {
    assigned_to: userId,
    current_action_owner: userId,
    record_owner: t.record_owner ?? userId,
    accountable_owner: t.accountable_owner ?? userId,
    assignment_source: "manual",
    assignment_note: null,
  };
}
