/**
 * Escalation — raising and resolving a request for judgement.
 *
 * Raising never changes who owns the ticket. Only an explicit "take ownership"
 * or "direct it to someone else" outcome moves the work, and both are written
 * to the ticket's history so the trail is complete.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateEscalation } from "@/lib/escalation";

function uuid(value: unknown, label = "record") {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

function optionalUuid(value: unknown) {
  const id = String(value ?? "").trim();
  return /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

async function rolesOf(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: { role: string }) => String(r.role));
}

export type RaiseEscalationInput = {
  ticketId: string;
  escalated_to_role: "supervisor" | "director";
  reason: string;
  already_tried: string;
  help_needed: string;
  urgency: "normal" | "high" | "critical";
};

export const raiseEscalationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: RaiseEscalationInput) => {
    const draft = {
      escalated_to_role:
        input?.escalated_to_role === "director" ? ("director" as const) : ("supervisor" as const),
      reason: String(input?.reason ?? "").trim(),
      already_tried: String(input?.already_tried ?? "").trim(),
      help_needed: String(input?.help_needed ?? "").trim(),
      urgency: (["normal", "high", "critical"].includes(String(input?.urgency))
        ? input.urgency
        : "normal") as "normal" | "high" | "critical",
    };
    const problem = validateEscalation(draft);
    if (problem) throw new Error(problem);
    return { ticketId: uuid(input?.ticketId, "ticket"), ...draft };
  })
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r: string) => ["admin", "manager", "onboarding", "tech"].includes(r)))
      throw new Error("Only Resolve staff can escalate a ticket.");
    if (
      data.escalated_to_role === "director" &&
      !roles.some((r: string) => ["admin", "manager"].includes(r))
    )
      throw new Error("Escalate to your Supervisor first — they take it to the Director.");

    const { data: ticket, error: readError } = await context.supabase
      .from("tickets")
      .select("id, ref, title, property_id, is_demo")
      .eq("id", data.ticketId)
      .single();
    if (readError || !ticket) throw new Error("That ticket could not be found.");

    const { data: row, error } = await context.supabase
      .from("escalations")
      .insert({
        ticket_id: data.ticketId,
        property_id: ticket.property_id,
        escalated_by: context.userId,
        escalated_to_role: data.escalated_to_role,
        reason: data.reason,
        already_tried: data.already_tried,
        help_needed: data.help_needed,
        urgency: data.urgency,
        is_demo: Boolean(ticket.is_demo),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // The clock and the level move; ownership deliberately does not.
    await context.supabase
      .from("tickets")
      .update({ escalation_level: data.escalated_to_role, escalated_at: new Date().toISOString() })
      .eq("id", data.ticketId);

    await context.supabase.from("ticket_activity").insert({
      ticket_id: data.ticketId,
      author_id: context.userId,
      kind: "status",
      event_type: "escalated",
      internal: false,
      body: `Escalated to the ${data.escalated_to_role === "director" ? "Director of Operations" : "Operations Supervisor"} — ${data.reason}. Ownership is unchanged.`,
    });

    return { ok: true as const, id: row.id };
  });

export type ResolveEscalationInput = {
  escalationId: string;
  outcome: "guidance" | "takeover" | "reassigned";
  outcome_note: string;
  /** Required when the outcome is "reassigned". */
  assignTo?: string | null;
};

export const resolveEscalationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ResolveEscalationInput) => {
    const outcome = String(input?.outcome ?? "");
    if (!["guidance", "takeover", "reassigned"].includes(outcome))
      throw new Error("Choose what you decided.");
    const note = String(input?.outcome_note ?? "").trim();
    if (note.length < 5) throw new Error("Write the decision so the record explains itself.");
    return {
      escalationId: uuid(input?.escalationId, "escalation"),
      outcome: outcome as "guidance" | "takeover" | "reassigned",
      outcome_note: note,
      assignTo: optionalUuid(input?.assignTo),
    };
  })
  .handler(async ({ data, context }) => {
    const roles = await rolesOf(context.supabase, context.userId);
    if (!roles.some((r: string) => ["admin", "manager"].includes(r)))
      throw new Error("Only a supervisor or the Director can close an escalation.");

    const { data: esc, error: readError } = await context.supabase
      .from("escalations")
      .select("id, ticket_id, status, escalated_to_role")
      .eq("id", data.escalationId)
      .single();
    if (readError || !esc) throw new Error("That escalation could not be found.");
    if (esc.status !== "open") throw new Error("This escalation has already been answered.");

    // A Supervisor may decide a supervisor-level escalation, but once it has
    // been escalated further to the Director, only the Director (or a
    // Platform Owner) may decide it — enforced again at the database level
    // by the escalations RLS policy, so this cannot be bypassed by calling
    // the table directly either.
    if (esc.escalated_to_role === "director") {
      const { data: isDirector, error: dirError } = await context.supabase.rpc("is_director" as never, {
        _user_id: context.userId,
      } as never);
      if (dirError) throw new Error(dirError.message);
      if (!isDirector)
        throw new Error(
          "This was escalated to the Director — only the Director can decide it now.",
        );
    }

    if (data.outcome === "reassigned" && !data.assignTo)
      throw new Error("Choose who should carry this next.");

    const { error } = await context.supabase
      .from("escalations")
      .update({
        status: "resolved",
        outcome: data.outcome,
        outcome_note: data.outcome_note,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.escalationId);
    if (error) throw new Error(error.message);

    let ownershipNote = "Ownership is unchanged.";
    if (esc.ticket_id && data.outcome !== "guidance") {
      const newOwner = data.outcome === "takeover" ? context.userId : data.assignTo!;
      await context.supabase
        .from("tickets")
        .update({ assigned_to: newOwner, current_action_owner: newOwner })
        .eq("id", esc.ticket_id);
      ownershipNote =
        data.outcome === "takeover"
          ? "Ownership moved to the supervisor who answered it."
          : "Ownership moved to the person named in the decision.";
    }

    if (esc.ticket_id) {
      await context.supabase.from("ticket_activity").insert({
        ticket_id: esc.ticket_id,
        author_id: context.userId,
        kind: "status",
        event_type: "escalation_resolved",
        internal: false,
        body: `Escalation answered — ${data.outcome_note} ${ownershipNote}`,
      });
    }

    return { ok: true as const };
  });
