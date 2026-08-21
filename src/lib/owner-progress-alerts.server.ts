/**
 * Daily participation-pace evaluation (server-only).
 *
 * Owner alerts are encouraging, never punitive, and never mention tax
 * outcomes. The same alert is not repeated inside seven days unless the
 * situation became more urgent. Property gaps are a separate, internal
 * concern: they speak to unfinished tasks and decisions, never to hours.
 */

import {
  hoursFromMinutes,
  OWNER_GOAL_HOURS,
  PROGRESS_SEVERITY,
  PROGRESS_META,
  nextMilestone,
} from "./owner-participation";
import { loadProgramAggregate, recordEvent, type Client, type ProgramAggregate } from "./owner-participation.server";

const WEEK_MS = 7 * 86_400_000;

type Candidate = {
  kind: string;
  alertKind: string;
  severity: number;
  title: string;
  body: string;
};

function daysSince(iso: string | null) {
  if (!iso) return Infinity;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Which owner-facing nudges the current picture justifies today. */
export function candidateAlerts(agg: ProgramAggregate): Candidate[] {
  const out: Candidate[] = [];
  const s = agg.snapshot;
  const hours = hoursFromMinutes(agg.reportedMinutes);
  const openTasks = agg.reviews.filter((r) => !["answered", "closed"].includes(r.status));
  if (!agg.program.startedOn || s.day === 0) return out;

  if (hours > OWNER_GOAL_HOURS) {
    out.push({
      kind: "goal_exceeded",
      alertKind: "progress_celebration",
      severity: 0,
      title: "You have passed 100 hours of reported participation",
      body: `Congratulations — you have reported ${hours} hours across your program. Thank you for the time and care you have put in. Please keep recording any remaining activities as you complete them.`,
    });
    return out;
  }

  const behind = -s.variance;

  // Give every owner a gentle first week before any pace message.
  if (s.day > 7 && behind >= 1) {
    out.push({
      kind: `pace_${s.state}`,
      alertKind: "progress_pace",
      severity: PROGRESS_SEVERITY[s.state],
      title: PROGRESS_META[s.state].label,
      body: `You are currently a few hours behind your recommended pace. Please review your available activities and confirm that you have entered the time for any work you recently completed.`,
    });
  }

  const quiet = daysSince(agg.lastOwnerActivityAt);
  if (quiet >= 7 && openTasks.length > 0) {
    out.push({
      kind: "quiet_week",
      alertKind: "progress_quiet",
      severity: 2,
      title: "A few activities are still waiting for you",
      body: `It has been about a week since your last participation entry and you have ${openTasks.length} activit${openTasks.length === 1 ? "y" : "ies"} open. If you have already done the work, please record the time you spent.`,
    });
  }

  const next = nextMilestone(s.day);
  if (behind >= 1 && next.day - s.day <= 5) {
    out.push({
      kind: `milestone_${next.day}`,
      alertKind: "progress_milestone",
      severity: 2,
      title: `Day ${next.day} milestone is coming up`,
      body: `The day ${next.day} pace milestone is ${next.hours} hours. You have reported ${hours} so far — a good moment to log anything you have completed recently.`,
    });
  }

  if (s.daysLeft <= 5) {
    out.push({
      kind: "final_five_days",
      alertKind: "progress_deadline",
      severity: 4,
      title: "Five days remain in your 90-day program",
      body: `You have reported ${hours} hours. Please review your remaining activities and record any participation you have not yet entered.`,
    });
  } else if (s.daysLeft <= 10) {
    out.push({
      kind: "final_ten_days",
      alertKind: "progress_deadline",
      severity: 3,
      title: "Ten days remain in your 90-day program",
      body: `You have reported ${hours} hours. There is still good time to complete your remaining activities and record them.`,
    });
  }

  return out;
}

/**
 * Evaluates one program and queues any owner alert that is due. Returns the
 * alert kinds sent.
 */
export async function evaluateProgramAlerts(supabase: Client, programId: string) {
  const agg = await loadProgramAggregate(supabase, programId);
  if (!["active", "target_reached"].includes(agg.program.status)) return { sent: [] as string[] };

  const candidates = candidateAlerts(agg);
  if (candidates.length === 0) return { sent: [] as string[] };

  const recent = await supabase
    .from("owner_alert_log")
    .select("alert_kind, severity, sent_at")
    .eq("program_id", programId)
    .gte("sent_at", new Date(Date.now() - WEEK_MS).toISOString());
  if (recent.error) throw recent.error;

  const sent: string[] = [];
  for (const c of candidates) {
    const prior = (recent.data ?? []).filter((r) => r.alert_kind === c.kind);
    const suppressed = prior.some((r) => r.severity >= c.severity);
    if (suppressed) continue;

    const insert = await supabase.from("owner_notifications").insert({
      program_id: programId,
      owner_user_id: agg.program.ownerUserId,
      kind: c.alertKind,
      priority: "p3",
      title: c.title,
      body: c.body,
      action_path: "/owner",
      email_status: agg.program.notifyEmail ? "pending" : "skipped",
      sms_status: "skipped",
    });
    if (insert.error) continue;

    await supabase.from("owner_alert_log").insert({
      program_id: programId,
      alert_kind: c.kind,
      severity: c.severity,
      status_at_send: agg.snapshot.state,
    });
    await recordEvent(supabase, {
      programId,
      kind: "alert_sent",
      summary: c.title,
      newValue: c.kind,
    });
    sent.push(c.kind);
  }

  await syncCoverageAlerts(supabase, agg);
  return { sent };
}

/**
 * Internal-only property coverage alerts. These are about unfinished tasks
 * and decisions — never about a per-property hour deficiency.
 */
export async function syncCoverageAlerts(supabase: Client, agg: ProgramAggregate) {
  const included = agg.includedProperties;
  if (included.length === 0) return;

  const open = await supabase
    .from("owner_contact_alerts")
    .select("id, title")
    .eq("program_id", agg.program.id)
    .eq("status", "pending");
  if (open.error) return;
  const existing = new Set((open.data ?? []).map((a) => a.title));

  const busiest = [...included].sort(
    (a, b) => b.directMinutes + b.sharedMinutes - (a.directMinutes + a.sharedMinutes),
  )[0];

  const rows: { title: string; body: string; reason: string }[] = [];
  for (const p of included) {
    if (p.directMinutes + p.sharedMinutes === 0) {
      rows.push({
        title: `No owner activity yet at ${p.name}`,
        body: `${p.name} has ${p.openTasks} open owner activit${p.openTasks === 1 ? "y" : "ies"} and no participation recorded.`,
        reason: "property_no_activity",
      });
    }
    if (p.overdueDecisions > 0) {
      rows.push({
        title: `Overdue owner decisions at ${p.name}`,
        body: `${p.overdueDecisions} owner decision${p.overdueDecisions === 1 ? " is" : "s are"} past their response date.`,
        reason: "property_overdue_decisions",
      });
    }
    if (["ready", "launching"].includes(p.launchStatus) && p.openTasks > 0) {
      rows.push({
        title: `${p.name} is approaching launch with open items`,
        body: `${p.openTasks} owner activit${p.openTasks === 1 ? "y remains" : "ies remain"} open while this home moves toward launch.`,
        reason: "property_launch_risk",
      });
    }
    if (
      busiest &&
      p.propertyId !== busiest.propertyId &&
      p.directMinutes + p.sharedMinutes === 0 &&
      busiest.directMinutes + busiest.sharedMinutes > 0 &&
      p.openTasks > 0
    ) {
      rows.push({
        title: `Participation is concentrated away from ${p.name}`,
        body: `Activity is focused on ${busiest.name} while ${p.name} still has required owner work untouched.`,
        reason: "property_uneven_coverage",
      });
    }
  }

  if (agg.goalMet && included.some((p) => p.openTasks > 0)) {
    rows.push({
      title: "Owner passed 100 hours with property work still open",
      body: "The combined hour goal is met, but required property tasks or decisions remain outstanding.",
      reason: "goal_met_work_open",
    });
  }

  const fresh = rows.filter((r) => !existing.has(r.title));
  if (fresh.length === 0) return;

  await supabase.from("owner_contact_alerts").insert(
    fresh.map((r) => ({
      program_id: agg.program.id,
      priority: "p3",
      owner_name: agg.program.ownerName,
      owner_phone: agg.program.ownerPhone,
      owner_email: agg.program.ownerEmail,
      title: r.title,
      body: r.body,
      reason: r.reason,
      status: "pending",
    })),
  );
}

/** Runs the daily evaluation across every active program. */
export async function evaluateAllPrograms(supabase: Client) {
  const programs = await supabase
    .from("owner_programs")
    .select("id")
    .in("status", ["active", "target_reached"]);
  if (programs.error) throw programs.error;

  let sent = 0;
  for (const p of programs.data ?? []) {
    try {
      const result = await evaluateProgramAlerts(supabase, p.id);
      sent += result.sent.length;
    } catch (err) {
      console.error("progress alert evaluation failed", p.id, err);
    }
  }
  return { programs: (programs.data ?? []).length, sent };
}
