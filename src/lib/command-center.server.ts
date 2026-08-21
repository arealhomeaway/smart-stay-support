/**
 * Executive Command Center (server-only).
 *
 * Exception-first company health across Operations, Vendors, Homeowners,
 * Onboarding and Data Quality. Every number comes from real records; when a
 * source does not exist yet the KPI is returned as "Data unavailable" with the
 * missing source named. Nothing here is a vanity metric and nothing is mocked.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CommandCenter, Kpi, KpiSection, KpiStatus } from "./command-center";

type Client = SupabaseClient<Database>;

export type CommandFilters = {
  days: number;
  market: string | null;
  propertyId: string | null;
  priority: string | null;
  team: string | null;
  vendorId: string | null;
};

const OPEN_STATUSES = ["new", "triage", "in_progress", "waiting", "scheduled", "open"];

function pct(n: number, d: number) {
  return d === 0 ? null : (n / d) * 100;
}

function fmt(value: number | null, unit: Kpi["unit"]) {
  if (value == null) return "—";
  if (unit === "percent") return `${value.toFixed(1)}%`;
  if (unit === "minutes") return value >= 120 ? `${(value / 60).toFixed(1)} h` : `${Math.round(value)} min`;
  if (unit === "days") return `${value.toFixed(1)} d`;
  if (unit === "score") return value.toFixed(2);
  if (unit === "hours") return `${value.toFixed(1)} h`;
  return String(Math.round(value));
}

/** Higher-is-better metrics grade against the target; lower-is-better invert. */
function grade(
  value: number | null,
  opts: { good: number; warn: number; higherIsBetter: boolean },
): KpiStatus {
  if (value == null) return "unknown";
  const { good, warn, higherIsBetter } = opts;
  if (higherIsBetter) return value >= good ? "green" : value >= warn ? "yellow" : "red";
  return value <= good ? "green" : value <= warn ? "yellow" : "red";
}

function kpi(input: Partial<Kpi> & Pick<Kpi, "key" | "label" | "unit">): Kpi {
  const value = input.value ?? null;
  const previous = input.previous ?? null;
  let trend: Kpi["trend"] = null;
  if (value != null && previous != null) {
    const delta = value - previous;
    trend = Math.abs(delta) < 0.001 ? "flat" : delta > 0 ? "up" : "down";
  }
  return {
    value,
    display: input.unavailable ? "Data unavailable" : fmt(value, input.unit),
    target: input.target ?? null,
    status: input.unavailable ? "unknown" : (input.status ?? "unknown"),
    denominator: input.denominator ?? null,
    previous,
    trend,
    drill: input.drill ?? null,
    unavailable: input.unavailable ?? null,
    note: input.note ?? null,
    ...{ key: input.key, label: input.label, unit: input.unit },
  };
}

