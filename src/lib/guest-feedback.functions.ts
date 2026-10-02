import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseSurveyAnswers, surveySummary, needsFollowUp } from "./guest-feedback";

/* ================= Public (guest-facing, no login) ================= */

const FRIENDLY = {
  not_found: "We couldn't find a stay with that last name and checkout date. Please check both and try again.",
  ambiguous: "We found more than one stay with those details. Please use the link from your checkout email.",
  expired: "This survey is open for 14 days after checkout. Thank you for staying with us.",
  bad_code: "This survey link isn't valid anymore. You can still find your stay below.",
} as const;

/** Turns a checkout-email code, or last name + checkout date, into a signed survey link. */
export const startGuestSurvey = createServerFn({ method: "POST" })
  .inputValidator((input: { code?: string; lastName?: string; checkout?: string }) => {
    const code = typeof input?.code === "string" ? input.code.slice(0, 60) : undefined;
    const lastName = typeof input?.lastName === "string" ? input.lastName.trim().slice(0, 80) : undefined;
    const checkout = typeof input?.checkout === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.checkout) ? input.checkout : undefined;
    if (!code && !(lastName && checkout)) throw new Error("Please enter your last name and checkout date.");
    return { code, lastName, checkout };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const gf = await import("./guest-feedback.server");
    try {
      if (data.code) {
        const stay = await gf.findStayByConfirmation(supabaseAdmin, data.code);
        if (!stay) return { ok: false as const, message: FRIENDLY.bad_code };
        return { ok: true as const, token: await gf.signSurveyToken(stay) };
      }
      const r = await gf.findStayByNameAndCheckout(supabaseAdmin, data.lastName!, data.checkout!);
      if (!r.ok) return { ok: false as const, message: FRIENDLY[r.reason] };
      return { ok: true as const, token: await gf.signSurveyToken(r.stay) };
    } catch (err) {
      console.error("startGuestSurvey failed", err);
      return { ok: false as const, message: "We couldn't look up your stay right now. Please try again in a few minutes." };
    }
  });

/** Guest-safe context for one survey link. Never returns internal data. */
export const getGuestSurvey = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string }) => {
    if (typeof input?.token !== "string" || input.token.length > 2000) throw new Error("Invalid link");
    return input;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifySurveyToken } = await import("./guest-feedback.server");
    const stay = await verifySurveyToken(data.token);
    if (!stay) return { ok: false as const };
    const [{ data: prop }, { data: existing }] = await Promise.all([
      supabaseAdmin.from("properties").select("name, nickname, city, state").eq("id", stay.p).maybeSingle(),
      supabaseAdmin
        .from("guest_feedback")
        .select("id")
        .eq("feedback_type", "internal_survey")
        .eq("property_id", stay.p)
        .eq("ownerrez_booking_id", stay.b)
        .maybeSingle(),
    ]);
    const homeName = (prop?.nickname || prop?.name || "your stay").replace(/^DEMO\s*—\s*/i, "");
    return {
      ok: true as const,
      homeName,
      place: [prop?.city, prop?.state].filter(Boolean).join(", ") || null,
      firstName: stay.g?.split(" ")[0] ?? null,
      arrival: stay.a,
      departure: stay.d,
      completed: !!existing,
    };
  });

