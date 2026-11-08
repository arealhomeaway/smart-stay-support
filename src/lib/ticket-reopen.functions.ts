/**
 * Reopen a closed ticket. The clock times come from the one clock rule
 * (slaDueDates via reopenClocks); the database function checks who may do it,
 * the reason and the clocks, then writes the ticket and its history line in
 * one step (docs/pending/fix-batch-1/02_reopen_ticket.sql). Until that SQL is
 * applied this returns a plain "not ready" message; there is no direct-update
 * fallback.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reopenClocks, reopenReasonProblem } from "./notion-ticket-display";
import { REOPEN_COPY } from "./ticket-reopen";

type Loose = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
};

export const reopenClosedTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ticketId: z.string().uuid(), reason: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const problem = reopenReasonProblem(data.reason);
    if (problem) throw new Error(problem);
    const db = context.supabase;
    const { data: ticket, error } = await db
      .from("tickets")
      .select("id, priority, work_types(response_minutes, action_start_minutes)")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error("This ticket could not be loaded. Try again.");
    if (!ticket) throw new Error("This ticket was not found.");
    const wt = (ticket as { work_types?: { response_minutes?: number | null; action_start_minutes?: number | null } | null }).work_types ?? null;
    // A few seconds of headroom so the database still sees the times as "from now".
    const clocks = reopenClocks(String(ticket.priority), new Date(Date.now() + 5_000), wt);
    const res = await (db as unknown as Loose).rpc("reopen_ticket", {
      _ticket_id: data.ticketId,
      _reason: data.reason.trim(),
      _response_due_at: clocks.response_due_at,
      _action_due_at: clocks.action_due_at,
    });
    if (res.error) {
      if (res.error.code === "PGRST202" || res.error.code === "42883" || /Could not find the function/i.test(res.error.message))
        throw new Error(REOPEN_COPY.notReady);
      throw new Error(res.error.message);
    }
    return res.data as { ticket_id: string; history: string; reopened_at: string };
  });
