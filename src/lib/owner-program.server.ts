/**
 * Active Owner Participation Program — staff side (server-only).
 *
 * One homeowner has one program. A program can carry one home or several;
 * either way there is a single 90-day clock, a single combined commitment of
 * more than 100 hours and a single pace benchmark. Individual homes are
 * measured by the tasks and decisions they need, never by their own hour
 * target.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_ONBOARDING_HOURS,
  DEFAULT_ONGOING_HOURS,
  DEFAULT_TARGET_HOURS,
  PROGRAM_DAYS,
  type DecisionPath,
  type ProgramPhase,
  type TaskTemplate,
} from "./owner-program";
import {
  ACTIVATABLE_STATUSES,
  hoursFromMinutes,
  OPERATING_TARGET_HOURS,
  progressSnapshot,
  type ProgramStatus,
  type TaskType,
} from "./owner-participation";
import { combinedMinutes, loadProgramAggregate, recordEvent } from "./owner-participation.server";
import { syncBadges } from "./owner-badges.server";

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

function locationOf(p: { city: string | null; state: string | null }) {
  return [p.city, p.state].filter(Boolean).join(", ");
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  status: ProgramStatus;
  startedOn: string | null;
  endsOn: string | null;
  properties: { id: string; name: string; coverage: string; openTasks: number; overdue: number }[];
  day: number;
  daysLeft: number;
  reportedHours: number;
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
          "id, owner_user_id, owner_name, owner_email, status, started_on, ends_on, onboarding_lead, operations_lead, dfy_confirmed, last_owner_activity_at",
        )
        // Demo programs stay out of the production queue unless demo mode is on.
        .eq("is_demo", demo)
        .is("archived_at", null),
      supabase
        .from("owner_program_properties")
        .select(
          "id, program_id, property_id, inclusion_status, launch_status, coverage_status, last_owner_activity_at, properties(name, nickname)",
        ),
      supabase
        .from("owner_reviews")
        .select("id, program_id, property_id, status, respond_by, source_type, available_from"),
      supabase
        .from("owner_time_entries")
        .select("id, program_id, minutes, review_status")
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
    const myEntries = (entries.data ?? []).filter(
      (e) => e.program_id === p.id && e.review_status !== "returned",
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
      ownerName: p.owner_name,
      ownerEmail: p.owner_email,
      ownerLinked: Boolean(p.owner_user_id),
      status: p.status as ProgramStatus,
      startedOn: p.started_on,
      endsOn: p.ends_on,
      properties: propertyRows,
      day: snapshot.day,
      daysLeft: snapshot.daysLeft,
      reportedHours: hoursFromMinutes(reported),
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

/** Priority order for the "Owners needing attention" queue. */
export function attentionRank(row: AdminProgramRow) {
  const quietDays = row.lastOwnerActivityAt
    ? Math.floor((Date.now() - new Date(row.lastOwnerActivityAt).getTime()) / 86_400_000)
    : Infinity;
  const behind = -row.variance;
  if (row.status !== "active" && row.status !== "target_reached") return null;
  if (behind >= 10) return { rank: 1, reason: "10+ hours behind pace" };
  if (behind >= 5) return { rank: 2, reason: "5+ hours behind pace" };
  if (quietDays >= 7 && row.openTasks > 0)
    return { rank: 3, reason: "No activity for 7 days with open tasks" };
  if (row.daysLeft < 10 && row.reportedHours <= 100)
    return { rank: 4, reason: "Under 10 days without 100+ hours" };
  if (row.properties.some((p) => p.overdue > 0))
    return { rank: 5, reason: "Overdue property decisions" };
  if (row.properties.some((p) => p.coverage === "no_activity"))
    return { rank: 6, reason: "A property has no owner activity" };
  if (behind >= 1) return { rank: 7, reason: "Slightly behind pace" };
  return null;
}

