import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireSupervisor(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("is_supervisor", { _user_id: userId });
  if (!ok) throw new Error("Only supervisors can work reservation matching.");
}

/** Dry run over real recent data. Creates no Departure Reviews or Tickets and writes nothing. */
export const previewDepartureMatching = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { days?: number } | undefined) => ({ days: Math.min(Math.max(Number(i?.days ?? 30), 7), 90) }))
  .handler(async ({ data, context }) => {
    await requireSupervisor(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { previewMatching } = await import("./departure-matching.server");
    return previewMatching(supabaseAdmin, data.days);
  });

/** Manually links a clean that needs a reservation match. Audited; future runs keep it. */
export const linkCleanReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { matchId: string; bookingId: string }) => {
    if (!i?.matchId || !/^\d+$/.test(i.bookingId ?? "")) throw new Error("Pick a reservation");
    return i;
  })
  .handler(async ({ data, context }) => {
    await requireSupervisor(context.supabase, context.userId);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { data: m } = await admin.from("departure_clean_matches").select("*").eq("id", data.matchId).maybeSingle();
    if (!m) throw new Error("Match record not found");
    const cand = (m.candidates as { id: string; guest?: string | null; arrival?: string; departure?: string; code?: string | null }[]).find((c) => c.id === data.bookingId);
    if (!cand) throw new Error("That reservation is not one of the possible matches.");
    const holder = await admin.from("departure_clean_matches").select("id").eq("state", "matched").eq("ownerrez_booking_id", data.bookingId).neq("id", m.id).maybeSingle();
    if (holder.data) throw new Error("Another departure clean already holds this reservation.");
    const now = new Date().toISOString();
    const { error } = await admin.from("departure_clean_matches").update({
      state: "matched", ownerrez_booking_id: data.bookingId, checkout_date: cand.departure ?? null, match_method: "manual", confidence: "manual",
      reason: "Linked manually by a supervisor", is_manual: true, decided_by: context.userId, decided_at: now,
      reservation: { guest_name: cand.guest ?? null, arrival: cand.arrival ?? null, departure: cand.departure ?? null, reservation_code: cand.code ?? null, ownerrez_booking_id: data.bookingId },
    }).eq("id", m.id);
    if (error) throw new Error(error.message);
    await admin.from("departure_clean_match_events").insert({
      match_id: m.id, event_type: "manual_link", from_state: m.state, to_state: "matched", ownerrez_booking_id: data.bookingId,
      summary: `Reservation ${cand.code ?? data.bookingId} linked manually`, actor_id: context.userId,
    });
    const { writeAudit } = await import("./audit.server");
    await writeAudit({ actorId: context.userId, action: "departure_clean.manual_link", entityType: "departure_clean_match", entityId: m.id, entityLabel: `Task ${m.breezeway_task_id} → reservation ${data.bookingId}` });
    // Real homes stay gated inside the function; demo homes get their review.
    await admin.rpc("create_departure_review_from_clean", { _wo_id: m.breezeway_work_order_id });
    return { ok: true };
  });
