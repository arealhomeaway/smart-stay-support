/**
 * Save one routine check from the Record routine work panel.
 *
 * Normal path: the caller-authenticated database function record_routine_check
 * (docs/pending/record-routine/01) saves the check and, when an issue was
 * found, opens the linked ticket in the chosen team's queue in one step.
 *
 * Until that SQL is applied, the check is saved the way routine checks are
 * saved today (the person's own access, existing columns, answers written as
 * plain notes) and the panel then opens the usual ticket form linked to the
 * check. Nothing here bypasses the person's own access.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CHECKS,
  answersSummary,
  buildAnswers,
  checkAnswersProblem,
  followUpTicketText,
  type CheckAnswers,
  type LiveCheck,
} from "./record-routine";

type Loose = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

const Input = z.object({
  kind: z.enum(["guest_touch_base", "maintenance_review", "guest_review", "survey_review"]),
  eventKey: z.string().min(1).max(300),
  propertyId: z.string().uuid().nullable(),
  homeLabel: z.string().max(300).nullable(),
  title: z.string().max(300),
  guestName: z.string().max(200).nullable(),
  feedbackId: z.string().uuid().nullable(),
  demo: z.boolean(),
  answers: z.object({
    steps: z.record(z.string(), z.boolean()),
    outcome: z.enum(["looks_good", "needs_follow_up", "no_answer", "not_applicable"]).nullable(),
    issue: z.string().max(4000).optional(),
    fixTeam: z.enum(["guest_experience", "property_operations"]).nullable().optional(),
    notes: z.string().max(4000).optional(),
    replyText: z.string().max(8000).optional(),
    postedOn: z.enum(["airbnb", "ownerrez", "vrbo", "booking_com", "other"]).nullable().optional(),
    repeatIssue: z.enum(["no", "yes"]).nullable().optional(),
    link: z.string().max(1000).nullable().optional(),
  }),
});

export type RecordRoutineResult = {
  routineId: string;
  ticketId: string | null;
  alreadySaved: boolean;
  /** True only before the staged SQL is applied: open the usual ticket form next. */
  openTicketForm: boolean;
};

export const recordRoutineCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<RecordRoutineResult> => {
    const kind = data.kind as LiveCheck;
    const a = data.answers as CheckAnswers;
    const problem = checkAnswersProblem(kind, a);
    if (problem) throw new Error(problem);
    const summary = answersSummary(kind, a);
    const ticket = a.outcome === "needs_follow_up" ? followUpTicketText(kind, a, data.homeLabel) : null;
    const db = context.supabase;

    const res = await (db as unknown as Loose).rpc("record_routine_check", {
      _check: {
        kind,
        event_key: data.eventKey,
        property_id: data.propertyId,
        title: data.title,
        guest_name: data.guestName,
        feedback_id: data.feedbackId,
        is_demo: data.demo,
        outcome: a.outcome,
        issue: a.issue ?? null,
        fix_team: a.fixTeam ?? null,
        notes: a.notes ?? null,
        link: a.link ?? null,
        summary,
        answers: buildAnswers(kind, a),
        ticket_title: ticket?.title ?? null,
        ticket_description: ticket?.description ?? null,
      },
    });
    if (!res.error) {
      const r = res.data as { routine_id: string; ticket_id: string | null; already_saved: boolean };
      return { routineId: r.routine_id, ticketId: r.ticket_id, alreadySaved: r.already_saved, openTicketForm: false };
    }
    const missing = res.error.code === "PGRST202" || res.error.code === "42883" || /Could not find the function/i.test(res.error.message);
    if (!missing) throw new Error(res.error.message);

    // Before the staged SQL: today's save, under the person's own access.
    const now = new Date().toISOString();
    const finished = {
      status: "completed",
      outcome: a.outcome,
      findings: (a.issue ?? "").trim() || null,
      notes: summary || null,
      evidence_urls: a.link ? [a.link] : [],
      completed_at: now,
      completed_by: context.userId,
    };
    const { data: existing, error: readError } = await db
      .from("routine_controls")
      .select("id, status")
      .eq("kind", kind)
      .eq("event_key", data.eventKey)
      .maybeSingle();
    if (readError) throw new Error("This check could not be saved. Try again.");
    if (existing?.status === "completed")
      return { routineId: existing.id, ticketId: null, alreadySaved: true, openTicketForm: false };
    if (existing?.status === "cancelled") throw new Error("This check was closed. Choose another one.");
    let routineId: string;
    if (existing) {
      const { error } = await db
        .from("routine_controls")
        .update({ ...finished, property_id: data.propertyId })
        .eq("id", existing.id);
      if (error) throw new Error("This check could not be saved. Try again.");
      routineId = existing.id;
    } else {
      const { data: row, error } = await db
        .from("routine_controls")
        .insert({
          ...finished,
          kind,
          event_key: data.eventKey,
          property_id: data.propertyId,
          title: data.title || CHECKS[kind].single,
          guest_name: data.guestName,
          due_at: now,
          team: CHECKS[kind].team,
          assigned_to: context.userId,
          created_by: context.userId,
          is_demo: data.demo,
        } as never)
        .select("id")
        .single();
      if (error) throw new Error("This check could not be saved. Try again.");
      routineId = (row as { id: string }).id;
    }
    return { routineId, ticketId: null, alreadySaved: false, openTicketForm: a.outcome === "needs_follow_up" };
  });
