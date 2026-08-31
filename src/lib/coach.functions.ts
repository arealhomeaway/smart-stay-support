import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskInput = z.object({
  question: z.string().min(5),
  propertyId: z.string().uuid().nullable().optional(),
  occupancyHint: z.string().nullable().optional(),
  guestName: z.string().nullable().optional(),
});

const FollowUpInput = z.object({
  sessionId: z.string().uuid(),
  question: z.string().min(2),
});

/** Coaches a coordinator through a live situation and records the session. */
export const askCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AskInput.parse(data))
  .handler(async ({ data, context }) => {
    const { loadCatalog, generateGuidance } = await import("./coach.load.server");
    const supabase = context.supabase;
    const catalog = await loadCatalog(supabase, {
      propertyId: data.propertyId ?? null,
      occupancyHint: data.occupancyHint ?? null,
      guestName: data.guestName ?? null,
    });
    const guidance = await generateGuidance(data.question, catalog);

    const { data: session, error } = await supabase
      .from("coach_sessions")
      .insert({
        created_by: context.userId,
        property_id: data.propertyId ?? null,
        question: data.question,
        guidance,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { sessionId: session.id as string, guidance };
  });

/** Answers a follow-up question against an existing coaching session. */
export const askCoachFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => FollowUpInput.parse(data))
  .handler(async ({ data, context }) => {
    const { loadCatalog, answerFollowUp } = await import("./coach.load.server");
    const supabase = context.supabase;

    const { data: session, error } = await supabase
      .from("coach_sessions")
      .select("id, question, guidance, follow_ups, property_id")
      .eq("id", data.sessionId)
      .single();
    if (error || !session) throw new Error("That coaching session no longer exists.");

    const history = Array.isArray(session.follow_ups)
      ? (session.follow_ups as { role: "user" | "assistant"; content: string }[])
      : [];

    const catalog = await loadCatalog(supabase, {
      propertyId: session.property_id,
      occupancyHint: null,
      guestName: null,
    });

    const answer = await answerFollowUp({
      question: data.question,
      priorQuestion: session.question,
      guidance: session.guidance,
      history,
      catalog,
    });

    const nextHistory = [...history, { role: "user", content: data.question }, { role: "assistant", content: answer }];
    await supabase.from("coach_sessions").update({ follow_ups: nextHistory }).eq("id", session.id);

    return { answer, history: nextHistory };
  });

/** Links a coaching session to the ticket that was opened from it. */
export const linkCoachSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ sessionId: z.string().uuid(), ticketId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("coach_sessions")
      .update({ ticket_id: data.ticketId })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
