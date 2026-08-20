import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled inbound sync. Called by a cron job with the shared secret so
 * OwnerRez and Breezeway work shows up in Resolve without anyone clicking.
 */
export const Route = createFileRoute("/api/public/sync/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["LOVABLE_CRON_SECRET"];
        const provided = request.headers.get("x-cron-secret") ?? "";
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncBreezewayInbound, syncOwnerRezInbound } = await import("@/lib/inbound.server");

        const results = [
          await syncOwnerRezInbound(supabaseAdmin, null),
          await syncBreezewayInbound(supabaseAdmin, null),
        ];
        return Response.json({ ok: true, results });
      },
    },
  },
});
