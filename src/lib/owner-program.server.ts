/**
 * Active Owner Participation Program — staff side (server-only).
 *
 * One homeowner has one program. A program can carry one home or several;
 * either way there is a single program window (closing date → December 31), a single combined commitment of
 * at least 100 hours and a single pace benchmark. Individual homes are
 * measured by the tasks and decisions they need, never by their own hour
 * target.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { type DecisionPath, type ProgramPhase, type TaskTemplate } from "./owner-program";
import {
  aggregateParticipationPeriod,
  countedParticipationEntries,
  hoursFromMinutes,
  ownerGoalMet,
  REPORT_DISCLAIMER,
  progressSnapshot,
  type ProgramStatus,
} from "./owner-participation";
import { combinedMinutes, loadProgramAggregate } from "./owner-participation.server";
import {
  loadOwnerResponseReceipts,
  type OwnerResponseReceipt,
} from "./owner-response-history.server";
import {
  changeOwnerProgramAtomically,
  createOwnerProgramAtomically,
} from "./owner-program-lifecycle.server";
import { activateOwnerProgramAtomically } from "./owner-program-activation.server";
type Client = SupabaseClient<Database>;

/** Throws unless the caller is an admin or manager. */
export async function assertSupervisor(supabase: Client, userId: string) {
  const [admin, manager] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
  ]);
  if (admin.error || manager.error) throw new Error("Could not verify your access level.");
  if (!admin.data && !manager.data) {
    throw new Error("Only a supervisor can manage owner participation programs.");
  }
}

/**
 * Enrollment/activation authority: admin, manager, or the seated Onboarding
 * Director (who owns Active Owner enrollment during Onboarding). Closeout,
 * hour corrections, time review and program rules stay supervisor-only.
 */
export async function assertEnrollmentAuthority(supabase: Client, userId: string) {
  const [admin, manager, director] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "manager" }),
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
  ]);
  if (admin.error || manager.error || director.error)
    throw new Error("Could not verify your access level.");
  if (!admin.data && !manager.data && !director.data) {
    throw new Error("Only a supervisor or the Onboarding Director can manage Active Owner enrollment.");
  }
}

/**
 * Enrolling a home (new program or adding a home): Onboarding Director seat or
 * Admin only. Other program management keeps assertEnrollmentAuthority.
 */
export async function assertActiveOwnerEnrollAuthority(supabase: Client, userId: string) {
  const [admin, director] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
  ]);
  if (admin.error || director.error) throw new Error("Could not verify your access level.");
  if (!admin.data && !director.data)
    throw new Error("Only the Onboarding Director or a Admin can enroll a home in Active Owner.");
}

function locationOf(p: { city: string | null; state: string | null }) {
  return [p.city, p.state].filter(Boolean).join(", ");
}

/** The whole roadmap catalog, in phase / stage / sort order. */
export async function loadTaskTemplates(supabase: Client): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from("owner_task_templates")
    .select(
      "id, phase, stage, code, title, summary, owner_action, decision_path, planning_hours_low, planning_hours_high, respond_within_days, recurring, sort_order",
    )
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    ...t,
    phase: t.phase as ProgramPhase,
    decision_path: t.decision_path as DecisionPath,
    planning_hours_low: Number(t.planning_hours_low),
    planning_hours_high: Number(t.planning_hours_high),
  }));
}

export type AdminProgramRow = {
  id: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerLinked: boolean;
  /** The homeowner's portal account, when one is linked. */
  ownerUserId: string | null;
  status: ProgramStatus;
  startedOn: string | null;
  endsOn: string | null;
  properties: { id: string; name: string; coverage: string; openTasks: number; overdue: number }[];
  day: number;
  daysLeft: number;
  reportedHours: number;
  goalMet: boolean;
  benchmark: number;
  variance: number;
  progressState: string;
  lastOwnerActivityAt: string | null;
  openTasks: number;
  coverageConcerns: number;
  nextMilestone: { day: number; hours: number };
  badgeCount: number;
  onboardingLead: string | null;
  operationsLead: string | null;
  lastNotificationAt: string | null;
  dfyConfirmed: boolean;
  /** Participation opportunities the owner can act on right now. */
  availableOpportunities: number;
  upcomingOpportunities: number;
  onboardingOpportunities: number;
  operationsOpportunities: number;
};

