/**
 * Complete & Advance — the one door for finishing the Current Action on a
 * ticket.
 *
 * The browser sends which action it thinks is current and what the person
 * wrote. The server re-reads the ticket, refuses if the ticket has moved on,
 * re-runs the same required-input rules, writes the effect, and records the
 * step in the ticket's history. Status changes still go through the single
 * lifecycle validator — nothing here decides what a legal transition is.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isCompletable,
  ticketCurrentAction,
  validateAction,
  waitingWho,
  type ActionValues,
  type CurrentActionId,
} from "@/lib/ticket-current-action";

function uuid(value: unknown) {
  const id = String(value ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid ticket reference.");
  return id;
}

export type CompleteCurrentActionInput = {
  ticketId: string;
  actionId: CurrentActionId;
  values: ActionValues;
};

export type CompleteCurrentActionResult = {
  ok: boolean;
  message: string;
};

export const completeCurrentActionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CompleteCurrentActionInput) => {
    const values: ActionValues = {};
    for (const [k, v] of Object.entries(input?.values ?? {})) {
      if (typeof v === "string" && k.length <= 40) values[k] = v.slice(0, 4000);
    }
    return {
      ticketId: uuid(input?.ticketId),
      actionId: String(input?.actionId ?? "") as CurrentActionId,
      values,
    };
  })
  .handler(async ({ data, context }): Promise<CompleteCurrentActionResult> => {
    const { supabase, userId } = context;

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select(
        "id, status, acknowledged_at, action_started_at, waiting_on, waiting_reason, next_review_at, guest_in_residence, guest_confirmed, vendor_name, vendor_status, resolved_at, current_action_owner",
      )
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error || !ticket) return { ok: false, message: "That ticket could not be read." };

    const { count: openSteps } = await supabase
      .from("ticket_steps")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", data.ticketId)
      .eq("required", true)
      .eq("completed", false);

    const action = ticketCurrentAction({
      status: ticket.status,
      resolved_at: ticket.resolved_at,
      acknowledged_at: ticket.acknowledged_at,
      action_started_at: ticket.action_started_at,
      waiting_on: ticket.waiting_on,
      waiting_reason: ticket.waiting_reason,
      next_review_at: ticket.next_review_at,
      guest_in_residence: ticket.guest_in_residence,
      guest_confirmed: ticket.guest_confirmed,
      vendor_name: ticket.vendor_name,
      vendor_status: ticket.vendor_status,
      requiredOpenSteps: openSteps ?? 0,
    });

    if (!action || action.id !== data.actionId || !isCompletable(action.id))
      return {
        ok: false,
        message: "This ticket has already moved on — refresh to see the current step.",
      };

    const problem = validateAction(action, data.values);
    if (problem) return { ok: false, message: problem };

    const now = new Date().toISOString();
    const v = data.values;
    let body = "";
    let kind = "note";
    let eventType = "note";

    async function status(next: string, patch: Record<string, unknown> = {}) {
      const m = await import("@/lib/ticket-lifecycle.server");
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const roles = (roleRows ?? []).map((r) => String(r.role));
      const privileged = roles.some((r) => r === "admin" || r === "manager");
      return m.applyStatusChange(supabase, userId, privileged, {
        ticketId: data.ticketId,
        status: next,
        patch,
      });
    }

    if (action.id === "acknowledge") {
      const { error: writeError } = await supabase
        .from("tickets")
        .update({
          acknowledged_at: now,
          ...(ticket.current_action_owner ? {} : { current_action_owner: userId }),
        })
        .eq("id", data.ticketId)
        .is("acknowledged_at", null);
      if (writeError) return { ok: false, message: writeError.message };
      kind = "status";
      eventType = "acknowledged";
      body = v["note"]?.trim()
        ? `Acknowledged — ${v["note"].trim()}`
        : "Acknowledged — we have this ticket.";
    } else if (action.id === "start_work") {
      const { error: writeError } = await supabase
        .from("tickets")
        .update({ action_started_at: now })
        .eq("id", data.ticketId)
        .is("action_started_at", null);
      if (writeError) return { ok: false, message: writeError.message };
      if (ticket.status === "open" || ticket.status === "new") {
        const result = await status("in_progress");
        if (!result.ok) return { ok: false, message: result.message };
      }
      kind = "status";
      eventType = "action_started";
      body = `Work started — ${v["first_step"]?.trim() ?? ""}`;
    } else if (action.id === "waiting_followup") {
      const update = v["update"]?.trim() ?? "";
      if (v["outcome"] === "resume") {
        const result = await status("in_progress", {
          waiting_on: null,
          waiting_reason: null,
          next_review_at: null,
        });
        if (!result.ok) return { ok: false, message: result.message };
        kind = "waiting";
        eventType = "waiting_cleared";
        body = `No longer waiting — ${update}`;
      } else {
        const review = new Date(v["next_review_at"] ?? "").toISOString();
        const result = await status("waiting", {
          waiting_on: ticket.waiting_on,
          waiting_reason: update,
          next_review_at: review,
        });
        if (!result.ok) return { ok: false, message: result.message };
        kind = "waiting";
        eventType = "waiting_set";
        body = `Still waiting on ${waitingWho(ticket.waiting_on)} — ${update}`;
      }
    } else if (action.id === "vendor_checkin") {
      const done = v["vendor_state"] === "completed";
      if (done) {
        const { error: writeError } = await supabase
          .from("tickets")
          .update({ vendor_status: "completed" })
          .eq("id", data.ticketId);
        if (writeError) return { ok: false, message: writeError.message };
      }
      kind = "vendor";
      eventType = "vendor_update";
      body = `${ticket.vendor_name ?? "Vendor"} check-in${done ? " — reported complete" : ""}: ${v["update"]?.trim() ?? ""}`;
    } else if (action.id === "guest_update") {
      kind = "communication";
      eventType = "guest_update";
      body = `Guest updated — ${v["update"]?.trim() ?? ""}`;
      // Same fields the guided Ticket reads, so the update counts everywhere.
      const { error: stampError } = await supabase
        .from("tickets")
        .update({ guest_update_at: new Date().toISOString(), guest_update_note: v["update"]?.trim() ?? null })
        .eq("id", data.ticketId);
      if (stampError) return { ok: false, message: stampError.message };
    }

    await supabase.from("ticket_activity").insert({
      ticket_id: data.ticketId,
      author_id: userId,
      kind,
      event_type: eventType,
      body,
    });

    return { ok: true, message: "Recorded." };
  });
