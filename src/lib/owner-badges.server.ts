/**
 * Badge evaluation (server-only).
 *
 * Badges only ever *read* participation. They never create, estimate or
 * suggest time, and hour badges are computed from distinct participation
 * entry ids so a shared multi-property activity counts once.
 */

import {
  BADGE_BY_CODE,
  benchmarkHours,
  hoursFromMinutes,
  ownerGoalMet,
} from "./owner-participation";
import { recordEvent, type Client, type ProgramAggregate } from "./owner-participation.server";

const CLOSED = new Set(["answered", "closed"]);

function programWeek(startedOn: string, isoDate: string) {
  const start = new Date(`${startedOn}T00:00:00`).getTime();
  const day = Math.floor((new Date(`${isoDate}T00:00:00`).getTime() - start) / 86_400_000) + 1;
  return day < 1 ? 1 : Math.ceil(day / 7);
}

/** Which badge codes the current record supports, and why. */
export function earnedBadges(agg: ProgramAggregate): { code: string; rule: string }[] {
  const out: { code: string; rule: string }[] = [];
  const hours = hoursFromMinutes(agg.reportedMinutes);
  const entries = agg.entries;
  const included = agg.includedProperties;
  const add = (code: string, rule: string) => out.push({ code, rule });

  if (entries.length > 0) add("first_step", "First participation entry recorded");

  for (const code of ["building_momentum", "engaged_owner", "halfway", "strong_finish"]) {
    const def = BADGE_BY_CODE[code];
    if (def?.hours != null && hours >= def.hours) {
      add(code, `${hours} reported hours reached the ${def.hours}-hour milestone`);
    }
  }
  if (ownerGoalMet(agg.reportedMinutes))
    add("hundred_plus", `${hours} reported hours met the 100-hour target`);

  const onboardingReviews = agg.reviews.filter((r) => r.phase === "onboarding");
  const onboardingDone =
    onboardingReviews.length > 0 && onboardingReviews.every((r) => CLOSED.has(r.status));
  if (hours >= 60 && onboardingDone) {
    add("onboarding_champion", "60 reported hours with all onboarding activities complete");
  }

  if (agg.reviews.some((r) => r.owner_decision))
    add("decision_maker", "First owner decision completed");

  if (agg.program.startedOn) {
    const weeks = new Set(entries.map((e) => programWeek(agg.program.startedOn!, e.entry_date)));
    if (weeks.size >= 3)
      add("consistent_participation", `Activity reported in ${weeks.size} program weeks`);

    // Three consecutive weekly checkpoints where cumulative reported hours met the pace benchmark.
    const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    let streak = 0;
    let best = 0;
    for (let week = 1; week <= Math.floor(agg.snapshot.day / 7); week++) {
      const day = week * 7;
      const cutoff = new Date(`${agg.program.startedOn}T00:00:00`);
      cutoff.setDate(cutoff.getDate() + day - 1);
      const iso = cutoff.toISOString().slice(0, 10);
      const cumulative = hoursFromMinutes(
        sorted.filter((e) => e.entry_date <= iso).reduce((n, e) => n + e.minutes, 0),
      );
      streak = cumulative >= benchmarkHours(day) ? streak + 1 : 0;
      best = Math.max(best, streak);
    }
    if (best >= 3) add("on_track_owner", "Met three consecutive weekly pace benchmarks");
  }

  const onTimeResponses = agg.reviews.filter(
    (r) => r.responded_at && r.respond_by && r.responded_at.slice(0, 10) <= r.respond_by,
  );
  if (onTimeResponses.length >= 10) {
    add(
      "responsive_partner",
      `${onTimeResponses.length} activities completed by their response dates`,
    );
  }

  const launchReady = included.filter(
    (p) =>
      ["ready", "launched"].includes(p.launchStatus) && p.openTasks === 0 && p.requiredTasks > 0,
  );
  if (launchReady.length > 0) {
    add("property_launch_partner", `Pre-launch decisions complete for ${launchReady[0]!.name}`);
  }

  if (included.length > 1) {
    if (included.every((p) => p.directMinutes + p.sharedMinutes > 0)) {
      add("portfolio_participant", "Participation recorded for every included property");
    }
    if (included.every((p) => p.requiredTasks > 0 && p.outstandingDecisions === 0)) {
      add("portfolio_decision_maker", "Required owner decisions completed across all properties");
    }
    if (launchReady.length === included.length) {
      add(
        "portfolio_launch_partner",
        "Every included property met its launch-readiness requirements",
      );
    }
  }

  if (agg.program.status === "completed" || agg.program.status === "complete") {
    add("program_complete", "ARHA completed the formal program closeout");
  }

  return out;
}

/**
 * Awards anything newly earned and flags any previously awarded hour badge a
 * correction has invalidated. Nothing is ever silently removed.
 */
export async function syncBadges(supabase: Client, agg: ProgramAggregate) {
  const earned = earnedBadges(agg);
  const have = new Set(agg.badges.map((b) => b.code));
  const earnedCodes = new Set(earned.map((b) => b.code));

  const toAward = earned.filter((b) => !have.has(b.code));
  if (toAward.length > 0) {
    const { error } = await supabase.from("owner_badges").insert(
      toAward.map((b) => ({
        program_id: agg.program.id,
        code: b.code,
        trigger_rule: b.rule,
        supporting: {
          reportedMinutes: agg.reportedMinutes,
          entryIds: agg.entries.map((e) => e.id).slice(0, 200),
          evaluatedAt: new Date().toISOString(),
        } as never,
      })),
    );
    if (!error) {
      for (const b of toAward) {
        await recordEvent(supabase, {
          programId: agg.program.id,
          kind: "badge_awarded",
          summary: `Badge earned: ${BADGE_BY_CODE[b.code]?.name ?? b.code}`,
          newValue: b.code,
          reason: b.rule,
        });
      }
    }
  }

  // A corrected entry can pull the total back below a badge already granted.
  const invalidated = agg.badges.filter(
    (b) => !earnedCodes.has(b.code) && !b.needs_review && BADGE_BY_CODE[b.code]?.kind === "hours",
  );
  for (const b of invalidated) {
    await supabase
      .from("owner_badges")
      .update({
        needs_review: true,
        review_note: "A correction changed the reported total below this milestone.",
      })
      .eq("program_id", agg.program.id)
      .eq("code", b.code);
    await recordEvent(supabase, {
      programId: agg.program.id,
      kind: "badge_flagged",
      summary: `Badge flagged for review: ${BADGE_BY_CODE[b.code]?.name ?? b.code}`,
      newValue: b.code,
      reason: "Reported total fell below the milestone after a correction.",
    });
  }

  return { awarded: toAward.map((b) => b.code) };
}