/** One row per participation program, plus the homes still free to enroll. */
export async function loadPrograms(supabase: Client, demo = false) {
  const [properties, programs, links, reviews, entries, entryProps, badges, notifications] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, name, nickname, city, state")
        .eq("active", true)
        .order("name"),
      supabase
        .from("owner_programs")
        .select(
          "id, owner_user_id, status, started_on, ends_on, onboarding_lead, operations_lead, dfy_confirmed, last_owner_activity_at, canonical_owner:property_owners(name, email)",
        )
        // Demo programs stay out of the production queue unless demo mode is on.
        .eq("is_demo", demo)
        .is("archived_at", null),
      supabase
        .from("owner_program_properties")
        .select(
          "id, program_id, property_id, inclusion_status, closing_date, closing_confirmed, launch_status, coverage_status, last_owner_activity_at, properties(name, nickname)",
        ),
      supabase
        .from("owner_reviews")
        .select("id, program_id, property_id, status, respond_by, source_type, available_from"),
      supabase
        .from("owner_time_entries")
        .select("id, program_id, minutes, review_status, amends_entry_id, entry_date")
        .eq("is_demo", demo),
      supabase.from("owner_time_entry_properties").select("entry_id, property_id"),
      supabase.from("owner_badges").select("program_id, code"),
      supabase
        .from("owner_notifications")
        .select("program_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
  for (const r of [
    properties,
    programs,
    links,
    reviews,
    entries,
    entryProps,
    badges,
    notifications,
  ]) {
    if (r.error) throw r.error;
  }

  const today = new Date().toISOString().slice(0, 10);
  const reviewProperty = new Map((reviews.data ?? []).map((r) => [r.id, r.property_id]));

  const rows: AdminProgramRow[] = (programs.data ?? []).map((p) => {
    const myLinks = (links.data ?? []).filter(
      (l) => l.program_id === p.id && l.inclusion_status === "included",
    );
    const myReviews = (reviews.data ?? []).filter((r) => r.program_id === p.id);
    const myEntries = countedParticipationEntries(
      (entries.data ?? []).filter((entry) => entry.program_id === p.id),
      {
        closingDates: myLinks
          .filter((l) => l.closing_confirmed && l.closing_date)
          .map((l) => l.closing_date),
        startedOn: p.started_on,
        endsOn: p.ends_on,
      },
      today,
    );
    const reported = combinedMinutes(myEntries);
    const snapshot = progressSnapshot({
      status: p.status as ProgramStatus,
      startedOn: p.started_on,
      reportedMinutes: reported,
    });
    const openTasks = myReviews.filter((r) => !["answered", "closed"].includes(r.status));
    // Is this program actually receiving participation opportunities?
    const nowMs = Date.now();
    const live = myReviews.filter((r) => !["answered", "closed"].includes(r.status));
    const upcoming = live.filter(
      (r) => r.available_from && new Date(r.available_from).getTime() > nowMs,
    );

    const propertyRows = myLinks.map((l) => {
      const prop = l.properties as unknown as { name: string; nickname: string | null } | null;
      const mine = myReviews.filter((r) => reviewProperty.get(r.id) === l.property_id);
      const open = mine.filter((r) => !["answered", "closed"].includes(r.status));
      const overdue = open.filter((r) => r.respond_by && r.respond_by < today);
      const hasActivity = (entryProps.data ?? []).some(
        (ep) => ep.property_id === l.property_id && myEntries.some((e) => e.id === ep.entry_id),
      );
      return {
        id: l.property_id,
        name: prop ? prop.nickname || prop.name : "Property",
        coverage: hasActivity
          ? overdue.length
            ? "needs_attention"
            : "in_progress"
          : "no_activity",
        openTasks: open.length,
        overdue: overdue.length,
      };
    });

    return {
      id: p.id,
      ownerName: p.canonical_owner?.name ?? "Owner link unresolved",
      ownerEmail: p.canonical_owner?.email ?? null,
      ownerLinked: Boolean(p.owner_user_id),
      ownerUserId: p.owner_user_id ?? null,
      status: p.status as ProgramStatus,
      startedOn: p.started_on,
      endsOn: p.ends_on,
      properties: propertyRows,
      day: snapshot.day,
      daysLeft: snapshot.daysLeft,
      reportedHours: hoursFromMinutes(reported),
      goalMet: ownerGoalMet(reported),
      benchmark: snapshot.benchmark,
      variance: snapshot.variance,
      progressState: snapshot.state,
      lastOwnerActivityAt: p.last_owner_activity_at,
      openTasks: openTasks.length,
      coverageConcerns: propertyRows.filter((x) => x.coverage !== "in_progress" || x.overdue > 0)
        .length,
      nextMilestone: snapshot.next,
      badgeCount: (badges.data ?? []).filter((b) => b.program_id === p.id).length,
      onboardingLead: p.onboarding_lead,
      operationsLead: p.operations_lead,
      lastNotificationAt:
        (notifications.data ?? []).find((n) => n.program_id === p.id)?.created_at ?? null,
      dfyConfirmed: p.dfy_confirmed,
      availableOpportunities: live.length - upcoming.length,
      upcomingOpportunities: upcoming.length,
      onboardingOpportunities: myReviews.filter((r) => r.source_type === "onboarding").length,
      operationsOpportunities: myReviews.filter((r) => r.source_type === "operations").length,
    };
  });

  const enrolled = new Set(
    (links.data ?? []).filter((l) => l.inclusion_status === "included").map((l) => l.property_id),
  );
  const available = (properties.data ?? [])
    .filter((p) => !enrolled.has(p.id))
    .map((p) => ({ id: p.id, name: p.nickname || p.name, location: locationOf(p) }));

  return { rows, available };
}

export { ownerAttention as attentionRank } from "./owner-attention";

/** Creates a draft program. The program is never started here. */
export async function createProgram(
  supabase: Client,
  _userId: string,
  input: { propertyId: string; ownerName?: string; ownerEmail?: string },
) {
  return createOwnerProgramAtomically(supabase, input.propertyId);
}

/**
 * Adds another home to an existing program. After activation this needs an
 * administrator, the property must have closed, and the program window and the
 * combined hour commitment both stay exactly as they are.
 */
export async function addProgramProperty(
  supabase: Client,
  _userId: string,
  input: {
    programId: string;
    expectedVersion: string;
    propertyId: string;
    closingDate: string | null;
  },
) {
  await changeOwnerProgramAtomically(supabase, { ...input, action: "add_property" });
  return { ok: true as const };
}

export async function removeProgramProperty(
  supabase: Client,
  _userId: string,
  input: { programId: string; expectedVersion: string; propertyId: string; reason: string },
) {
  await changeOwnerProgramAtomically(supabase, { ...input, action: "remove_property" });
  return { ok: true as const };
}

/** Records the closing confirmation that gates activation. */
export async function confirmPropertyClosing(
  supabase: Client,
  _userId: string,
  input: { programId: string; expectedVersion: string; propertyId: string; closingDate: string },
) {
  await changeOwnerProgramAtomically(supabase, { ...input, action: "confirm_closing" });
  return { ok: true as const };
}

/** Program settings that carry no participation time of their own. */
export async function updateProgramSettings(
  supabase: Client,
  _userId: string,
  input: {
    programId: string;
    expectedVersion: string;
    onboardingLead: string | null;
    operationsLead: string | null;
    dfyConfirmed: boolean;
    internalNotes: string;
  },
) {
  const receipt = await changeOwnerProgramAtomically(supabase, {
    programId: input.programId,
    expectedVersion: input.expectedVersion,
    action: "settings",
    settings: {
      onboardingLead: input.onboardingLead,
      operationsLead: input.operationsLead,
      dfyConfirmed: input.dfyConfirmed,
      internalNotes: input.internalNotes,
    },
  });
  return { ok: true as const, reportVersion: receipt.reportVersion };
}

/**
 * Manual activation. A closing date never starts a program on its own: an
 * authorized team member confirms every home has closed and DFY has agreed
 * the homes run as one combined program, then sets the single start date.
 */
export async function activateProgram(
  supabase: Client,
  userId: string,
  input: { programId: string; expectedVersion: string; startedOn: string },
) {
  await assertEnrollmentAuthority(supabase, userId);
  return activateOwnerProgramAtomically(supabase, input);
}
/** Moves a program between the non-activation lifecycle states. */
export async function setProgramStatus(
  supabase: Client,
  _userId: string,
  input: { programId: string; expectedVersion: string; status: ProgramStatus },
) {
  await changeOwnerProgramAtomically(supabase, { ...input, action: "status" });
  return { ok: true as const };
}

/**
 * Corrections never overwrite what the homeowner reported. The original entry
 * stays; an amending entry carries the revised value, the reason and who made
 * the change.
 */
export async function recordTimeCorrection(
  supabase: Client,
  userId: string,
  input: { entryId: string; minutes: number; reason: string },
  admin: Client,
) {
  const original = await supabase
    .from("owner_time_entries")
    .select(
      "id, program_id, owner_user_id, phase, entry_date, minutes, activity, review_id, ticket_id",
    )
    .eq("id", input.entryId)
    .single();
  if (original.error) throw original.error;

  // Preserve the caller's visibility check before invoking the server-only operation.
  const insert = await admin.rpc("correct_owner_time_entry", {
    _entry_id: original.data.id,
    _actor_id: userId,
    _minutes: input.minutes,
    _reason: input.reason,
  });
  if (insert.error) throw insert.error;
  if (!insert.data) throw new Error("The correction could not be recorded.");

  // The correction and its history are committed. Badge refresh belongs to the
  // next hub load, so a failed follow-up cannot turn this receipt into an error.
  return { ok: true as const, entryId: insert.data };
}

/**
 * Seeds owner tasks from the roadmap catalog. Program-wide tasks are created
 * once; property tasks are created per included home.
 */
export async function seedRoadmap(
  supabase: Client,
  _userId: string,
  input: { programId: string; expectedVersion: string; phase: ProgramPhase | "all" },
) {
  const receipt = await changeOwnerProgramAtomically(supabase, {
    ...input,
    action: "seed_roadmap",
  });
  return { added: receipt.added };
}

/** Everything the staff detail view shows for one program. */
export async function loadProgramDetail(supabase: Client, programId: string) {
  // Bracket the aggregate so the displayed activation version covers every
  // enrollment/closing/DFY input, including paged property reads.
  const before = await supabase
    .from("owner_programs")
    .select("report_version, owner_record_id")
    .eq("id", programId)
    .single();
  if (before.error) throw before.error;
  const agg = await loadProgramAggregate(supabase, programId);
  const history = await supabase
    .from("owner_program_events")
    .select("id, kind, summary, previous_value, new_value, reason, created_at")
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (history.error) throw history.error;

  const after = await supabase
    .from("owner_programs")
    .select("report_version, owner_record_id")
    .eq("id", programId)
    .single();
  if (after.error) throw after.error;
  if (before.data.report_version !== after.data.report_version) {
    throw new Error("The program changed while loading. Refresh before reviewing activation.");
  }
  const canonicalOwner = before.data.owner_record_id
    ? await supabase
        .from("property_owners")
        .select("name, email")
        .eq("id", before.data.owner_record_id)
        .single()
    : null;
  if (canonicalOwner?.error) throw canonicalOwner.error;
  const staffChoices = await supabase.rpc("owner_program_staff_choices");
  if (staffChoices.error) throw staffChoices.error;
  return {
    staffChoices: staffChoices.data ?? [],
    activationVersion: before.data.report_version,
    program: {
      ...agg.program,
      ownerName: canonicalOwner?.data?.name ?? null,
      ownerEmail: canonicalOwner?.data?.email ?? null,
    },
    properties: agg.properties,
    reviews: agg.reviews,
    entries: agg.entries,
    badges: agg.badges,
    snapshot: agg.snapshot,
    reportedMinutes: agg.reportedMinutes,
    onboardingMinutes: agg.onboardingMinutes,
    operationalMinutes: agg.operationalMinutes,
    history: history.data ?? [],
    readyToComplete: completionChecklist(agg),
  };
}

/** The gates that must all pass before ARHA can close a program out. */
export function completionChecklist(agg: Awaited<ReturnType<typeof loadProgramAggregate>>) {
  const included = agg.includedProperties;
  const openTasks = agg.reviews.filter((r) => !["answered", "closed"].includes(r.status));
  const entriesAttributed = countedParticipationEntries(agg.entries, aggregateParticipationPeriod(agg))
    .every((entry) => entry.activity.trim().length > 0);
  return {
    hoursMet: agg.goalMet,
    propertyTasksComplete: included.length > 0 && included.every((p) => p.openTasks === 0),
    decisionsReceived: openTasks.filter((r) => r.status === "awaiting_owner").length === 0,
    entriesAttributed,
    allClear:
      agg.goalMet &&
      entriesAttributed &&
      included.length > 0 &&
      included.every((p) => p.openTasks === 0) &&
      openTasks.filter((r) => r.status === "awaiting_owner").length === 0,
  };
}

/** Formal closeout. Hours alone never close a program with open property work. */
export async function completeProgram(
  supabase: Client,
  userId: string,
  programId: string,
  admin: Client,
) {
  // Read before the aggregate: changes during any of its reads invalidate closeout.
  const version = await supabase
    .from("owner_programs")
    .select("report_version")
    .eq("id", programId)
    .single();
  if (version.error) throw version.error;
  const agg = await loadProgramAggregate(supabase, programId);
  if (!["active", "target_reached"].includes(agg.program.status)) {
    throw new Error("Only an active program can be completed. Resume a paused program first.");
  }
  const check = completionChecklist(agg);
  if (!check.hoursMet) throw new Error("The homeowner has not yet reported at least 100 hours.");
  if (!check.propertyTasksComplete) {
    throw new Error("Required owner tasks are still open on one or more properties.");
  }
  if (!check.decisionsReceived) throw new Error("Owner decisions are still outstanding.");
  if (!check.entriesAttributed)
    throw new Error("Every counted entry needs an activity description.");

  const report = buildProgramReportSnapshot(
    agg,
    await loadOwnerResponseReceipts(supabase, programId),
  );
  const { data: completed, error } = await admin.rpc("complete_owner_program", {
    _program_id: programId,
    _actor_id: userId,
    _expected_version: version.data.report_version,
    _report: report as unknown as Json,
  });
  if (error) throw error;
  if (!completed) throw new Error("The program changed. Refresh before completing it.");
  return { ok: true as const };
}

/** The single combined participation report for the whole program. */
export async function buildProgramReport(supabase: Client, programId: string) {
  const saved = await supabase
    .from("owner_programs")
    .select("status, completion_report")
    .eq("id", programId)
    .single();
  if (saved.error) throw saved.error;
  if (
    ["completed", "complete", "closed"].includes(saved.data.status) &&
    saved.data.completion_report !== null
  ) {
    return saved.data.completion_report;
  }
  const agg = await loadProgramAggregate(supabase, programId);
  return buildProgramReportSnapshot(agg, await loadOwnerResponseReceipts(supabase, programId));
}

/** The report and its closeout gates use the same loaded participation snapshot. */
export function buildProgramReportSnapshot(
  agg: Awaited<ReturnType<typeof loadProgramAggregate>>,
  responses: OwnerResponseReceipt[] = [],
) {
  const countedEntryIds = new Set(
    countedParticipationEntries(agg.entries, aggregateParticipationPeriod(agg))
      .map((entry) => entry.id),
  );
  const nameOf = (id: string) =>
    agg.properties.find((p) => p.propertyId === id)?.name ?? "Property";
  const reviewTitle = new Map(agg.reviews.map((r) => [r.id, r.title]));

  const log = [...agg.entries]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    .map((e) => ({
      date: e.entry_date,
      category: e.activity_category,
      activity: e.activity,
      minutes: e.minutes,
      hours: hoursFromMinutes(e.minutes),
      phase: e.phase,
      properties: e.propertyIds.map(nameOf),
      task: e.review_id ? (reviewTitle.get(e.review_id) ?? null) : null,
      decision: e.decision_outcome ?? e.output,
      comments: e.comments,
      ownerUpdate: e.owner_update_snapshot ?? null,
      correctionOf: e.amends_entry_id,
      correctionReason: e.correction_reason,
      attested: e.attested,
      reviewStatus: e.review_status,
      countsTowardTotal: countedEntryIds.has(e.id),
    }));

  const decisions = agg.reviews
    .filter((r) => r.owner_decision)
    .map((r) => ({
      title: r.title,
      taskType: r.task_type,
      properties: r.propertyIds.map(nameOf),
      decision: r.owner_decision,
      response: r.owner_response,
      respondedAt: r.responded_at,
      outcome: r.outcome,
    }));

  return {
    disclaimer: REPORT_DISCLAIMER,
    owner: { name: agg.program.ownerName, email: agg.program.ownerEmail },
    programDates: { startedOn: agg.program.startedOn, endsOn: agg.program.endsOn },
    properties: agg.includedProperties.map((p) => ({
      name: p.name,
      address: p.address,
      closingDate: p.closingDate,
      addedOn: p.addedOn,
      completedTasks: p.completedTasks,
      openTasks: p.openTasks,
    })),
    totals: {
      combinedHours: hoursFromMinutes(agg.reportedMinutes),
      onboardingHours: hoursFromMinutes(agg.onboardingMinutes),
      operationalHours: hoursFromMinutes(agg.operationalMinutes),
      entryCount: agg.entries.length,
    },
    log,
    decisions,
    responseHistory: responses.map((receipt) => ({
      ...receipt,
      ownerUpdate: receipt.ownerUpdate ? { ...receipt.ownerUpdate } : null,
      propertyName: receipt.propertyId ? nameOf(receipt.propertyId) : null,
      countsTowardTotal: false,
    })),
    badges: agg.badges,
    generatedAt: new Date().toISOString(),
  };
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 — read aloud safely

function newInviteCode() {
  const pick = () =>
    Array.from(
      { length: 4 },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join("");
  return `${pick()}-${pick()}`;
}

/** Issues a self-signup code the owner uses once, after closing. */
export async function createInvite(
  supabase: Client,
  userId: string,
  input: { programId: string; ownerEmail: string },
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInviteCode();
    const { data, error } = await supabase
      .from("owner_invites")
      .insert({
        code,
        program_id: input.programId,
        owner_email: input.ownerEmail || null,
        created_by: userId,
      })
      .select("code, expires_at")
      .maybeSingle();
    if (!error && data) return { code: data.code, expiresAt: data.expires_at };
    // 23505 is a code collision; anything else is a real failure.
    if (error && error.code !== "23505") throw error;
  }
  throw new Error("Could not generate an invite code. Please try again.");
}

export async function loadInvites(supabase: Client, programId: string) {
  const { data, error } = await supabase
    .from("owner_invites")
    .select("id, code, owner_email, expires_at, redeemed_at")
    .eq("program_id", programId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
