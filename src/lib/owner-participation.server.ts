/**
 * Server-side aggregation for the 90-Day Owner Participation Program.
 *
 * One rule governs every total in here: minutes live on the participation
 * entry and nowhere else. Property links carry no time, so the combined
 * program total is always a sum over distinct entry ids. Per-property
 * figures exist for context only and never feed the benchmark, the status
 * or a badge.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { parseReviewedOwnerUpdate, type ReviewedOwnerUpdate } from "./owner-reviewed-update";
import { readOwnerParticipation } from "./owner-participation-reader.server";
import { readAllRows } from "./read-all-rows";
import { readOwnerProgram, readOwnerProgramProperties } from "./owner-program-reader.server";
import type { Database } from "@/integrations/supabase/types";
import {
  benchmarkHours,
  countableParticipationEntries,
  inParticipationWindow,
  hoursFromMinutes,
  ownerGoalMet,
  progressSnapshot,
  parseReviewPhotos,
  type ReviewPhoto,
  type CoverageState,
  type ProgramStatus,
  type TaskType,
} from "./owner-participation";

export type Client = SupabaseClient<Database>;

export type EntryRow = {
  owner_update_revision?: number | null;
  owner_update_snapshot?: ReviewedOwnerUpdate | null;
  id: string;
  phase: string;
  entry_date: string;
  minutes: number;
  activity: string;
  activity_category: string | null;
  decision_outcome: string | null;
  output: string | null;
  comments: string | null;
  attachment_path: string | null;
  review_id: string | null;
  ticket_id: string | null;
  amends_entry_id: string | null;
  correction_reason: string | null;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  attested: boolean;
  flagged: boolean;
  created_at: string;
  propertyIds: string[];
};

export type ReviewRow = {
  owner_update_revision?: number | null;
  owner_request?: import("./owner-ticket-authority").OwnerTicketRequest;
  updated_at?: string;
  auto_ticket?: boolean;
  id: string;
  phase: string;
  stage: string;
  title: string;
  task_type: TaskType;
  recommendation: string | null;
  business_question: string | null;
  evidence: string | null;
  impact: string | null;
  decision_path: string;
  respond_by: string | null;
  status: string;
  owner_decision: string | null;
  owner_response: string | null;
  outcome: string | null;
  responded_at: string | null;
  ticket_id: string | null;
  attachment_path: string | null;
  source_type: string;
  onboarding_task_id: string | null;
  owner_action_type: string;
  available_from: string | null;
  staff_context: string | null;
  closed_at: string | null;
  photos: ReviewPhoto[];
  sort_order: number;
  propertyIds: string[];
};

export type ProgramPropertyRow = {
  id: string;
  propertyId: string;
  name: string;
  address: string;
  /** Real ARHA property photo, presentation-only — never a stock image. */
  photoUrl: string | null;
  closingDate: string | null;
  closingConfirmed: boolean;
  addedOn: string;
  inclusionStatus: string;
  currentAccess?: boolean;
  onboardingStatus: string;
  launchStatus: string;
  coverage: CoverageState;
  lastOwnerActivityAt: string | null;
  requiredTasks: number;
  completedTasks: number;
  openTasks: number;
  outstandingDecisions: number;
  overdueDecisions: number;
  /** Informational only — never used in the combined total. */
  directMinutes: number;
  sharedMinutes: number;
};

/** Distinct-entry total. The only legitimate way to add up program hours. */
export function combinedMinutes(entries: { id: string; minutes: number }[]) {
  const seen = new Set<string>();
  let total = 0;
  for (const e of entries) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    total += e.minutes;
  }
  return total;
}

function locationOf(p: {
  address_line1?: string | null;
  city: string | null;
  state: string | null;
}) {
  return [p.address_line1, p.city, p.state].filter(Boolean).join(", ");
}

const CLOSED_REVIEW = new Set(["answered", "closed"]);

/**
 * Complete, program-scoped paged reads for the program row, its
 * homes with task coverage, its owner tasks, its participation entries and
 * its badges.
 */
