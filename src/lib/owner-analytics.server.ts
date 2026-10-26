/**
 * Active Owner analytics for staff and executives.
 *
 * Same counting rules as the homeowner portal, applied across every live
 * program at once: minutes live on the entry, a superseded entry is replaced
 * by its amendment, and a returned entry does not count until the homeowner
 * corrects it. Nothing here ever estimates, prefills or credits time.
 *
 * Demo and archived programs are excluded so the executive view matches the
 * live reporting baseline used everywhere else.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  hoursFromMinutes,
  countedParticipationEntries,
  progressSnapshot,
  OPERATING_TARGET_HOURS,
  OWNER_GOAL_HOURS,
  ownerGoalMet,
  type ProgramStatus,
  type ProgressState,
} from "./owner-participation";
import { combinedMinutes } from "./owner-participation.server";

type Client = SupabaseClient<Database>;

export type OwnerProgramMetric = {
  programId: string;
  ownerName: string;
  ownerEmail: string | null;
  status: ProgramStatus;
  startedOn: string | null;
  endsOn: string | null;
  day: number;
  daysLeft: number;
  properties: number;
  entries: number;
  reportedHours: number;
  goalMet: boolean;
  approvedHours: number;
  pendingHours: number;
  returnedHours: number;
  pendingEntries: number;
  flaggedEntries: number;
  benchmarkHours: number;
  varianceHours: number;
  percentOfOperatingTarget: number;
  hoursToGoal: number;
  /** Hours per remaining week needed to clear the operating target. */
  hoursPerWeekNeeded: number | null;
  state: ProgressState;
  lastEntryAt: string | null;
  daysSinceLastEntry: number | null;
};

export type OwnerAnalytics = {
  generatedAt: string;
  goalHours: number;
  operatingTargetHours: number;
  totals: {
    programs: number;
    activePrograms: number;
    properties: number;
    reportedHours: number;
    approvedHours: number;
    pendingHours: number;
    pendingEntries: number;
    flaggedEntries: number;
    goalMet: number;
    behind: number;
    stale: number;
    averageReportedHours: number;
    averageVarianceHours: number;
  };
  programs: OwnerProgramMetric[];
};

const ACTIVE_STATUSES = new Set(["active", "target_reached"]);

