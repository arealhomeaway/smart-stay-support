import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled reconciliation sweep (every minute once switched on).
 *
 * Change notifications do the fast work; this is the safety net. Each run also
 * keeps the Graph subscription alive, so a missed notification, an expired
 * subscription or a temporary Microsoft failure self-heals instead of quietly
 * leaving categorised mail unprocessed.
 *
 * Only the scheduler may call it: the private scheduler secret, never the
 * public project key. While the email intake switch is off it does nothing.
 */
export const Route = createFileRoute("/api/public/sync/mailbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { authoriseSweep, runSweep } = await import("@/lib/email-intake.server");
        const authorised = await authoriseSweep(request.headers, {
          appSecret: process.env["LOVABLE_CRON_SECRET"],
          verifyToken: async (token) => {
            const { data } = await supabaseAdmin.rpc("cleaner_verify_cron_token", { _token: token });
            return data === true;
          },
        });
        if (!authorised) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { ensureSubscription } = await import("@/lib/outlook-subscription.server");
        const result = await runSweep(supabaseAdmin, { ensureSubscription });
        if (result.refused) return Response.json(result, { status: 200 });
        return Response.json(result, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
