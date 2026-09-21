/**
 * The only door for changing a ticket's priority.
 *
 * Priority is calculated from the rubric. Changing it is a supervisor decision,
 * it always needs a written reason, and the change is recorded permanently in
 * the audit history by the database itself — so this rule holds even if someone
 * writes to the table directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRIORITIES = ["p1", "p2", "p3"] as const;
export type TicketPriority = (typeof PRIORITIES)[number];

function uuid(value: unknown, label = "ticket") {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`Invalid ${label} reference.`);
  return id;
}

export type SetTicketPriorityInput = {
  ticketId: string;
  priority: TicketPriority;
  reason: string;
};

export const setTicketPriorityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SetTicketPriorityInput) => {
    const priority = String(input?.priority ?? "").toLowerCase();
    if (!PRIORITIES.includes(priority as TicketPriority)) throw new Error("Choose P1, P2 or P3.");
    const reason = String(input?.reason ?? "").trim();
    if (reason.length < 5)
      throw new Error("Write why this priority is different from the calculated one.");
    return {
      ticketId: uuid(input?.ticketId),
      priority: priority as TicketPriority,
      reason,
    };
  })
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Could not confirm your access level.");
    const roles = (roleRows ?? []).map((r) => String(r.role));
    if (!roles.some((r) => r === "admin" || r === "manager"))
      throw new Error("Only a Supervisor or Manager can change a ticket's priority.");

    const { data: ticket, error: readError } = await context.supabase
      .from("tickets")
      .select("id, priority, suggested_priority")
      .eq("id", data.ticketId)
      .single();
    if (readError || !ticket) throw new Error("That ticket could not be found.");
    if (String(ticket.priority) === data.priority)
      throw new Error("That is already the priority on this ticket.");

    const previous = String(ticket.priority ?? "");

    const { error } = await context.supabase
      .from("tickets")
      .update({ priority: data.priority, priority_override_reason: data.reason })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);

    // The permanent record is written by the database trigger; this line is the
    // plain-language version people read on the ticket itself.
    await context.supabase.from("ticket_activity").insert({
      ticket_id: data.ticketId,
      author_id: context.userId,
      kind: "status",
      event_type: "priority_changed",
      internal: false,
      body: `Priority changed from ${previous.toUpperCase()} to ${data.priority.toUpperCase()} — ${data.reason}`,
    });

    return { ok: true as const, previous, priority: data.priority };
  });