function daysBetween(iso: string | null) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export async function loadOwnerAnalytics(
  supabase: Client,
  options: { demo?: boolean } = {},
): Promise<OwnerAnalytics> {
  const base = supabase
    .from("owner_programs")
    .select("id, status, started_on, ends_on, canonical_owner:property_owners(name, email)")
    .is("archived_at", null);
  const programs = await (
    options.demo ? base.eq("is_demo", true) : base.or("is_demo.is.null,is_demo.eq.false")
  ).order("started_on", { ascending: false });
  if (programs.error) throw programs.error;

  const rows = programs.data ?? [];
  const ids = rows.map((p) => p.id);
  if (ids.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      goalHours: OWNER_GOAL_HOURS,
      operatingTargetHours: OPERATING_TARGET_HOURS,
      totals: {
        programs: 0,
        activePrograms: 0,
        properties: 0,
        reportedHours: 0,
        approvedHours: 0,
        pendingHours: 0,
        pendingEntries: 0,
        flaggedEntries: 0,
        goalMet: 0,
        behind: 0,
        stale: 0,
        averageReportedHours: 0,
        averageVarianceHours: 0,
      },
      programs: [],
    };
  }

  const [entries, links] = await Promise.all([
    supabase
      .from("owner_time_entries")
      .select(
        "id, program_id, minutes, review_status, amends_entry_id, flagged, created_at, entry_date",
      )
      .in("program_id", ids),
    supabase
      .from("owner_program_properties")
      .select("program_id, inclusion_status, closing_date, closing_confirmed")
      .in("program_id", ids),
  ]);
  if (entries.error) throw entries.error;
  if (links.error) throw links.error;

  const byProgram = new Map<string, NonNullable<typeof entries.data>>();
  for (const e of entries.data ?? []) {
    const list = byProgram.get(e.program_id) ?? [];
    list.push(e);
    byProgram.set(e.program_id, list);
  }

  const propertyCount = new Map<string, number>();
  for (const l of links.data ?? []) {
    if (l.inclusion_status !== "included") continue;
    propertyCount.set(l.program_id, (propertyCount.get(l.program_id) ?? 0) + 1);
  }

  const metrics: OwnerProgramMetric[] = rows.map((p) => {
    const mine = byProgram.get(p.id) ?? [];
    const countable = countedParticipationEntries(mine, {
      closingDates: (links.data ?? [])
        .filter(
          (l) =>
            l.program_id === p.id &&
            l.inclusion_status === "included" &&
            l.closing_date,
        )
        .map((l) => l.closing_date),
      startedOn: p.started_on,
      endsOn: p.ends_on,
    });
    const reported = combinedMinutes(countable);
    // No hour review: everything logged counts.
    const approved = reported;
    const pending = 0;
    const returned = 0;

    const snapshot = progressSnapshot({
      status: p.status as ProgramStatus,
      startedOn: p.started_on,
      reportedMinutes: reported,
    });

    const lastEntryAt =
      mine
        .map((e) => e.created_at)
        .sort()
        .at(-1) ?? null;
    const weeksLeft = snapshot.daysLeft / 7;
    const remaining = Math.max(0, OPERATING_TARGET_HOURS - hoursFromMinutes(reported));

    return {
      programId: p.id,
      ownerName: p.canonical_owner?.name ?? "Owner link unresolved",
      ownerEmail: p.canonical_owner?.email ?? null,
      status: p.status as ProgramStatus,
      startedOn: p.started_on,
      endsOn: p.ends_on,
      day: snapshot.day,
      daysLeft: snapshot.daysLeft,
      properties: propertyCount.get(p.id) ?? 0,
      entries: countable.length,
      reportedHours: hoursFromMinutes(reported),
      goalMet: ownerGoalMet(reported),
      approvedHours: hoursFromMinutes(approved),
      pendingHours: hoursFromMinutes(pending),
      returnedHours: hoursFromMinutes(returned),
      pendingEntries: 0,
      flaggedEntries: mine.filter((e) => e.flagged).length,
      benchmarkHours: snapshot.benchmark,
      varianceHours: snapshot.variance,
      percentOfOperatingTarget: snapshot.percentOfTarget,
      hoursToGoal: snapshot.hoursToGoal,
      hoursPerWeekNeeded:
        weeksLeft > 0 && remaining > 0 ? Math.round((remaining / weeksLeft) * 10) / 10 : null,
      state: snapshot.state,
      lastEntryAt,
      daysSinceLastEntry: daysBetween(lastEntryAt),
    };
  });

  const active = metrics.filter((m) => ACTIVE_STATUSES.has(m.status));
  const sum = (list: OwnerProgramMetric[], pick: (m: OwnerProgramMetric) => number) =>
    Math.round(list.reduce((n, m) => n + pick(m), 0) * 10) / 10;

  return {
    generatedAt: new Date().toISOString(),
    goalHours: OWNER_GOAL_HOURS,
    operatingTargetHours: OPERATING_TARGET_HOURS,
    totals: {
      programs: metrics.length,
      activePrograms: active.length,
      properties: metrics.reduce((n, m) => n + m.properties, 0),
      reportedHours: sum(metrics, (m) => m.reportedHours),
      approvedHours: sum(metrics, (m) => m.approvedHours),
      pendingHours: sum(metrics, (m) => m.pendingHours),
      pendingEntries: metrics.reduce((n, m) => n + m.pendingEntries, 0),
      flaggedEntries: metrics.reduce((n, m) => n + m.flaggedEntries, 0),
      goalMet: metrics.filter((m) => m.goalMet).length,
      behind: active.filter(
        (m) => m.state === "action_needed" || m.state === "significantly_behind",
      ).length,
      stale: active.filter((m) => (m.daysSinceLastEntry ?? 999) >= 14).length,
      averageReportedHours: active.length
        ? Math.round((sum(active, (m) => m.reportedHours) / active.length) * 10) / 10
        : 0,
      averageVarianceHours: active.length
        ? Math.round((sum(active, (m) => m.varianceHours) / active.length) * 10) / 10
        : 0,
    },
    programs: metrics,
  };
}