export const submitGuestSurvey = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; answers: unknown }) => {
    if (typeof input?.token !== "string" || input.token.length > 2000) throw new Error("Invalid link");
    return { token: input.token, answers: parseSurveyAnswers(input.answers) };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifySurveyToken, createFollowUpTicket } = await import("./guest-feedback.server");
    const stay = await verifySurveyToken(data.token);
    if (!stay) return { ok: false as const, message: "This survey link has expired." };
    const a = data.answers;
    const { data: fb, error } = await supabaseAdmin
      .from("guest_feedback")
      .insert({
        feedback_type: "internal_survey",
        source: "resolve_survey",
        property_id: stay.p,
        ownerrez_booking_id: stay.b,
        reservation_match: "matched",
        guest_id: stay.gid,
        guest_name: stay.g,
        rating: a.overall,
        summary: surveySummary(a) || null,
        stay_start: stay.a,
        stay_end: stay.d,
        booking_platform: stay.ch,
        issue_categories: a.issue_categories ?? [],
        follow_up_required: needsFollowUp(a.overall),
        follow_up_status: needsFollowUp(a.overall) ? "open" : "none",
        is_demo: stay.demo,
      })
      .select("*")
      .single();
    if (error) {
      // One survey per stay: a repeat submission shows the completion page, no new work.
      if (error.code === "23505") return { ok: true as const, duplicate: true };
      console.error("survey insert failed", error.message);
      return { ok: false as const, message: "We couldn't save your answers. Please try again." };
    }
    await supabaseAdmin.from("guest_survey_responses").insert({
      feedback_id: fb.id,
      answers: a as never,
      had_issues: a.had_issues,
      follow_up_permission: a.follow_up_ok,
    });
    if (needsFollowUp(fb.rating)) await createFollowUpTicket(supabaseAdmin, fb);
    return { ok: true as const, duplicate: false };
  });

/* ================= Staff ================= */

async function demoPropertyOnly(supabase: { from: (t: "properties") => any }, propertyId: string) {
  const { data } = await supabase.from("properties").select("id, name, is_demo").eq("id", propertyId).maybeSingle();
  if (!data?.is_demo) throw new Error("Test feedback can only be created on a demo home.");
  return data as { id: string; name: string };
}

/** Synthetic survey link for a demo home — used for QA without real guests. */
export const createTestSurveyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string; guestName?: string }) => {
    if (!input?.propertyId) throw new Error("propertyId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await demoPropertyOnly(context.supabase as never, data.propertyId);
    const { signSurveyToken } = await import("./guest-feedback.server");
    const today = new Date();
    const d = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
    const a = new Date(today.getTime() - 4 * 86400000).toISOString().slice(0, 10);
    const token = await signSurveyToken({
      b: `demo-${crypto.randomUUID().slice(0, 8)}`,
      p: data.propertyId,
      g: data.guestName?.slice(0, 80) || "Test Guest",
      gid: null,
      a,
      d,
      ch: "Direct",
      demo: true,
    });
    return { token };
  });

/** Runs a synthetic review through the real import path on a demo home. */
export const addTestReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string; reviewId: string; stars: number; body: string; withBooking: boolean }) => {
    if (!input?.propertyId || !input.reviewId) throw new Error("propertyId and reviewId are required");
    return input;
  })
  .handler(async ({ data, context }) => {
    await demoPropertyOnly(context.supabase as never, data.propertyId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ingestReviews } = await import("./guest-feedback.server");
    const end = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return ingestReviews(supabaseAdmin, [
      {
        source_review_id: `demo-${data.reviewId}`,
        listing_site: "Airbnb",
        ownerrez_property_id: null,
        property_id: data.propertyId,
        booking_id: data.withBooking ? `demo-bk-${data.reviewId}` : null,
        guest_id: null,
        guest_name: data.withBooking ? "Test Reviewer" : null,
        stars: data.stars,
        body: data.body,
        response: null,
        date: new Date().toISOString(),
        url: null,
        stay_start: data.withBooking ? start : null,
        stay_end: data.withBooking ? end : null,
        is_demo: true,
      },
    ]);
  });

/** Imports recent OwnerRez reviews. Supervisors only; repeated runs never duplicate. */
export const syncOwnerRezReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc("is_supervisor", { _user_id: context.userId });
    if (!ok) throw new Error("Only supervisors can import reviews.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchOwnerRezReviews, ingestReviews } = await import("./guest-feedback.server");
    const items = await fetchOwnerRezReviews(supabaseAdmin);
    return { fetched: items.length, ...(await ingestReviews(supabaseAdmin, items)) };
  });

/** Dry run of the OwnerRez review import. Supervisors only; no writes, no Tickets. */
export const previewOwnerRezReviews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc("is_supervisor", { _user_id: context.userId });
    if (!ok) throw new Error("Only supervisors can preview the review import.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchOwnerRezReviews, previewReviewImport } = await import("./guest-feedback.server");
    const items = await fetchOwnerRezReviews(supabaseAdmin);
    return previewReviewImport(supabaseAdmin, items);
  });