/** Creates a draft program. The 90-day clock is never started here. */
export async function createProgram(
  supabase: Client,
  userId: string,
  input: { propertyId: string; ownerName: string; ownerEmail: string },
) {
  const existing = await supabase
    .from("owner_program_properties")
    .select("program_id")
    .eq("property_id", input.propertyId)
    .eq("inclusion_status", "included")
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return { programId: existing.data.program_id, alreadyExists: true as const };

  const { data, error } = await supabase
    .from("owner_programs")
    .insert({
      property_id: input.propertyId,
      owner_name: input.ownerName || null,
      owner_email: input.ownerEmail || null,
      status: "draft",
      started_on: null,
      ends_on: null,
      target_hours: DEFAULT_TARGET_HOURS,
      operating_target_hours: OPERATING_TARGET_HOURS,
      onboarding_target_hours: DEFAULT_ONBOARDING_HOURS,
      ongoing_target_hours: DEFAULT_ONGOING_HOURS,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  const link = await supabase.from("owner_program_properties").insert({
    program_id: data.id,
    property_id: input.propertyId,
    added_by: userId,
  });
  if (link.error) throw link.error;

  await recordEvent(supabase, {
    programId: data.id,
    kind: "program_created",
    summary: "Program created as a draft.",
    actorId: userId,
    propertyId: input.propertyId,
  });
  return { programId: data.id, alreadyExists: false as const };
}

/**
 * Adds another home to an existing program. After activation this needs an
 * administrator, the property must have closed, and the 90-day clock and the
 * combined hour commitment both stay exactly as they are.
 */
export async function addProgramProperty(
  supabase: Client,
  userId: string,
  input: { programId: string; propertyId: string; closingDate: string | null },
) {
  const program = await supabase
    .from("owner_programs")
    .select("id, status, started_on")
    .eq("id", input.programId)
    .single();
  if (program.error) throw program.error;

  const alreadyElsewhere = await supabase
    .from("owner_program_properties")
    .select("program_id")
    .eq("property_id", input.propertyId)
    .eq("inclusion_status", "included")
    .maybeSingle();
  if (alreadyElsewhere.error) throw alreadyElsewhere.error;
  if (alreadyElsewhere.data)
    throw new Error("That property is already part of a participation program.");

  const started = Boolean(program.data.started_on);
  if (started) {
    const admin = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (admin.error || !admin.data) {
      throw new Error(
        "Adding a property to a program already underway needs administrator approval.",
      );
    }
    if (!input.closingDate) {
      throw new Error("Confirm the property's closing date before adding it to an active program.");
    }
  }

  const { error } = await supabase.from("owner_program_properties").insert({
    program_id: input.programId,
    property_id: input.propertyId,
    closing_date: input.closingDate,
    closing_confirmed: Boolean(input.closingDate),
    added_by: userId,
    added_on: new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;

  await recordEvent(supabase, {
    programId: input.programId,
    kind: "property_added",
    summary: started
      ? "Property added after activation. The 90-day timeline and combined target are unchanged."
      : "Property added to the program.",
    actorId: userId,
    propertyId: input.propertyId,
    detail: { closingDate: input.closingDate },
  });
  return { ok: true as const };
}

export async function removeProgramProperty(
  supabase: Client,
  userId: string,
  input: { programId: string; propertyId: string; reason: string },
) {
  const { error } = await supabase
    .from("owner_program_properties")
    .update({ inclusion_status: "removed" })
    .eq("program_id", input.programId)
    .eq("property_id", input.propertyId);
  if (error) throw error;
  await recordEvent(supabase, {
    programId: input.programId,
    kind: "property_removed",
    summary: "Property removed from the program. Its history is preserved.",
    actorId: userId,
    propertyId: input.propertyId,
    reason: input.reason || null,
  });
  return { ok: true as const };
}

/** Records the closing confirmation that gates activation. */
export async function confirmPropertyClosing(
  supabase: Client,
  userId: string,
  input: { programId: string; propertyId: string; closingDate: string },
) {
  const { error } = await supabase
    .from("owner_program_properties")
    .update({ closing_date: input.closingDate, closing_confirmed: true })
    .eq("program_id", input.programId)
    .eq("property_id", input.propertyId);
  if (error) throw error;
  await recordEvent(supabase, {
    programId: input.programId,
    kind: "closing_confirmed",
    summary: `Closing confirmed for ${input.closingDate}.`,
    actorId: userId,
    propertyId: input.propertyId,
    newValue: input.closingDate,
  });
  return { ok: true as const };
}

/** Program settings that carry no participation time of their own. */
export async function updateProgramSettings(
  supabase: Client,
  userId: string,
  input: {
    programId: string;
    ownerName: string;
    ownerEmail: string;
    onboardingLead: string | null;
    operationsLead: string | null;
    dfyConfirmed: boolean;
    internalNotes: string;
  },
) {
  const { error } = await supabase
    .from("owner_programs")
    .update({
      owner_name: input.ownerName || null,
      owner_email: input.ownerEmail || null,
      onboarding_lead: input.onboardingLead,
      operations_lead: input.operationsLead,
      dfy_confirmed: input.dfyConfirmed,
      dfy_confirmed_at: input.dfyConfirmed ? new Date().toISOString() : null,
      internal_notes: input.internalNotes || null,
    })
    .eq("id", input.programId);
  if (error) throw error;
  await recordEvent(supabase, {
    programId: input.programId,
    kind: "program_updated",
    summary: "Program details updated.",
    actorId: userId,
  });
  return { ok: true as const };
}

/**
 * Manual activation. A closing date never starts a program on its own: an
 * authorized team member confirms every home has closed and DFY has agreed
 * the homes run as one combined program, then sets the single start date.
 */
export async function activateProgram(
  supabase: Client,
  userId: string,
  input: { programId: string; startedOn: string },
) {
  const program = await supabase
    .from("owner_programs")
    .select("id, status, started_on, dfy_confirmed")
    .eq("id", input.programId)
    .single();
  if (program.error) throw program.error;
  if (!ACTIVATABLE_STATUSES.includes(program.data.status as ProgramStatus)) {
    throw new Error("This program has already been activated.");
  }
  if (!program.data.dfy_confirmed) {
    throw new Error("Confirm with DFY that these properties run as one combined program first.");
  }

  const links = await supabase
    .from("owner_program_properties")
    .select("property_id, closing_confirmed")
    .eq("program_id", input.programId)
    .eq("inclusion_status", "included");
  if (links.error) throw links.error;
  if ((links.data ?? []).length === 0)
    throw new Error("Add at least one property before activating.");
  if ((links.data ?? []).some((l) => !l.closing_confirmed)) {
    throw new Error("Every property must have a confirmed closing date before activation.");
  }

  const { error } = await supabase
    .from("owner_programs")
    .update({
      started_on: input.startedOn,
      ends_on: addDays(input.startedOn, PROGRAM_DAYS - 1),
      status: "active",
      activated_at: new Date().toISOString(),
      activated_by: userId,
    })
    .eq("id", input.programId);
  if (error) throw error;

  await recordEvent(supabase, {
    programId: input.programId,
    kind: "program_activated",
    summary: `90-day program activated starting ${input.startedOn}.`,
    actorId: userId,
    newValue: input.startedOn,
  });
  return { ok: true as const };
}

/** Moves a program between the non-activation lifecycle states. */
export async function setProgramStatus(
  supabase: Client,
  userId: string,
  input: { programId: string; status: ProgramStatus },
) {
  const current = await supabase
    .from("owner_programs")
    .select("status")
    .eq("id", input.programId)
    .single();
  if (current.error) throw current.error;

  const { error } = await supabase
    .from("owner_programs")
    .update({ status: input.status })
    .eq("id", input.programId);
  if (error) throw error;
  await recordEvent(supabase, {
    programId: input.programId,
    kind: "status_changed",
    summary: `Program status changed to ${input.status.replace(/_/g, " ")}.`,
    actorId: userId,
    previousValue: current.data.status,
    newValue: input.status,
  });
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
) {
  const original = await supabase
    .from("owner_time_entries")
    .select(
      "id, program_id, owner_user_id, phase, entry_date, minutes, activity, review_id, ticket_id",
    )
    .eq("id", input.entryId)
    .single();
  if (original.error) throw original.error;

  const insert = await supabase
    .from("owner_time_entries")
    .insert({
      program_id: original.data.program_id,
      owner_user_id: original.data.owner_user_id,
      phase: original.data.phase,
      entry_date: original.data.entry_date,
      minutes: input.minutes,
      activity: `Correction: ${original.data.activity}`,
      review_id: original.data.review_id,
      ticket_id: original.data.ticket_id,
      amends_entry_id: original.data.id,
      correction_reason: input.reason,
      attested: true,
    })
    .select("id")
    .single();
  if (insert.error) throw insert.error;

  await recordEvent(supabase, {
    programId: original.data.program_id,
    kind: "time_corrected",
    summary: `Participation entry corrected from ${original.data.minutes} to ${input.minutes} minutes.`,
    actorId: userId,
    entryId: insert.data.id,
    previousValue: String(original.data.minutes),
    newValue: String(input.minutes),
    reason: input.reason,
  });

  const agg = await loadProgramAggregate(supabase, original.data.program_id);
  await syncBadges(supabase, agg);
  return { ok: true as const };
}

/**
 * Seeds owner tasks from the roadmap catalog. Program-wide tasks are created
 * once; property tasks are created per included home.
 */
export async function seedRoadmap(
  supabase: Client,
  userId: string,
  input: { programId: string; phase: ProgramPhase | "all" },
) {
  const program = await supabase
    .from("owner_programs")
    .select("id, started_on")
    .eq("id", input.programId)
    .single();
  if (program.error) throw program.error;

  const templates = await loadTaskTemplates(supabase);
  const wanted = templates.filter((t) => input.phase === "all" || t.phase === input.phase);

  const existing = await supabase
    .from("owner_reviews")
    .select("template_id, property_id")
    .eq("program_id", input.programId);
  if (existing.error) throw existing.error;
  const seeded = new Set(
    (existing.data ?? []).map((r) => `${r.template_id ?? ""}:${r.property_id ?? ""}`),
  );

  const links = await supabase
    .from("owner_program_properties")
    .select("property_id")
    .eq("program_id", input.programId)
    .eq("inclusion_status", "included");
  if (links.error) throw links.error;
  const propertyIds = (links.data ?? []).map((l) => l.property_id);

  const anchor = program.data.started_on ?? new Date().toISOString().slice(0, 10);
  const toInsert: Record<string, unknown>[] = [];
  for (const t of wanted) {
    // Onboarding work is per home; ongoing operating rhythm is program-wide.
    const perProperty = t.phase === "onboarding" && propertyIds.length > 0;
    const targets: (string | null)[] = perProperty ? propertyIds : [null];
    for (const propertyId of targets) {
      if (seeded.has(`${t.id}:${propertyId ?? ""}`)) continue;
      toInsert.push({
        program_id: input.programId,
        template_id: t.id,
        property_id: propertyId,
        task_type: (propertyId ? "property_specific" : "program_wide") satisfies TaskType,
        phase: t.phase,
        stage: t.stage,
        title: t.title,
        business_question: t.summary,
        recommendation: t.summary,
        impact: t.owner_action,
        decision_path: t.decision_path,
        respond_by: addDays(anchor, t.respond_within_days),
        status: "prepared",
        sort_order: t.sort_order,
        created_by: userId,
      });
    }
  }

  if (toInsert.length === 0) return { added: 0 };
  const { error } = await supabase.from("owner_reviews").insert(toInsert as never);
  if (error) throw error;
  await recordEvent(supabase, {
    programId: input.programId,
    kind: "roadmap_seeded",
    summary: `${toInsert.length} owner activities released.`,
    actorId: userId,
  });
  return { added: toInsert.length };
}

/** Everything the staff detail view shows for one program. */
export async function loadProgramDetail(supabase: Client, programId: string) {
  const agg = await loadProgramAggregate(supabase, programId);
  const history = await supabase
    .from("owner_program_events")
    .select("id, kind, summary, previous_value, new_value, reason, created_at")
    .eq("program_id", programId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (history.error) throw history.error;

  return {
    program: agg.program,
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
  return {
    hoursExceeded: agg.goalMet,
    propertyTasksComplete: included.length > 0 && included.every((p) => p.openTasks === 0),
    decisionsReceived: openTasks.filter((r) => r.status === "awaiting_owner").length === 0,
    entriesAttributed: agg.entries.every((e) => e.activity.trim().length > 0),
    allClear:
      agg.goalMet &&
      included.length > 0 &&
      included.every((p) => p.openTasks === 0) &&
      openTasks.filter((r) => r.status === "awaiting_owner").length === 0,
  };
}

/** Formal closeout. Hours alone never close a program with open property work. */
export async function completeProgram(supabase: Client, userId: string, programId: string) {
  const agg = await loadProgramAggregate(supabase, programId);
  const check = completionChecklist(agg);
  if (!check.hoursExceeded)
    throw new Error("The homeowner has not yet reported more than 100 hours.");
  if (!check.propertyTasksComplete) {
    throw new Error("Required owner tasks are still open on one or more properties.");
  }
  if (!check.decisionsReceived) throw new Error("Owner decisions are still outstanding.");

  const { error } = await supabase
    .from("owner_programs")
    .update({ status: "completed", completed_at: new Date().toISOString(), completed_by: userId })
    .eq("id", programId);
  if (error) throw error;
  await recordEvent(supabase, {
    programId,
    kind: "program_completed",
    summary: "ARHA completed the formal program closeout.",
    actorId: userId,
  });
  const refreshed = await loadProgramAggregate(supabase, programId);
  await syncBadges(supabase, refreshed);
  return { ok: true as const };
}

/** The single combined participation report for the whole program. */
export async function buildProgramReport(supabase: Client, programId: string) {
  const agg = await loadProgramAggregate(supabase, programId);
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
      correctionOf: e.amends_entry_id,
      correctionReason: e.correction_reason,
      attested: true,
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
