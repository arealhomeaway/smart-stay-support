import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled reconciliation sweep.
 *
 * Change notifications do the fast work; this is the safety net. Each run also
 * keeps the Graph subscription alive, so a missed notification, an expired
 * subscription or a temporary Microsoft failure self-heals instead of quietly
 * leaving categorised mail unprocessed.
 */
export const Route = createFileRoute("/api/public/sync/mailbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret") ?? "";
        // The scheduler inside our own database identifies itself with the
        // project key, the same way the other scheduled jobs do.
        const apikey = request.headers.get("apikey") ?? "";
        const projectKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ??
          process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
          "";
        const authorised =
          (!!secret && provided === secret) || (!!projectKey && apikey === projectKey);
        if (!authorised) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncMailbox } = await import("@/lib/mailbox.server");
        const { ensureSubscription } = await import("@/lib/outlook-subscription.server");

        const subscription = await ensureSubscription(supabaseAdmin);
        const result = await syncMailbox(supabaseAdmin, { limit: 50 });
        return Response.json({ ...result, subscription }, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