export async function loadProgramAggregate(
  supabase: Client,
  programId: string,
  options: { ownerView?: boolean; preview?: boolean } = {},
) {
  const [program, links, reviews, reviewProps, entries, entryProps, badges] = await Promise.all([
    options.ownerView
      ? readOwnerProgram(supabase, programId, options.preview)
      : supabase
          .from("owner_programs")
          .select(
            "id, property_id, owner_user_id, owner_name, owner_email, owner_phone, status, started_on, ends_on, activated_at, activated_by, target_hours, operating_target_hours, onboarding_milestone_hours, onboarding_milestone_day, onboarding_target_hours, ongoing_target_hours, onboarding_lead, operations_lead, dfy_confirmed, internal_notes, completed_at, notify_email, notify_sms_p1, notify_push",
          )
          .eq("id", programId)
          .single(),
    options.ownerView
      ? readOwnerProgramProperties(supabase, programId, options.preview)
      : readAllRows((from, to) =>
          supabase
            .from("owner_program_properties")
            .select(
              "id, property_id, closing_date, closing_confirmed, added_on, inclusion_status, onboarding_status, launch_status, coverage_status, last_owner_activity_at, properties(name, nickname, address_line1, city, state, primary_photo_url)",
              { count: "exact" },
            )
            .eq("program_id", programId)
            .order("added_on")
            .order("id")
            .range(from, to),
        ),
    options.ownerView
      ? readOwnerParticipation(supabase, "reviews", programId, options.preview)
      : readAllRows((from, to) =>
          supabase
            .from("owner_reviews")
            .select(
              "id, updated_at, auto_ticket, phase, stage, title, task_type, recommendation, business_question, evidence, impact, decision_path, respond_by, status, owner_decision, owner_response, outcome, responded_at, ticket_id, property_id, attachment_path, photos, sort_order, source_type, onboarding_task_id, owner_action_type, available_from, staff_context, closed_at",
              { count: "exact" },
            )
            .eq("program_id", programId)
            .order("sort_order")
            .order("id")
            .range(from, to),
        ),
    options.ownerView
      ? Promise.resolve({ data: [], error: null })
      : readAllRows((from, to) =>
          supabase
            .from("owner_review_properties")
            .select("review_id, property_id, owner_reviews!inner(program_id)", { count: "exact" })
            .eq("owner_reviews.program_id", programId)
            .order("review_id")
            .order("property_id")
            .range(from, to),
        ),
    options.ownerView
      ? readOwnerParticipation(supabase, "entries", programId, options.preview)
      : readAllRows((from, to) =>
          supabase
            .from("owner_time_entries")
            .select(
              "id, phase, entry_date, minutes, activity, activity_category, decision_outcome, output, comments, attachment_path, review_id, ticket_id, owner_update_revision, owner_update_snapshot, amends_entry_id, correction_reason, review_status, reviewed_by, reviewed_at, review_note, attested, flagged, created_at",
              { count: "exact" },
            )
            .eq("program_id", programId)
            .order("entry_date", { ascending: false })
            .order("id")
            .range(from, to),
        ),
    options.ownerView
      ? Promise.resolve({ data: [], error: null })
      : readAllRows((from, to) =>
          supabase
            .from("owner_time_entry_properties")
            .select("entry_id, property_id, owner_time_entries!inner(program_id)", {
              count: "exact",
            })
            .eq("owner_time_entries.program_id", programId)
            .order("entry_id")
            .order("property_id")
            .range(from, to),
        ),
    options.ownerView
      ? readOwnerParticipation(supabase, "badges", programId, options.preview)
      : readAllRows((from, to) =>
          supabase
            .from("owner_badges")
            .select("code, awarded_at, trigger_rule, needs_review", { count: "exact" })
            .eq("program_id", programId)
            .order("awarded_at")
            .order("code")
            .range(from, to),
        ),
  ]);

  for (const r of [program, links, reviews, reviewProps, entries, entryProps, badges]) {
    if (r.error) throw r.error;
  }

  const p = program.data!;
  const entryIds = new Set((entries.data ?? []).map((e) => e.id));
  const reviewIds = new Set((reviews.data ?? []).map((r) => r.id));

  const entryRows: EntryRow[] = (entries.data ?? []).map((e) => ({
    ...e,
    owner_update_snapshot: parseReviewedOwnerUpdate(e.owner_update_snapshot),
    propertyIds:
      "property_ids" in e
        ? e.property_ids
        : (entryProps.data ?? []).filter((l) => l.entry_id === e.id).map((l) => l.property_id),
  }));

  const reviewRows: ReviewRow[] = (reviews.data ?? []).map((r) => {
    const linked =
      "property_ids" in r
        ? r.property_ids
        : (reviewProps.data ?? []).filter((l) => l.review_id === r.id).map((l) => l.property_id);
    const ids = linked.length > 0 ? linked : r.property_id ? [r.property_id] : [];
    return {
      ...r,
      task_type: (r.task_type ?? "program_wide") as TaskType,
      photos: parseReviewPhotos((r as { photos?: unknown }).photos),
      propertyIds: ids,
    };
  });

  const inPeriod = (entry: EntryRow) =>
    inParticipationWindow(entry.entry_date, p.started_on, p.ends_on);
  const countable = countableParticipationEntries(entryRows).filter(inPeriod);
  const today = new Date().toISOString().slice(0, 10);

  const properties: ProgramPropertyRow[] = (links.data ?? []).map((l) => {
    const prop = l.properties as unknown as {
      name: string;
      nickname: string | null;
      address_line1: string | null;
      city: string | null;
      state: string | null;
      primary_photo_url: string | null;
    } | null;
    const mine = reviewRows.filter((r) => r.propertyIds.includes(l.property_id));
    const completed = mine.filter((r) => CLOSED_REVIEW.has(r.status));
    const open = mine.filter((r) => !CLOSED_REVIEW.has(r.status));
    const overdue = open.filter((r) => r.respond_by && r.respond_by < today);
    const direct = countable.filter(
      (e) => e.propertyIds.length === 1 && e.propertyIds[0] === l.property_id,
    );
    const shared = countable.filter(
      (e) => e.propertyIds.length > 1 && e.propertyIds.includes(l.property_id),
    );

    let coverage: CoverageState;
    if (direct.length + shared.length === 0) coverage = "no_activity";
    else if (overdue.length > 0) coverage = "needs_attention";
    else if (open.length === 0 && mine.length > 0) coverage = "complete";
    else if (l.launch_status === "launched" || l.launch_status === "ready")
      coverage = "launch_ready";
    else coverage = "in_progress";

    return {
      id: l.id,
      propertyId: l.property_id,
      name: prop ? prop.nickname || prop.name || "Property" : "Previously enrolled property",
      address: prop ? locationOf(prop) : "",
      photoUrl: prop?.primary_photo_url ?? null,
      closingDate: l.closing_date,
      closingConfirmed: l.closing_confirmed,
      addedOn: l.added_on,
      inclusionStatus: l.inclusion_status,
      currentAccess: "current_access" in l ? l.current_access === true : true,
      onboardingStatus: l.onboarding_status,
      launchStatus: l.launch_status,
      coverage,
      lastOwnerActivityAt: l.last_owner_activity_at,
      requiredTasks: mine.length,
      completedTasks: completed.length,
      openTasks: open.length,
      outstandingDecisions: open.filter((r) => r.status === "awaiting_owner").length,
      overdueDecisions: overdue.length,
      directMinutes: direct.reduce((n, e) => n + e.minutes, 0),
      sharedMinutes: shared.reduce((n, e) => n + e.minutes, 0),
    };
  });

  const included = properties.filter(
    (x) => x.inclusionStatus === "included" && x.currentAccess !== false,
  );
  // An entry that a later entry amends is superseded: only the amending entry
  // carries the current minutes, so the pair can never be counted twice.
  const supersededIds = new Set(
    entryRows.map((e) => e.amends_entry_id).filter((id): id is string => Boolean(id)),
  );
  // Nothing here ever adds, estimates or credits time on the owner's behalf.
  const reported = combinedMinutes(countable);
  const onboardingMinutes = combinedMinutes(countable.filter((e) => e.phase === "onboarding"));
  // Logged time counts immediately — there is no review, approval or return state.
  const approvedMinutes = reported;
  const pendingReviewMinutes = 0;
  const returnedMinutes = 0;

  const snapshot = progressSnapshot({
    status: p.status as ProgramStatus,
    startedOn: p.started_on,
    reportedMinutes: reported,
  });

  const lastActivity = entryRows[0]?.created_at ?? null;

  return {
    program: {
      id: p.id,
      status: p.status as ProgramStatus,
      ownerUserId: p.owner_user_id,
      ownerName: p.owner_name,
      ownerEmail: p.owner_email,
      ownerPhone: p.owner_phone,
      startedOn: p.started_on,
      endsOn: p.ends_on,
      activatedAt: p.activated_at,
      operatingTargetHours: Number(p.operating_target_hours ?? 105),
      onboardingMilestoneHours: Number(p.onboarding_milestone_hours ?? 60),
      onboardingMilestoneDay: Number(p.onboarding_milestone_day ?? 35),
      onboardingLead: p.onboarding_lead,
      operationsLead: p.operations_lead,
      dfyConfirmed: p.dfy_confirmed,
      internalNotes: p.internal_notes,
      completedAt: p.completed_at,
      notifyEmail: p.notify_email,
      notifySmsP1: p.notify_sms_p1,
      notifyPush: p.notify_push,
    },
    properties,
    includedProperties: included,
    reviews: reviewRows,
    entries: entryRows.map((e) => ({ ...e, superseded: supersededIds.has(e.id) })),
    badges: badges.data ?? [],
    reportedMinutes: reported,
    approvedMinutes,
    pendingReviewMinutes,
    returnedMinutes,

    onboardingMinutes,
    operationalMinutes: reported - onboardingMinutes,
    reportedHours: hoursFromMinutes(reported),
    benchmark: benchmarkHours(snapshot.day, snapshot.totalDays),
    snapshot,
    lastOwnerActivityAt: lastActivity,
    goalMet: ownerGoalMet(reported),
    unusedIds: { entryIds, reviewIds },
  };
}

export type ProgramAggregate = Awaited<ReturnType<typeof loadProgramAggregate>>;

/** Append-only history. Every meaningful change to a program lands here. */
export async function recordEvent(
  supabase: Client,
  input: {
    programId: string;
    kind: string;
    summary: string;
    actorId?: string | null;
    propertyId?: string | null;
    entryId?: string | null;
    reviewId?: string | null;
    previousValue?: string | null;
    newValue?: string | null;
    reason?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("owner_program_events").insert({
    program_id: input.programId,
    kind: input.kind,
    summary: input.summary,
    actor_id: input.actorId ?? null,
    property_id: input.propertyId ?? null,
    entry_id: input.entryId ?? null,
    review_id: input.reviewId ?? null,
    previous_value: input.previousValue ?? null,
    new_value: input.newValue ?? null,
    reason: input.reason ?? null,
    detail: (input.detail ?? {}) as never,
  });
  // History must never block the action that produced it.
  if (error) console.error("owner_program_events insert failed", error.message);
}
