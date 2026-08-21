import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled inbox sweep. A cron job calls this with the shared secret so work
 * emailed to the team inbox becomes a matter without anyone clicking sync.
 */
export const Route = createFileRoute("/api/public/sync/mailbox")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncMailbox } = await import("@/lib/mailbox.server");

        const result = await syncMailbox(supabaseAdmin, { limit: 50 });
        return Response.json(result, { status: result.ok ? 200 : 502 });
      },
    },
  },
});
