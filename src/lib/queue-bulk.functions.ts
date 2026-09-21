/**
 * The single door for changing several tickets at once.
 *
 * Every rule that applies to one ticket applies here: only a Supervisor may
 * reassign or re-prioritise, priority always carries a written reason, closure
 * is never a batch, and each ticket gets its own line in its history so the
 * change is readable months later.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  BULK_ACTIONS,
  bulkDenialReason,
  canRunBulkAction,
  planBulkUpdate,
  type BulkAction,
  type BulkRequest,
} from "@/lib/queue-bulk";

export type BulkTicketUpdateInput = BulkRequest;

export const bulkUpdateTicketsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BulkTicketUpdateInput) => {
    const action = String(input?.action ?? "") as BulkAction;
    if (!BULK_ACTIONS.includes(action)) throw new Error("Choose what to change.");
    const plan = planBulkUpdate({ ...input, action });
    if (!plan.ok) throw new Error(plan.error);
    return { plan, assigneeId: input?.assigneeId ?? null };
  })
  .handler(async ({ data, context }) => {
    const { plan } = data;

    const { data: roleRows, error: roleError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (roleError) throw new Error("Could not confirm your access level.");
    const roles = (roleRows ?? []).map((r) => String(r.role));
    if (!canRunBulkAction({ roles }, plan.action))
      throw new Error(bulkDenialReason({ roles }, plan.action) ?? "You cannot make that change.");

    const { data: before, error: readError } = await context.supabase
      .from("tickets")
      .select("id, ref, status, priority, assigned_to")
      .in("id", plan.ticketIds);
    if (readError) throw new Error(readError.message);

    const rows = before ?? [];
    const updated: string[] = [];
    const skipped: { ref: string | null; why: string }[] = [];

    for (const row of rows) {
      // Nothing to do is not a failure — it just does not earn a history line.
      if (plan.action === "status" && row.status === plan.patch["status"]) continue;
      if (plan.action === "priority" && row.priority === plan.patch["priority"]) continue;
      if (plan.action === "assign" && (row.assigned_to ?? null) === (plan.patch["assigned_to"] ?? null))
        continue;

      const { error } = await context.supabase
        .from("tickets")
        .update(plan.patch as never)
        .eq("id", row.id);
      if (error) {
        skipped.push({ ref: row.ref ?? null, why: error.message });
        continue;
      }
      updated.push(row.id);

      const body =
        plan.action === "status"
          ? `Status set to ${String(plan.patch["status"]).replace("_", " ")} in a queue update.`
          : plan.action === "priority"
            ? `Priority changed from ${String(row.priority ?? "").toUpperCase()} to ${String(
                plan.patch["priority"],
              ).toUpperCase()} in a queue update — ${plan.reason}`
            : plan.patch["assigned_to"]
              ? "Reassigned in a queue update."
              : "Returned to the unassigned queue.";

      await context.supabase.from("ticket_activity").insert({
        ticket_id: row.id,
        author_id: context.userId,
        kind: "status",
        event_type: plan.action === "priority" ? "priority_changed" : `bulk_${plan.action}`,
        internal: false,
        body,
      });
    }

    const missing = plan.ticketIds.length - rows.length;
    if (missing > 0) skipped.push({ ref: null, why: `${missing} ticket(s) could not be found.` });

    return {
      ok: true as const,
      updated: updated.length,
      unchanged: rows.length - updated.length - skipped.filter((s) => s.ref).length,
      skipped,
    };
  });
