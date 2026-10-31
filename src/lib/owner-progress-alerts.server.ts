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
  ownerGoalMet,
  PROGRESS_SEVERITY,
  PROGRESS_META,
  nextMilestone,
} from "./owner-participation";
import { milestoneCheckpoints, milestoneWindow } from "./owner-milestones";
import {
  loadProgramAggregate,
  recordEvent,
  type Client,
  type ProgramAggregate,
} from "./owner-participation.server";

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

  if (ownerGoalMet(agg.reportedMinutes)) {
    out.push({
      kind: "goal_exceeded",
      alertKind: "progress_celebration",
      severity: 0,
      title: "You have reached at least 100 hours of reported participation",
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

  // Hour checkpoint check-in. One gentle message per checkpoint window,
  // encouraging either way, and never a statement about tax treatment.
  const checkpoint = milestoneWindow(s.day, s.totalDays);
  if (checkpoint) {
    const view = milestoneCheckpoints({ day: s.day, totalDays: s.totalDays, reportedHours: hours }).find(
      (c) => c.day === checkpoint,
    );
    const onPace = view?.state === "met";
    out.push({
      kind: `checkpoint_${checkpoint}`,
      alertKind: "progress_checkpoint",
      severity: onPace ? 1 : 3,
      title: `${view?.expectedHours ?? 0}-hour check-in`,
      body: onPace
        ? `You have ${hours} hours logged — right on pace for your program, which runs through ${s.endsOn ?? "December 31"}. Thank you for keeping your entries up to date.`
        : `You have ${hours} hours logged, a little behind the ${view?.expectedHours ?? 0}-hour point for this stage of your program (through ${s.endsOn ?? "December 31"}). If you have participated in anything you have not logged yet, this is a good moment to add it.`,
    });
  }

  const next = nextMilestone(s.day, s.totalDays);
  if (behind >= 1 && next.day - s.day <= 5) {
    out.push({
      kind: `milestone_${next.day}`,
      alertKind: "progress_milestone",
      severity: 2,
      title: `${next.hours}-hour milestone is coming up`,
      body: `Your next pace milestone is ${next.hours} hours. You have reported ${hours} so far — a good moment to log anything you have completed recently.`,
    });
  }

  if (s.daysLeft <= 5) {
    out.push({
      kind: "final_five_days",
      alertKind: "progress_deadline",
      severity: 4,
      title: "Five days remain in your program year",
      body: `You have reported ${hours} hours. Please review your remaining activities and record any participation you have not yet entered.`,
    });
  } else if (s.daysLeft <= 10) {
    out.push({
      kind: "final_ten_days",
      alertKind: "progress_deadline",
      severity: 3,
      title: "Ten days remain in your program year",
      body: `You have reported ${hours} hours. There is still good time to complete your remaining activities and record them.`,
    });
  }

  return out;
}

/**
 * Evaluates one program and queues any owner alert that is due. Returns the
 * alert kinds sent.
 */
export async function evaluateProgramAlerts(supabase: Client, programId: string, jobRunId?: string) {
  const context = await supabase.from("owner_programs").select("is_demo").eq("id", programId).single();
  if (context.error || !context.data) throw new Error("Program delivery context unavailable.");
  const isDemo = context.data.is_demo !== false;
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
      is_demo: isDemo,
      email_status: !isDemo && agg.program.notifyEmail ? "pending" : "skipped",
      sms_status: "skipped",
      ...(jobRunId ? { email_job_run_id: jobRunId } : {}),
    } as never);
    if (insert.error) throw insert.error;

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
 * Staff follow-ups. The retired call/text queue is replaced by one My Work
 * follow-up per home, routed to the Project Manager or follow-up seat.
 */
export async function syncCoverageAlerts(supabase: Client, agg: ProgramAggregate) {
  const { syncProgramFollowUps } = await import("./owner-followups.server");
  await syncProgramFollowUps(supabase as never, agg.program.id);
}

/** Runs the daily evaluation across every active program. */
export async function evaluateAllPrograms(supabase: Client, jobRunId?: string) {
  const programs = await supabase
    .from("owner_programs")
    .select("id")
    .in("status", ["active", "target_reached"]);
  if (programs.error) throw programs.error;

  let sent = 0;
  const notes: string[] = [];
  for (const p of programs.data ?? []) {
    try {
      const result = await evaluateProgramAlerts(supabase, p.id, jobRunId);
      sent += result.sent.length;
    } catch (err) {
      console.error("progress alert evaluation failed", p.id, err);
      notes.push(err instanceof Error ? err.message : "Progress evaluation failed");
    }
  }
  return { programs: (programs.data ?? []).length, sent, notes };
}
