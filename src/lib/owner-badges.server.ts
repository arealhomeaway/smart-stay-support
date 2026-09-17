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
  countableParticipationEntries,
  inParticipationWindow,
  participationWindowEnd,
} from "./owner-participation";
import { type Client, type ProgramAggregate } from "./owner-participation.server";

const CLOSED = new Set(["answered", "closed"]);

function programWeek(startedOn: string, isoDate: string) {
  const start = new Date(`${startedOn}T00:00:00Z`).getTime();
  const day = Math.floor((new Date(`${isoDate}T00:00:00Z`).getTime() - start) / 86_400_000) + 1;
  return day < 1 ? 1 : Math.ceil(day / 7);
}

/** Which badge codes the current record supports, and why. */
export function earnedBadges(agg: ProgramAggregate): { code: string; rule: string }[] {
  const out: { code: string; rule: string }[] = [];
  const entries = [
    ...new Map(
      countableParticipationEntries(agg.entries)
        .filter((e) =>
          inParticipationWindow(e.entry_date, agg.program.startedOn, agg.program.endsOn),
        )
        .map((e) => [e.id, e]),
    ).values(),
  ];
  const minutes = entries.reduce((total, e) => total + e.minutes, 0);
  const hours = hoursFromMinutes(minutes);
  const included = agg.includedProperties;
  const propertyIds = new Set(included.map((p) => p.propertyId));
  const reviews = agg.reviews.filter(
    (r) =>
      ["awaiting_owner", "returned", "answered", "closed"].includes(r.status) &&
      (!r.available_from || r.available_from <= new Date().toISOString()) &&
      r.propertyIds.every((id) => propertyIds.has(id)),
  );
  const responses = reviews.filter(
    (r) =>
      CLOSED.has(r.status) &&
      r.responded_at &&
      inParticipationWindow(r.responded_at.slice(0, 10), agg.program.startedOn, agg.program.endsOn),
  );
  const add = (code: string, rule: string) => out.push({ code, rule });

  if (entries.length > 0) add("first_step", "First participation entry recorded");

  for (const code of ["building_momentum", "engaged_owner", "halfway", "strong_finish"]) {
    const def = BADGE_BY_CODE[code];
    if (def?.hours != null && minutes >= def.hours * 60) {
      add(code, `${hours} reported hours reached the ${def.hours}-hour milestone`);
    }
  }
  if (ownerGoalMet(minutes)) add("hundred_plus", `${hours} reported hours met the 100-hour target`);

  const onboardingReviews = reviews.filter((r) => r.phase === "onboarding");
  const onboardingDone =
    onboardingReviews.length > 0 && onboardingReviews.every((r) => CLOSED.has(r.status));
  if (minutes >= 3600 && onboardingDone) {
    add("onboarding_champion", "60 reported hours with all onboarding activities complete");
  }

  if (responses.some((r) => r.owner_decision?.trim()))
    add("decision_maker", "First owner decision completed");

  if (agg.program.startedOn) {
    const weeks = new Set(entries.map((e) => programWeek(agg.program.startedOn!, e.entry_date)));
    if (weeks.size >= 3)
      add("consistent_participation", `Activity reported in ${weeks.size} program weeks`);

    // Three consecutive weekly checkpoints where cumulative reported hours met the pace benchmark.
    const sorted = [...entries].sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    let streak = 0;
    let best = 0;
    const end = participationWindowEnd(agg.program.startedOn, agg.program.endsOn)!;
    const lastDay = [end, new Date().toISOString().slice(0, 10)].sort()[0]!;
    const windowDays = Math.max(
      0,
      Math.min(
        90,
        Math.floor(
          (Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${agg.program.startedOn}T00:00:00Z`)) /
            86_400_000,
        ) + 1,
      ),
    );
    for (let week = 1; week <= Math.floor(windowDays / 7); week++) {
      const day = week * 7;
      const cutoff = new Date(`${agg.program.startedOn}T00:00:00Z`);
      cutoff.setUTCDate(cutoff.getUTCDate() + day - 1);
      const iso = cutoff.toISOString().slice(0, 10);
      const cumulative = hoursFromMinutes(
        sorted.filter((e) => e.entry_date <= iso).reduce((n, e) => n + e.minutes, 0),
      );
      streak = cumulative >= benchmarkHours(day) ? streak + 1 : 0;
      best = Math.max(best, streak);
    }
    if (best >= 3) add("on_track_owner", "Met three consecutive weekly pace benchmarks");
  }

  const onTimeResponses = responses.filter(
    (r) => r.responded_at && r.respond_by && r.responded_at.slice(0, 10) <= r.respond_by,
  );
  if (onTimeResponses.length >= 10) {
    add(
      "responsive_partner",
      `${onTimeResponses.length} activities completed by their response dates`,
    );
  }

  const properties = included.map((p) => {
    const mine = reviews.filter((r) => r.propertyIds.includes(p.propertyId));
    return {
      ...p,
      requiredTasks: mine.length,
      openTasks: mine.filter((r) => !CLOSED.has(r.status)).length,
      outstandingDecisions: mine.filter((r) => r.status === "awaiting_owner").length,
      participated: entries.some((e) => e.propertyIds.includes(p.propertyId)),
    };
  });
  const launchReady = properties.filter(
    (p) =>
      ["ready", "launched"].includes(p.launchStatus) && p.openTasks === 0 && p.requiredTasks > 0,
  );
  if (launchReady.length > 0) {
    add("property_launch_partner", `Pre-launch decisions complete for ${launchReady[0]!.name}`);
  }

  if (included.length > 1) {
    if (properties.every((p) => p.participated)) {
      add("portfolio_participant", "Participation recorded for every included property");
    }
    if (properties.every((p) => p.requiredTasks > 0 && p.outstandingDecisions === 0)) {
      add("portfolio_decision_maker", "Required owner decisions completed across all properties");
    }
    if (launchReady.length === included.length) {
      add(
        "portfolio_launch_partner",
        "Every included property met its launch-readiness requirements",
      );
    }
  }

  if (
    (agg.program.status === "completed" || agg.program.status === "complete") &&
    agg.program.completedAt
  ) {
    add("program_complete", "ARHA completed the formal program closeout");
  }

  return out;
}

/** Two checked service calls; calculation and all transitions happen in one transaction. */
export async function syncProgramBadges(admin: Client, actorId: string, programId: string) {
  const version = await admin.rpc("owner_badge_refresh_version", {
    _program_id: programId,
    _actor_id: actorId,
  });
  if (version.error) throw version.error;
  if (typeof version.data !== "string" || version.data.trim().length === 0)
    throw new Error("Could not confirm the participation version.");
  const result = await admin.rpc("refresh_owner_badges", {
    _program_id: programId,
    _expected_version: version.data,
    _actor_id: actorId,
  });
  if (result.error) throw result.error;
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data))
    throw new Error("Could not confirm achievement refresh.");
  const reportVersion = result.data["reportVersion"];
  if (typeof reportVersion !== "string" || reportVersion.trim().length === 0)
    throw new Error("Could not confirm the achievement report version.");
  const codes = (value: unknown): string[] => {
    if (!Array.isArray(value)) throw new Error("Could not confirm achievement transitions.");
    const parsed: string[] = [];
    for (const code of value) {
      if (typeof code !== "string" || !Object.prototype.hasOwnProperty.call(BADGE_BY_CODE, code))
        throw new Error("Could not confirm achievement transitions.");
      parsed.push(code);
    }
    return parsed;
  };
  return {
    awarded: codes(result.data["awarded"]),
    flagged: codes(result.data["flagged"]),
    recovered: codes(result.data["recovered"]),
    reportVersion,
  };
}
