import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Whether Resolve can read the team inbox right now, plus recent activity. */
export const getMailboxStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mailboxReadEnabled, recentMailboxEvents } = await import("./mailbox.server");
    const { currentSubscription } = await import("./outlook-subscription.server");
    const [events, subscription] = await Promise.all([
      recentMailboxEvents(context.supabase, 25),
      currentSubscription(context.supabase),
    ]);
    return {
      connected: mailboxReadEnabled(),
      mailbox: "info@arealhomeaway.com",
      events,
      lastRunAt: events[0]?.created_at ?? null,
      subscription: subscription
        ? {
            status: subscription.status,
            expiresAt: subscription.next_attempt_at,
            error: subscription.error_message,
          }
        : null,
    };
  });

/**
 * Reads categorised mail and creates the Ticket or Lead a person asked for.
 * `dryRun` previews the result without touching the mailbox or the queue.
 */
export const runMailboxSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean; limit?: number } | undefined) => ({
    dryRun: Boolean(input?.dryRun),
    limit: Math.min(Math.max(Number(input?.limit ?? 25), 1), 50),
  }))
  .handler(async ({ context, data }) => {
    const { data: supervisor } = await context.supabase.rpc("is_supervisor", { _user_id: context.userId });
    if (!supervisor) throw new Error("Only supervisors can run the inbox sync.");
    const { syncMailbox } = await import("./mailbox.server");
    return syncMailbox(context.supabase, data);
  });

/** Creates or renews the Graph change-notification subscription. */
export const refreshMailboxSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: supervisor } = await context.supabase.rpc("is_supervisor", { _user_id: context.userId });
    if (!supervisor) throw new Error("Only supervisors can manage the mailbox subscription.");
    const { ensureSubscription } = await import("./outlook-subscription.server");
    return ensureSubscription(context.supabase);
  });

/**
 * The Outlook message a Ticket or Lead came from, if it came from email.
 * Reads through the caller's own session, so mailbox provenance is only
 * visible to someone who can already see the record itself.
 */
export const getOutlookSource = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entityType: "ticket" | "lead"; entityId: string }) => ({
    entityType: input.entityType === "lead" ? ("lead" as const) : ("ticket" as const),
    entityId: String(input.entityId),
  }))
  .handler(async ({ context, data }) => {
    // The record must be readable by this user before its email origin is.
    const table = data.entityType === "lead" ? "leads" : "tickets";
    const { data: record } = await context.supabase.from(table).select("id").eq("id", data.entityId).maybeSingle();
    if (!record) return null;
    const { outlookSourceFor } = await import("./mailbox.server");
    return outlookSourceFor(context.supabase, data.entityType, data.entityId);
  });
