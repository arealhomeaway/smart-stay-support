import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { priorityCorrection } from "@/lib/ticket-priority";
import { slaDueDates } from "@/lib/tickets";

type CorrectionInput = {
  ticketId: string;
  priority: string;
  reason: string;
  isDemo: boolean;
};

export const correctTicketPriorityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CorrectionInput) => {
    const ticketId = String(input?.ticketId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(ticketId)) throw new Error("Invalid ticket reference.");
    return {
      ticketId,
      priority: String(input?.priority ?? ""),
      reason: String(input?.reason ?? ""),
      isDemo: input?.isDemo === true,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Could not confirm your access level.");
    if (!(roles ?? []).some((row) => row.role === "admin" || row.role === "manager")) {
      throw new Error("Only an Operations supervisor or director can correct priority.");
    }

    const { data: ticket, error: ticketError } = await context.supabase
      .from("tickets")
      .select("id, priority, suggested_priority, reported_at, updated_at, is_demo, work_type_id, acknowledged_at, action_started_at")
      .eq("id", data.ticketId)
      .eq("is_demo", data.isDemo)
      .maybeSingle();
    if (ticketError || !ticket) throw new Error("That ticket is not available in this workspace.");
    const correction = priorityCorrection(
      ticket.suggested_priority,
      ticket.priority,
      data.priority,
      data.reason,
    );

    const { data: workType, error: typeError } = ticket.work_type_id
      ? await context.supabase
          .from("work_types")
          .select("response_minutes, action_start_minutes")
          .eq("id", ticket.work_type_id)
          .maybeSingle()
      : { data: null, error: null };
    if (typeError) throw new Error("Could not read the response standard.");
    const due = slaDueDates(correction.priority, new Date(ticket.reported_at), workType ?? undefined);
    const { data: updated, error: updateError } = await context.supabase
      .from("tickets")
      .update({
        priority: correction.priority,
        priority_override_reason: correction.reason,
        ...(ticket.acknowledged_at ? {} : { response_due_at: due.response_due_at }),
        ...(ticket.action_started_at ? {} : { action_due_at: due.action_due_at }),
      })
      .eq("id", data.ticketId)
      .eq("is_demo", data.isDemo)
      .eq("updated_at", ticket.updated_at)
      .select("id")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message);
    if (!updated) throw new Error("The ticket changed. Review its current priority and try again.");

    // The existing tickets_audit trigger records actor, time and both priority
    // values. Ticket activity adds the calculated value and the stated reason.
    const { error: activityError } = await context.supabase.from("ticket_activity").insert({
      ticket_id: data.ticketId,
      author_id: context.userId,
      kind: "priority",
      event_type: "priority_corrected",
      internal: true,
      is_demo: data.isDemo,
      body: correction.activity,
    });
    if (activityError) {
      throw new Error("Priority was saved and audited, but its explanation could not be added to activity. Ask an administrator to review the audit log.");
    }
    return { priority: correction.priority };
  });
