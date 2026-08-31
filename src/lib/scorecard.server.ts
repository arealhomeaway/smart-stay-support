/**
 * Vendor scorecard data access (server-only).
 *
 * Uses the admin client because scoring compares a vendor against the whole
 * ARHA vendor pool — but nothing that identifies another vendor ever leaves
 * this file for a vendor caller. They get their own numbers plus an anonymous
 * percentile.
 */

import {
  GOLD_STANDARD_JOBS,
  jobPoints,
  overallScore,
  tierFor,
  type RatingInput,
  type Tier,
} from "./scorecard";
import { excludeNonLiveTicketRows } from "./live-tickets";

export type VendorScorecard = {
  vendorUserId: string;
  points: number;
  ratedJobs: number;
  completedJobs: number;
  aboveAverageJobs: number;
  averageOverall: number | null;
  fleetAverage: number | null;
  thoroughnessAverage: number | null;
  photoRate: number | null;
  onTimeRate: number | null;
  reopenCount: number;
  streak: number;
  tier: Tier;
  jobsToGold: number;
  percentile: number | null; // anonymous: "top X%" of vendors
  recent: {
    ticketId: string;
    ref: number | null;
    title: string;
    createdAt: string;
    overall: number;
    points: number;
  }[];
};

type RatingRow = {
  ticket_id: string;
  vendor_user_id: string;
  overall: number | string;
  points: number;
  thoroughness: number;
  photos_complete: boolean;
  on_time: boolean;
  reopened: boolean;
  created_at: string;
};

function avg(values: number[]) {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
}

