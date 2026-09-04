/**
 * Final Review — the supervisor's decision on finished work.
 *
 * Approving closes the ticket through the same lifecycle door as everything
 * else. Returning it sends the work back to whoever finished it, with the
 * reason recorded on the ticket's history.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function uuid(value: unknown, label = "ticket") {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

export type FinalReviewInput = {
  ticketId: string;
  decision: "approve" | "return";
  note?: string | null;
  /** Approving after the reviewer fixed something themselves. */
  corrected?: boolean;
};

export const recordFinalReviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FinalReviewInput) => ({
    ticketId: uuid(input?.ticketId),
    decision: input?.decision === "return" ? ("return" as const) : ("approve" as const),
    note: input?.note ? String(input.note).slice(0, 2000) : null,
    corrected: Boolean(input?.corrected),
  }))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const roles = (roleRows ?? []).map((r) => String(r.role));
    if (!roles.some((r) => r === "admin" || r === "manager"))
      throw new Error("Only a supervisor can complete Final Review.");

    if (data.decision === "return") {
      if (!data.note || data.note.trim().length < 5)
        throw new Error("Say what needs correcting before returning this work.");
      const { error } = await context.supabase
        .from("tickets")
        .update({
          closure_qa_result: "returned",
          status: "in_progress",
          resolved_at: null,
          final_review_by: context.userId,
          final_review_at: new Date().toISOString(),
          final_review_note: data.note,
        })
        .eq("id", data.ticketId);
      if (error) throw new Error(error.message);

      await context.supabase.from("ticket_activity").insert({
        ticket_id: data.ticketId,
        author_id: context.userId,
        kind: "status",
        event_type: "final_review_returned",
        internal: false,
        body: `Final Review returned this work for correction — ${data.note}`,
      });
      return { ok: true as const, decision: "return" as const };
    }

    const now = new Date().toISOString();
    const m = await import("@/lib/ticket-lifecycle.server");
    const result = await m.applyStatusChange(context.supabase, context.userId, true, {
      ticketId: data.ticketId,
      status: "closed",
      patch: { closure_qa_result: data.corrected ? "corrected" : "pass" },
    });
    if (!result.ok) return result;

    await context.supabase
      .from("tickets")
      .update({
        final_review_by: context.userId,
        final_review_at: now,
        final_review_note: data.note,
      })
      .eq("id", data.ticketId);

    await context.supabase.from("ticket_activity").insert({
      ticket_id: data.ticketId,
      author_id: context.userId,
      kind: "status",
      event_type: "final_review_approved",
      internal: false,
      body: data.note
        ? `Final Review approved — ${data.note}`
        : "Final Review approved and the ticket was closed.",
    });

    return { ok: true as const, decision: "approve" as const };
  });
