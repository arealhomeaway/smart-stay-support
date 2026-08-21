import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Whether Resolve can read the team inbox right now. */
export const getMailboxStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { mailboxReadEnabled, recentMailboxEvents } = await import("./mailbox.server");
    const events = await recentMailboxEvents(context.supabase, 15);
    return {
      connected: mailboxReadEnabled(),
      mailbox: "info@arealhomeaway.com",
      events,
      lastRunAt: events[0]?.created_at ?? null,
    };
  });

/**
 * Reads unread mail and opens matters for the real work. `dryRun` previews the
 * result without touching the mailbox or the queue.
 */
export const runMailboxSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean; limit?: number } | undefined) => ({
    dryRun: Boolean(input?.dryRun),
    limit: Math.min(Math.max(Number(input?.limit ?? 25), 1), 50),
  }))
  .handler(async ({ context, data }) => {
    const { isSupervisor } = await import("./access.server");
    if (!(await isSupervisor(context.supabase, context.userId))) {
      throw new Error("Only supervisors can run the inbox sync.");
    }
    const { syncMailbox } = await import("./mailbox.server");
    return syncMailbox(context.supabase, data);
  });