const minutes = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 60000;

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export async function loadCommandCenter(
  supabase: Client,
  filters: CommandFilters,
): Promise<CommandCenter> {
  const now = new Date();
  const since = new Date(now.getTime() - filters.days * 86400000).toISOString();
  const priorSince = new Date(now.getTime() - filters.days * 2 * 86400000).toISOString();

  const [ticketsRes, propsRes, visitsRes, ratingsRes, reviewsRes, notifRes, programsRes, tasksRes, handoffRes, ticketHandoffRes, profilesRes] =
    await Promise.all([
      supabase
        .from("tickets")
        .select(
          "id, ref, priority, status, category, team:functional_role_code, reported_at, acknowledged_at, resolved_at, response_due_at, action_due_at, next_review_at, waiting_on, reopen_count, avoidable_reopen, closure_qa_result, closure_evidence, escalation_level, supervisor_caught, guest_impact, occupancy_status, final_communication_sent, property_id, vendor_user_id, vendor_status, accountable_owner, current_action_owner, external_source, external_id, properties(name, state)",
        )
        .gte("reported_at", priorSince)
        .limit(5000),
      supabase
        .from("properties")
        .select(
          "id, name, state, active, lifecycle_status, onboarding_stage, onboarding_started_at, handoff_accepted_at, latitude, longitude, address_line1, ownerrez_property_id",
        ),
      supabase
        .from("ticket_visits")
        .select("id, ticket_id, vendor_user_id, checked_in_at, checked_out_at, check_in_verified, minutes_on_site")
        .gte("checked_in_at", priorSince),
      supabase
        .from("vendor_job_ratings")
        .select("id, vendor_user_id, overall, thoroughness, timeliness, communication, photos_complete, reopened, on_time, created_at")
        .gte("created_at", priorSince),
      supabase
        .from("owner_reviews")
        .select("id, program_id, status, respond_by, notified_at, responded_at, created_at, property_id"),
      supabase
        .from("owner_notifications")
        .select("id, kind, created_at, delivered_at, email_status, read_at")
        .gte("created_at", priorSince),
      supabase
        .from("owner_programs")
        .select("id, status, target_hours, started_on, ends_on, property_id, last_owner_activity_at"),
      supabase.from("onboarding_tasks").select("*"),
      supabase.from("property_handoffs").select("*"),
      supabase.from("handoffs").select("id, ticket_id, status, created_at, responded_at").gte("created_at", priorSince),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const err = [ticketsRes, propsRes, visitsRes, ratingsRes, reviewsRes, notifRes, programsRes, tasksRes, handoffRes, ticketHandoffRes].find(
    (r) => r.error,
  );
  if (err?.error) throw err.error;

  const properties = propsRes.data ?? [];
  const propById = new Map(properties.map((p) => [p.id, p]));
  const profiles = profilesRes.data ?? [];

  const matchesFilters = (t: (typeof ticketsRes.data extends null ? never : NonNullable<typeof ticketsRes.data>)[number]) => {
    if (filters.propertyId && t.property_id !== filters.propertyId) return false;
    if (filters.priority && (t.priority ?? "").toLowerCase() !== filters.priority) return false;
    if (filters.team && t.team !== filters.team) return false;
    if (filters.vendorId && t.vendor_user_id !== filters.vendorId) return false;
    if (filters.market) {
      const state = t.property_id ? (propById.get(t.property_id)?.state ?? null) : null;
      if (state !== filters.market) return false;
    }
    return true;
  };

  const allTickets = (ticketsRes.data ?? []).filter(matchesFilters);
  const current = allTickets.filter((t) => t.reported_at >= since);
  const prior = allTickets.filter((t) => t.reported_at < since);

  // ---------- Operations ----------
  const responseAttainment = (rows: typeof current) => {
    const scoped = rows.filter((t) => t.response_due_at && t.acknowledged_at);
    const met = scoped.filter((t) => t.acknowledged_at! <= t.response_due_at!).length;
    return pct(met, scoped.length);
  };

  const ackMinutes = current
    .filter((t) => t.acknowledged_at)
    .map((t) => minutes(t.reported_at, t.acknowledged_at!));
  const resolveMinutes = current
    .filter((t) => t.resolved_at)
    .map((t) => minutes(t.reported_at, t.resolved_at!));

  const openGuestImpacting = allTickets.filter(
    (t) => OPEN_STATUSES.includes(t.status) && (t.guest_impact ?? "none") !== "none",
  );
  const overdueGuestImpacting = openGuestImpacting.filter(
    (t) => t.action_due_at && t.action_due_at < now.toISOString(),
  );
  const unacceptedHandoffs = (ticketHandoffRes.data ?? []).filter((h) => h.status === "pending");
  const waitingNoReview = allTickets.filter(
    (t) => t.status === "waiting" && !t.next_review_at,
  );
  const reopened = current.filter((t) => (t.reopen_count ?? 0) > 0);
  const closedCurrent = current.filter((t) => t.resolved_at);
  const firstTimeClosure = closedCurrent.filter((t) => (t.reopen_count ?? 0) === 0);
  const closureEvidence = closedCurrent.filter((t) => (t.closure_evidence ?? "").trim());
  const supervisorCaught = current.filter((t) => t.supervisor_caught);

  const operations: KpiSection = {
    key: "operations",
    label: "Operations",
    blurb: "Response standards, guest impact and closure quality.",
    kpis: [
      kpi({
        key: "response_attainment",
        label: "Response-standard attainment",
        unit: "percent",
        value: responseAttainment(current),
        previous: responseAttainment(prior),
        target: "95%",
        status: grade(responseAttainment(current), { good: 95, warn: 85, higherIsBetter: true }),
        denominator: `${current.filter((t) => t.response_due_at && t.acknowledged_at).length} acknowledged matters with a response clock`,
        drill: { to: "/tickets", label: "Open matters" },
      }),
      kpi({
        key: "median_ack",
        label: "Median time to acknowledge",
        unit: "minutes",
        value: median(ackMinutes),
        previous: median(prior.filter((t) => t.acknowledged_at).map((t) => minutes(t.reported_at, t.acknowledged_at!))),
        target: "P1 ≤ 3 min",
        status: grade(median(ackMinutes), { good: 15, warn: 45, higherIsBetter: false }),
        denominator: `${ackMinutes.length} acknowledged matters`,
        drill: { to: "/analytics", label: "SLA detail" },
      }),
      kpi({
        key: "median_resolve",
        label: "Median time to resolve",
        unit: "minutes",
        value: median(resolveMinutes),
        previous: median(prior.filter((t) => t.resolved_at).map((t) => minutes(t.reported_at, t.resolved_at!))),
        target: "Work-type standard",
        status: grade(median(resolveMinutes), { good: 1440, warn: 4320, higherIsBetter: false }),
        denominator: `${resolveMinutes.length} resolved matters`,
        drill: { to: "/analytics", label: "SLA detail" },
      }),
      kpi({
        key: "open_guest_impacting",
        label: "Open guest-impacting matters",
        unit: "count",
        value: openGuestImpacting.length,
        target: "0 overdue",
        status: overdueGuestImpacting.length ? "red" : openGuestImpacting.length > 10 ? "yellow" : "green",
        denominator: `${overdueGuestImpacting.length} of them overdue`,
        drill: { to: "/tickets", label: "Guest-impacting queue" },
      }),
      kpi({
        key: "unaccepted_handoffs",
        label: "Unaccepted handoffs",
        unit: "count",
        value: unacceptedHandoffs.length,
        target: "0",
        status: unacceptedHandoffs.length === 0 ? "green" : unacceptedHandoffs.length < 3 ? "yellow" : "red",
        denominator: `${(ticketHandoffRes.data ?? []).length} handoffs in window`,
        drill: { to: "/oversight", label: "Oversight queue" },
        note: "A handoff is not complete until it is accepted — the original owner stays responsible.",
      }),
      kpi({
        key: "waiting_no_review",
        label: "Waiting matters without a review date",
        unit: "count",
        value: waitingNoReview.length,
        target: "0",
        status: waitingNoReview.length === 0 ? "green" : waitingNoReview.length < 5 ? "yellow" : "red",
        denominator: `${allTickets.filter((t) => t.status === "waiting").length} waiting matters`,
        drill: { to: "/oversight", label: "Waiting queue" },
      }),
      kpi({
        key: "reopen_rate",
        label: "Reopen / repeat-issue rate",
        unit: "percent",
        value: pct(reopened.length, current.length),
        previous: pct(prior.filter((t) => (t.reopen_count ?? 0) > 0).length, prior.length),
        target: "≤ 5%",
        status: grade(pct(reopened.length, current.length), { good: 5, warn: 10, higherIsBetter: false }),
        denominator: `${current.length} matters in window`,
        drill: { to: "/analytics", label: "Root-cause view" },
      }),
      kpi({
        key: "first_time_closure",
        label: "First-time closure rate",
        unit: "percent",
        value: pct(firstTimeClosure.length, closedCurrent.length),
        target: "≥ 90%",
        status: grade(pct(firstTimeClosure.length, closedCurrent.length), { good: 90, warn: 80, higherIsBetter: true }),
        denominator: `${closedCurrent.length} resolved matters`,
        drill: { to: "/analytics", label: "Closure detail" },
      }),
      kpi({
        key: "closure_evidence",
        label: "Closure evidence completeness",
        unit: "percent",
        value: pct(closureEvidence.length, closedCurrent.length),
        target: "100%",
        status: grade(pct(closureEvidence.length, closedCurrent.length), { good: 98, warn: 90, higherIsBetter: true }),
        denominator: `${closedCurrent.length} resolved matters`,
        drill: { to: "/oversight", label: "Closure QA" },
      }),
      kpi({
        key: "supervisor_intervention",
        label: "Supervisor intervention rate",
        unit: "percent",
        value: pct(supervisorCaught.length, current.length),
        previous: pct(prior.filter((t) => t.supervisor_caught).length, prior.length),
        target: "≤ 10%",
        status: grade(pct(supervisorCaught.length, current.length), { good: 10, warn: 20, higherIsBetter: false }),
        denominator: `${current.length} matters in window`,
        drill: { to: "/oversight", label: "Interventions" },
      }),
      kpi({
        key: "issue_rate_per_100_stays",
        label: "Issue rate per 100 occupied stays",
        unit: "count",
        value: null,
        target: "Baseline needed",
        denominator: "Occupied stays in window",
        unavailable:
          "Reservation counts are not stored in Resolve. Needs an OwnerRez booking sync writing stay start/end dates per property.",
        drill: { to: "/integrations", label: "Integrations" },
      }),
    ],
  };

  // ---------- Vendors ----------
  const vendorTickets = allTickets.filter((t) => t.vendor_user_id);
  const vendorCurrent = vendorTickets.filter((t) => t.reported_at >= since);
  const visits = (visitsRes.data ?? []).filter((v) => v.checked_in_at >= since);
  const ratings = (ratingsRes.data ?? []).filter((r) => r.created_at >= since);
  const priorRatings = (ratingsRes.data ?? []).filter((r) => r.created_at < since);
  const onTime = ratings.filter((r) => r.on_time).length;
  const evidenceComplete = ratings.filter((r) => r.photos_complete).length;
  const vendorReopen = ratings.filter((r) => r.reopened).length;
  const criticalFailures = ratings.filter((r) => Number(r.overall) < 2.5).length;
  const avgScore = ratings.length
    ? ratings.reduce((sum, r) => sum + Number(r.overall), 0) / ratings.length
    : null;
  const priorAvg = priorRatings.length
    ? priorRatings.reduce((sum, r) => sum + Number(r.overall), 0) / priorRatings.length
    : null;
  const vendorFirstTime = vendorCurrent.filter(
    (t) => t.vendor_status === "completed" && (t.reopen_count ?? 0) === 0,
  ).length;
  const vendorCompleted = vendorCurrent.filter((t) => t.vendor_status === "completed").length;

  const vendors: KpiSection = {
    key: "vendors",
    label: "Vendors",
    blurb: "Reliability, evidence and coverage. Scores stay private to each vendor.",
    kpis: [
      kpi({
        key: "vendor_on_time",
        label: "On-time arrival & completion",
        unit: "percent",
        value: pct(onTime, ratings.length),
        previous: pct(priorRatings.filter((r) => r.on_time).length, priorRatings.length),
        target: "≥ 90%",
        status: grade(pct(onTime, ratings.length), { good: 90, warn: 80, higherIsBetter: true }),
        denominator: `${ratings.length} rated jobs`,
        drill: { to: "/team", label: "Vendor scoreboard" },
      }),
      kpi({
        key: "vendor_first_time",
        label: "First-time completion rate",
        unit: "percent",
        value: pct(vendorFirstTime, vendorCompleted),
        target: "≥ 90%",
        status: grade(pct(vendorFirstTime, vendorCompleted), { good: 90, warn: 80, higherIsBetter: true }),
        denominator: `${vendorCompleted} vendor-completed matters`,
        drill: { to: "/tickets", label: "Vendor work" },
      }),
      kpi({
        key: "vendor_return_visits",
        label: "Reopen / return-visit rate",
        unit: "percent",
        value: pct(vendorReopen, ratings.length),
        target: "≤ 8%",
        status: grade(pct(vendorReopen, ratings.length), { good: 8, warn: 15, higherIsBetter: false }),
        denominator: `${ratings.length} rated jobs · ${visits.length} site visits`,
        drill: { to: "/team", label: "Vendor scoreboard" },
      }),
      kpi({
        key: "vendor_evidence",
        label: "Required-evidence completion",
        unit: "percent",
        value: pct(evidenceComplete, ratings.length),
        target: "100%",
        status: grade(pct(evidenceComplete, ratings.length), { good: 98, warn: 90, higherIsBetter: true }),
        denominator: `${ratings.length} rated jobs`,
        drill: { to: "/team", label: "Evidence gaps" },
      }),
      kpi({
        key: "vendor_critical",
        label: "Critical failures & verified complaints",
        unit: "count",
        value: criticalFailures,
        target: "0",
        status: criticalFailures === 0 ? "green" : criticalFailures < 3 ? "yellow" : "red",
        denominator: `${ratings.length} rated jobs (overall below 2.5)`,
        drill: { to: "/team", label: "Vendor scoreboard" },
      }),
      kpi({
        key: "vendor_quality",
        label: "Rolling quality score",
        unit: "score",
        value: avgScore,
        previous: priorAvg,
        target: "≥ 4.0 of 5",
        status: grade(avgScore, { good: 4, warn: 3.5, higherIsBetter: true }),
        denominator: `${ratings.length} rated jobs`,
        drill: { to: "/team", label: "Vendor scoreboard" },
      }),
      kpi({
        key: "vendor_cost_variance",
        label: "Cost variance by comparable work type",
        unit: "percent",
        value: null,
        target: "±10%",
        denominator: "Invoiced jobs by work type",
        unavailable:
          "Resolve stores no invoice or cost amounts. Needs a cost field on matters (or an accounting sync) before this can be trusted.",
      }),
    ],
  };

  // ---------- Homeowners ----------
  const reviews = reviewsRes.data ?? [];
  const awaiting = reviews.filter((r) => r.status === "awaiting_owner");
  const aging = awaiting.filter(
    (r) => r.respond_by && new Date(r.respond_by) < now,
  );
  const ownerImpacting = allTickets.filter(
    (t) => OPEN_STATUSES.includes(t.status) && t.category === "owner",
  );
  const notifications = notifRes.data ?? [];
  const deliveredOnTime = notifications.filter(
    (n) => n.delivered_at && minutes(n.created_at, n.delivered_at) <= 60,
  ).length;
  const activePrograms = (programsRes.data ?? []).filter((p) => p.status === "active");
  const quietPrograms = activePrograms.filter(
    (p) => !p.last_owner_activity_at || minutes(p.last_owner_activity_at, now.toISOString()) > 7 * 1440,
  );

  const homeowners: KpiSection = {
    key: "homeowners",
    label: "Homeowners",
    blurb: "Decisions we owe them, decisions they owe us, and participation health.",
    kpis: [
      kpi({
        key: "owner_awaiting",
        label: "Owner approvals awaiting response",
        unit: "count",
        value: awaiting.length,
        target: "0 aged",
        status: aging.length ? "red" : awaiting.length > 5 ? "yellow" : "green",
        denominator: `${reviews.length} owner reviews on record`,
        drill: { to: "/owner-programs", label: "Owner programs" },
      }),
      kpi({
        key: "owner_aging",
        label: "Aging owner decisions (past respond-by)",
        unit: "count",
        value: aging.length,
        target: "0",
        status: aging.length === 0 ? "green" : aging.length < 3 ? "yellow" : "red",
        denominator: `${awaiting.length} awaiting decisions`,
        drill: { to: "/owner-programs", label: "Attention queue" },
      }),
      kpi({
        key: "owner_matters",
        label: "Unresolved owner-impacting matters",
        unit: "count",
        value: ownerImpacting.length,
        target: "Trend down",
        status: ownerImpacting.length === 0 ? "green" : ownerImpacting.length < 8 ? "yellow" : "red",
        denominator: `${allTickets.filter((t) => t.category === "owner").length} owner matters in window`,
        drill: { to: "/tickets", label: "Owner matters" },
      }),
      kpi({
        key: "owner_comm_timeliness",
        label: "Communication timeliness (≤ 1 h to send)",
        unit: "percent",
        value: pct(deliveredOnTime, notifications.filter((n) => n.email_status !== "skipped").length),
        target: "≥ 95%",
        status: grade(
          pct(deliveredOnTime, notifications.filter((n) => n.email_status !== "skipped").length),
          { good: 95, warn: 85, higherIsBetter: true },
        ),
        denominator: `${notifications.filter((n) => n.email_status !== "skipped").length} owner notifications attempted`,
        drill: { to: "/owner-programs", label: "Notification log" },
        note: "Sent-and-delivered only. Logins and message volume are never treated as success.",
      }),
      kpi({
        key: "owner_participation_risk",
        label: "Participation benchmark risk",
        unit: "count",
        value: activePrograms.length ? quietPrograms.length : null,
        target: "0 programs at risk",
        status: activePrograms.length
          ? quietPrograms.length === 0
            ? "green"
            : quietPrograms.length < 3
              ? "yellow"
              : "red"
          : "unknown",
        denominator: `${activePrograms.length} active participation programs`,
        unavailable: activePrograms.length
          ? null
          : "No participation program is active yet. Activate a 90-day program to populate this.",
        drill: { to: "/owner-programs", label: "Programs" },
      }),
    ],
  };

  // ---------- Onboarding ----------
  const tasks = tasksRes.data ?? [];
  const handoffs = handoffRes.data ?? [];
  const pipeline = properties.filter(
    (p) => (p.lifecycle_status ?? "active_operations") !== "active_operations" &&
      (p.lifecycle_status ?? "") !== "offboarded",
  );
  const blockedTasks = tasks.filter((t) => t.status === "blocked" || (t.blocker ?? "").trim());
  const overdueTasks = tasks.filter(
    (t) => t.status !== "complete" && t.due_on && new Date(t.due_on) < now,
  );
  const requiredComplete = tasks.filter((t) => t.blocks_handoff && t.status === "complete").length;
  const requiredTotal = tasks.filter((t) => t.blocks_handoff).length;
  const evidenceOk = tasks.filter(
    (t) => t.evidence_required && (t.evidence_note ?? "").trim(),
  ).length;
  const evidenceNeeded = tasks.filter((t) => t.evidence_required).length;
  const ownerApprovalsOut = tasks.filter(
    (t) => t.requires_owner_approval && t.owner_approval_status === "pending",
  ).length;
  const reviewed = handoffs.filter((h) => h.status !== "requested");
  const acceptedFirstPass = (() => {
    const byProperty = new Map<string, typeof handoffs>();
    for (const h of handoffs) {
      const list = byProperty.get(h.property_id) ?? [];
      list.push(h);
      byProperty.set(h.property_id, list);
    }
    let first = 0;
    let total = 0;
    for (const list of byProperty.values()) {
      const ordered = [...list].sort((a, b) => a.requested_at.localeCompare(b.requested_at));
      const firstReviewed = ordered.find((h) => h.status !== "requested");
      if (!firstReviewed) continue;
      total += 1;
      if (firstReviewed.status === "accepted") first += 1;
    }
    return { first, total };
  })();
  const stageDays = (() => {
    const started = pipeline.filter((p) => p.onboarding_started_at);
    if (!started.length) return null;
    return (
      started.reduce(
        (sum, p) => sum + minutes(p.onboarding_started_at!, now.toISOString()) / 1440,
        0,
      ) / started.length
    );
  })();
  const acceptedProps = properties.filter((p) => p.handoff_accepted_at);
  const postHandoffDefects = allTickets.filter((t) => {
    if (!t.property_id) return false;
    const accepted = propById.get(t.property_id)?.handoff_accepted_at;
    if (!accepted) return false;
    const age = minutes(accepted, t.reported_at) / 1440;
    return age >= 0 && age <= 30;
  }).length;

  const onboarding: KpiSection = {
    key: "onboarding",
    label: "Onboarding",
    blurb: "Pre-handoff pipeline health and the quality of what operations inherits.",
    kpis: [
      kpi({
        key: "pipeline",
        label: "Properties in onboarding pipeline",
        unit: "count",
        value: pipeline.length,
        target: "Moving, not stuck",
        status: pipeline.length === 0 ? "green" : overdueTasks.length ? "yellow" : "green",
        denominator: `${properties.length} properties total`,
        drill: { to: "/onboarding", label: "Onboarding workspace" },
      }),
      kpi({
        key: "days_in_stage",
        label: "Average days since onboarding started",
        unit: "days",
        value: stageDays,
        target: "≤ 45 d",
        status: grade(stageDays, { good: 45, warn: 75, higherIsBetter: false }),
        denominator: `${pipeline.filter((p) => p.onboarding_started_at).length} properties with a start date`,
        unavailable: stageDays == null ? "No property has an onboarding start date yet." : null,
        drill: { to: "/onboarding", label: "Pipeline" },
      }),
      kpi({
        key: "blocked",
        label: "Blocked or overdue onboarding tasks",
        unit: "count",
        value: blockedTasks.length + overdueTasks.length,
        target: "0",
        status: blockedTasks.length + overdueTasks.length === 0 ? "green" : "red",
        denominator: `${tasks.filter((t) => t.status !== "complete").length} open tasks`,
        drill: { to: "/onboarding", label: "Blockers" },
      }),
      kpi({
        key: "required_records",
        label: "Required-record completion",
        unit: "percent",
        value: pct(requiredComplete, requiredTotal),
        target: "100% before handoff",
        status: grade(pct(requiredComplete, requiredTotal), { good: 100, warn: 80, higherIsBetter: true }),
        denominator: `${requiredTotal} handoff-blocking tasks`,
        unavailable: requiredTotal === 0 ? "No handoff-blocking onboarding tasks recorded yet." : null,
        drill: { to: "/onboarding", label: "Checklist" },
      }),
      kpi({
        key: "owner_approvals_onboarding",
        label: "Outstanding owner approvals",
        unit: "count",
        value: ownerApprovalsOut,
        target: "0 before handoff",
        status: ownerApprovalsOut === 0 ? "green" : "yellow",
        denominator: `${tasks.filter((t) => t.requires_owner_approval).length} approval-gated tasks`,
        drill: { to: "/onboarding", label: "Approvals" },
      }),
      kpi({
        key: "readiness_evidence",
        label: "Readiness-checklist evidence complete",
        unit: "percent",
        value: pct(evidenceOk, evidenceNeeded),
        target: "100%",
        status: grade(pct(evidenceOk, evidenceNeeded), { good: 100, warn: 85, higherIsBetter: true }),
        denominator: `${evidenceNeeded} evidence-required tasks`,
        unavailable: evidenceNeeded === 0 ? "No evidence-required onboarding tasks recorded yet." : null,
        drill: { to: "/onboarding", label: "Evidence" },
      }),
      kpi({
        key: "first_pass_handoff",
        label: "First-pass handoff acceptance",
        unit: "percent",
        value: pct(acceptedFirstPass.first, acceptedFirstPass.total),
        target: "≥ 80%",
        status: grade(pct(acceptedFirstPass.first, acceptedFirstPass.total), { good: 80, warn: 60, higherIsBetter: true }),
        denominator: `${acceptedFirstPass.total} properties reviewed · ${reviewed.length} reviews`,
        unavailable: acceptedFirstPass.total === 0 ? "No handoff has been reviewed yet." : null,
        drill: { to: "/onboarding", label: "Handoff queue" },
      }),
      kpi({
        key: "post_handoff_defects",
        label: "Post-handoff defects within 30 days",
        unit: "count",
        value: acceptedProps.length ? postHandoffDefects : null,
        target: "≤ 1 per property",
        status: acceptedProps.length
          ? postHandoffDefects === 0
            ? "green"
            : postHandoffDefects <= acceptedProps.length
              ? "yellow"
              : "red"
          : "unknown",
        denominator: `${acceptedProps.length} accepted handoffs`,
        unavailable: acceptedProps.length ? null : "No handoff has been accepted in Resolve yet.",
        drill: { to: "/tickets", label: "New-property matters" },
      }),
    ],
  };

  // ---------- Data quality ----------
  const missingPropertyId = allTickets.filter((t) => !t.property_id).length;
  const unmatchedSource = allTickets.filter((t) => t.external_source && !t.property_id).length;
  const duplicateSource = (() => {
    const seen = new Map<string, number>();
    for (const t of allTickets) {
      if (!t.external_source || !t.external_id) continue;
      const key = `${t.external_source}:${t.external_id}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.values()].filter((n) => n > 1).length;
  })();
  const missingGeocode = properties.filter(
    (p) => p.active && (p.latitude == null || p.longitude == null),
  ).length;
  const missingOwnership = allTickets.filter(
    (t) => OPEN_STATUSES.includes(t.status) && !t.accountable_owner && !t.current_action_owner,
  ).length;
  const missingPriority = allTickets.filter((t) => !t.priority).length;

  const dataQuality: KpiSection = {
    key: "data_quality",
    label: "Data quality",
    blurb: "The plumbing every other number depends on.",
    kpis: [
      kpi({
        key: "missing_property_id",
        label: "Matters with no Property ID",
        unit: "count",
        value: missingPropertyId,
        target: "0",
        status: missingPropertyId === 0 ? "green" : missingPropertyId < 5 ? "yellow" : "red",
        denominator: `${allTickets.length} matters in window`,
        drill: { to: "/tickets", label: "Unmatched matters" },
      }),
      kpi({
        key: "unmatched_source",
        label: "Synced records that never matched a property",
        unit: "count",
        value: unmatchedSource,
        target: "0",
        status: unmatchedSource === 0 ? "green" : "red",
        denominator: `${allTickets.filter((t) => t.external_source).length} synced records`,
        drill: { to: "/integrations", label: "Integrations" },
      }),
      kpi({
        key: "duplicate_source",
        label: "Duplicate source records",
        unit: "count",
        value: duplicateSource,
        target: "0",
        status: duplicateSource === 0 ? "green" : "red",
        denominator: "Distinct external source IDs",
        drill: { to: "/integrations", label: "Sync log" },
      }),
      kpi({
        key: "missing_geocode",
        label: "Active properties missing a geocode",
        unit: "count",
        value: missingGeocode,
        target: "0",
        status: missingGeocode === 0 ? "green" : "yellow",
        denominator: `${properties.filter((p) => p.active).length} active properties`,
        drill: { to: "/properties", label: "Properties" },
      }),
      kpi({
        key: "missing_ownership",
        label: "Open matters with no accountable owner",
        unit: "count",
        value: missingOwnership,
        target: "0",
        status: missingOwnership === 0 ? "green" : "red",
        denominator: `${allTickets.filter((t) => OPEN_STATUSES.includes(t.status)).length} open matters`,
        drill: { to: "/oversight", label: "Ownership gaps" },
      }),
      kpi({
        key: "missing_priority",
        label: "Matters missing a priority",
        unit: "count",
        value: missingPriority,
        target: "0",
        status: missingPriority === 0 ? "green" : "red",
        denominator: `${allTickets.length} matters in window`,
        drill: { to: "/tickets", label: "Matters" },
      }),
      kpi({
        key: "waiting_no_review_dq",
        label: "Records missing a next-review date",
        unit: "count",
        value: waitingNoReview.length,
        target: "0",
        status: waitingNoReview.length === 0 ? "green" : "red",
        denominator: `${allTickets.filter((t) => t.status === "waiting").length} waiting matters`,
        drill: { to: "/oversight", label: "Waiting queue" },
      }),
    ],
  };

  // Coverage risk by market: homes we serve vs vendors who actually worked there.
  const coverage = (() => {
    const markets = new Map<string, { properties: Set<string>; vendors: Set<string> }>();
    for (const p of properties) {
      if (!p.active) continue;
      const key = p.state ?? "Unknown";
      const entry = markets.get(key) ?? { properties: new Set(), vendors: new Set() };
      entry.properties.add(p.id);
      markets.set(key, entry);
    }
    for (const t of allTickets) {
      if (!t.vendor_user_id || !t.property_id) continue;
      const key = propById.get(t.property_id)?.state ?? "Unknown";
      const entry = markets.get(key) ?? { properties: new Set(), vendors: new Set() };
      entry.vendors.add(t.vendor_user_id);
      markets.set(key, entry);
    }
    return [...markets.entries()].map(([market, e]) => ({
      market,
      properties: e.properties.size,
      vendors: e.vendors.size,
      risk: (e.vendors.size === 0 ? "red" : e.vendors.size < 2 ? "yellow" : "green") as KpiStatus,
    }));
  })();

  const vendorIds = [...new Set(allTickets.map((t) => t.vendor_user_id).filter(Boolean))] as string[];

  return {
    generatedAt: now.toISOString(),
    windowDays: filters.days,
    filters: {
      markets: [...new Set(properties.map((p) => p.state).filter(Boolean))] as string[],
      properties: properties.map((p) => ({ id: p.id, name: p.name })),
      vendors: vendorIds.map((id) => ({
        id,
        name: profiles.find((p) => p.id === id)?.full_name ?? "Vendor",
      })),
      teams: [...new Set(allTickets.map((t) => t.team).filter(Boolean))] as string[],
    },
    sections: [operations, vendors, homeowners, onboarding, dataQuality],
    coverage,
  };
}