/** Records (or updates) a coordinator's rating of a finished vendor job. */
export async function rateVendorJob(input: {
  ticketId: string;
  ratedBy: string;
  rating: RatingInput;
  note: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from("tickets")
    .select("id, vendor_user_id, priority, ref, title")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (ticketError) throw ticketError;
  if (!ticket?.vendor_user_id) throw new Error("This ticket has no vendor assigned to score.");

  const rating = { ...input.rating, priority: ticket.priority };
  const points = jobPoints(rating);
  const overall = overallScore(rating);

  const { error } = await supabaseAdmin.from("vendor_job_ratings").upsert(
    {
      ticket_id: input.ticketId,
      vendor_user_id: ticket.vendor_user_id,
      rated_by: input.ratedBy,
      thoroughness: rating.thoroughness,
      communication: rating.communication,
      timeliness: rating.timeliness,
      photos_complete: rating.photosComplete,
      on_time: rating.onTime,
      reopened: rating.reopened,
      note: input.note,
      points,
      overall,
    },
    { onConflict: "ticket_id" },
  );
  if (error) throw error;

  await supabaseAdmin.from("ticket_activity").insert({
    ticket_id: input.ticketId,
    author_id: input.ratedBy,
    kind: "note",
    event_type: "note",
    channel: "vendor_portal",
    body: `Vendor job scored ${overall.toFixed(1)}/5 (${points} pts).${input.note ? `\n\n${input.note}` : ""}`,
  });

  return { ok: true as const, points, overall };
}

/** Existing rating for a ticket, if a coordinator has already scored it. */
export async function loadJobRating(ticketId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("vendor_job_ratings")
    .select("*")
    .eq("ticket_id", ticketId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * vendor_job_ratings has no is_demo/archived_at column of its own, so a demo
 * or pre-launch-archived ticket's rating is excluded by checking its ticket
 * directly, once here — every scorecard/scoreboard consumer of loadAllRatings
 * inherits the exclusion rather than needing to re-implement it.
 */
async function loadAllRatings(): Promise<RatingRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data, error }, { data: liveTickets, error: ticketsError }] = await Promise.all([
    supabaseAdmin
      .from("vendor_job_ratings")
      .select(
        "ticket_id, vendor_user_id, overall, points, thoroughness, photos_complete, on_time, reopened, created_at",
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("tickets").select("id").eq("is_demo", false).is("archived_at", null),
  ]);
  if (error) throw error;
  if (ticketsError) throw ticketsError;
  const liveTicketIds = new Set(((liveTickets ?? []) as { id: string }[]).map((t) => t.id));
  return excludeNonLiveTicketRows((data ?? []) as RatingRow[], liveTicketIds);
}

function build(vendorUserId: string, all: RatingRow[]): Omit<VendorScorecard, "recent" | "completedJobs"> {
  const fleetAverage = avg(all.map((r) => Number(r.overall)));
  const mine = all.filter((r) => r.vendor_user_id === vendorUserId);
  const overalls = mine.map((r) => Number(r.overall));
  const aboveAverageJobs =
    fleetAverage === null ? 0 : overalls.filter((o) => o >= fleetAverage).length;

  // Streak = consecutive most-recent jobs at or above the fleet average.
  let streak = 0;
  for (const r of mine) {
    if (fleetAverage !== null && Number(r.overall) >= fleetAverage) streak += 1;
    else break;
  }

  const points = mine.reduce((sum, r) => sum + r.points, 0);

  // Anonymous percentile against every vendor with at least one scored job.
  const totals = new Map<string, number>();
  for (const r of all) totals.set(r.vendor_user_id, (totals.get(r.vendor_user_id) ?? 0) + r.points);
  let percentile: number | null = null;
  if (totals.size > 1 && totals.has(vendorUserId)) {
    const sorted = [...totals.values()].sort((a, b) => b - a);
    const rank = sorted.findIndex((v) => v <= points) + 1;
    percentile = Math.max(1, Math.round((rank / sorted.length) * 100));
  }

  const tier = tierFor({ ratedJobs: mine.length, aboveAverageJobs });

  return {
    vendorUserId,
    points,
    ratedJobs: mine.length,
    aboveAverageJobs,
    averageOverall: avg(overalls),
    fleetAverage,
    thoroughnessAverage: avg(mine.map((r) => r.thoroughness)),
    photoRate: mine.length ? Math.round((mine.filter((r) => r.photos_complete).length / mine.length) * 100) : null,
    onTimeRate: mine.length ? Math.round((mine.filter((r) => r.on_time).length / mine.length) * 100) : null,
    reopenCount: mine.filter((r) => r.reopened).length,
    streak,
    tier,
    jobsToGold: Math.max(0, GOLD_STANDARD_JOBS - aboveAverageJobs),
    percentile,
  };
}

/** A single vendor's private scorecard (what they see in their portal). */
export async function loadVendorScorecard(vendorUserId: string): Promise<VendorScorecard> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const all = await loadAllRatings();
  const base = build(vendorUserId, all);

  const mine = all.filter((r) => r.vendor_user_id === vendorUserId).slice(0, 8);
  const { count } = await supabaseAdmin
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("vendor_user_id", vendorUserId)
    .eq("vendor_status", "completed")
    .eq("is_demo", false)
    .is("archived_at", null);

  let recent: VendorScorecard["recent"] = [];
  if (mine.length > 0) {
    const { data: tickets } = await supabaseAdmin
      .from("tickets")
      .select("id, ref, title")
      .in(
        "id",
        mine.map((r) => r.ticket_id),
      );
    const byId = new Map((tickets ?? []).map((t) => [t.id, t]));
    recent = mine.map((r) => ({
      ticketId: r.ticket_id,
      ref: byId.get(r.ticket_id)?.ref ?? null,
      title: byId.get(r.ticket_id)?.title ?? "Job",
      createdAt: r.created_at,
      overall: Number(r.overall),
      points: r.points,
    }));
  }

  return { ...base, completedJobs: count ?? 0, recent };
}

/** Staff view: every vendor's scorecard, named (internal only). */
export async function loadVendorScoreboard() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "vendor");
  const ids = (roles ?? []).map((r) => r.user_id);
  if (ids.length === 0) return { vendors: [] };

  const [{ data: profiles }, all] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, email").in("id", ids),
    loadAllRatings(),
  ]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email ?? "Vendor"]));

  const vendors = ids
    .map((id) => ({ name: nameById.get(id) ?? "Vendor", ...build(id, all) }))
    .sort((a, b) => b.points - a.points);

  return { vendors };
}
