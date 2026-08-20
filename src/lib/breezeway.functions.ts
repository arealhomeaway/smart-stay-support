import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Is Breezeway connected yet? Drives the UI between "ready" and "paste a link". */
export const getBreezewayStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { breezewayConfigured } = await import("./breezeway.server");
    return { connected: breezewayConfigured() };
  });

/** Breezeway homes available for linking to our properties. */
export const listBreezewayHomes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listBreezewayProperties, BreezewayError, breezewayConfigured } = await import(
      "./breezeway.server"
    );
    if (!breezewayConfigured()) {
      return { ok: false as const, connected: false, error: "Breezeway is not connected yet." };
    }
    try {
      const items = await listBreezewayProperties();
      return {
        ok: true as const,
        connected: true,
        data: items.map((p) => ({
          id: String(p.id),
          name: p.name,
          location: [p.city, p.state].filter(Boolean).join(", "),
        })),
      };
    } catch (err) {
      const message = err instanceof BreezewayError ? err.message : "Could not reach Breezeway.";
      return { ok: false as const, connected: true, error: message };
    }
  });

/**
 * Dispatches a matter to Breezeway as a task. The description always carries the
 * full instruction set (playbook steps + safety-device rule), so the vendor
 * never gets a one-line request.
 */
export const dispatchToBreezeway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string; extraInstructions?: string }) => {
    if (!input?.ticketId) throw new Error("ticketId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { createBreezewayTask, BreezewayError, breezewayConfigured } = await import(
      "./breezeway.server"
    );
    if (!breezewayConfigured()) {
      return { ok: false as const, error: "Breezeway is not connected yet." };
    }

    const { data: ticket, error } = await context.supabase
      .from("tickets")
      .select(
        "id, title, description, priority, property_id, properties(name, nickname, access_notes, breezeway_property_id)",
      )
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!ticket) return { ok: false as const, error: "Matter not found." };

    const property = ticket.properties as
      | { name: string; nickname: string | null; access_notes: string | null; breezeway_property_id: string | null }
      | null;
    if (!property?.breezeway_property_id) {
      return { ok: false as const, error: "This home is not linked to a Breezeway property yet." };
    }

    const { data: steps } = await context.supabase
      .from("ticket_steps")
      .select("title, detail, position")
      .eq("ticket_id", ticket.id)
      .order("position");

    const description = [
      ticket.description ?? "",
      steps?.length
        ? `\nRequired steps:\n${steps.map((s, i) => `${i + 1}. ${s.title}${s.detail ? ` — ${s.detail}` : ""}`).join("\n")}`
        : "",
      "\nStanding safety rule: check every smoke and carbon monoxide alarm plus any security device in the home. If a device is removed, it must be replaced the same visit and any wall damage patched before leaving.",
      property.access_notes ? `\nAccess: ${property.access_notes}` : "",
      data.extraInstructions ? `\nExtra instructions: ${data.extraInstructions}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const task = await createBreezewayTask({
        breezewayPropertyId: property.breezeway_property_id,
        name: ticket.title,
        description,
        priority: ticket.priority ?? "p3",
      });
      const now = new Date().toISOString();
      await context.supabase
        .from("tickets")
        .update({
          breezeway_task_id: String(task.id),
          breezeway_task_status: task.status ?? "created",
          breezeway_synced_at: now,
        })
        .eq("id", ticket.id);
      await context.supabase.from("ticket_activity").insert({
        ticket_id: ticket.id,
        author_id: context.userId,
        event_type: "note",
        body: `Dispatched to Breezeway as task ${task.id} with the full instruction set.`,
      });
      return { ok: true as const, taskId: String(task.id) };
    } catch (err) {
      const message = err instanceof BreezewayError ? err.message : "Could not reach Breezeway.";
      return { ok: false as const, error: message };
    }
  });

/** Pulls the current Breezeway task status back onto the matter. */
export const syncBreezewayTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string }) => {
    if (!input?.ticketId) throw new Error("ticketId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { getBreezewayTask, BreezewayError, breezewayConfigured } = await import("./breezeway.server");
    if (!breezewayConfigured()) {
      return { ok: false as const, error: "Breezeway is not connected yet." };
    }

    const { data: ticket, error } = await context.supabase
      .from("tickets")
      .select("id, breezeway_task_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    if (!ticket?.breezeway_task_id) {
      return { ok: false as const, error: "No Breezeway task is linked to this matter." };
    }

    try {
      const task = await getBreezewayTask(ticket.breezeway_task_id);
      const status = task.status ?? "unknown";
      await context.supabase
        .from("tickets")
        .update({ breezeway_task_status: status, breezeway_synced_at: new Date().toISOString() })
        .eq("id", ticket.id);
      return { ok: true as const, status };
    } catch (err) {
      const message = err instanceof BreezewayError ? err.message : "Could not reach Breezeway.";
      return { ok: false as const, error: message };
    }
  });
