/**
 * The only door for a ticket status change.
 *
 * Every surface calls `setTicketStatusFn`. Rules live in ticket-lifecycle.ts,
 * facts are read from the database in ticket-lifecycle.server.ts, and nothing
 * here is trusted from the browser except the intent.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function uuid(value: unknown, label = "ticket") {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

/** Only these fields may ride along with a status change. */
const ALLOWED_PATCH = new Set([
  "waiting_on",
  "waiting_reason",
  "next_review_at",
  "resolution_notes",
  "outcome_type",
  "closure_evidence",
  "final_communication_sent",
  "guest_confirmed",
  "closure_qa_result",
  "late_reason",
  "vendor_brief",
]);

export type SetTicketStatusInput = {
  ticketId: string;
  status: string;
  patch?: Record<string, unknown>;
  exception?: string | null;
  exceptionReason?: string | null;
};

export const setTicketStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SetTicketStatusInput) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input?.patch ?? {})) if (ALLOWED_PATCH.has(k)) patch[k] = v;
    return {
      ticketId: uuid(input?.ticketId),
      status: String(input?.status ?? ""),
      patch,
      exception: input?.exception ? String(input.exception) : null,
      exceptionReason: input?.exceptionReason ? String(input.exceptionReason) : null,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: roleRows, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not confirm your access level.");
    const roles = (roleRows ?? []).map((r) => String(r.role));
    if (!roles.some((r) => ["admin", "manager", "onboarding", "tech"].includes(r)))
      throw new Error("Only Resolve staff can change a ticket's status.");
    const privileged = roles.some((r) => r === "admin" || r === "manager");

    const m = await import("@/lib/ticket-lifecycle.server");
    return m.applyStatusChange(context.supabase, context.userId, privileged, data);
  });

/** What the ticket currently permits — used to grey out impossible choices. */
export const ticketLifecycleFactsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string }) => ({ ticketId: uuid(input?.ticketId) }))
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/ticket-lifecycle.server");
    const { facts } = await m.gatherLifecycleFacts(context.supabase, data.ticketId);
    return facts;
  });
