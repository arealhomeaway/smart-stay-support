import { createFileRoute } from "@tanstack/react-router";

/**
 * Drains queued owner alerts to email and (for urgent matters) text.
 * Called on a schedule; the in-app inbox is already updated by the database.
 */
export const Route = createFileRoute("/api/public/hooks/owner-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || token !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { drainOwnerAlerts } = await import("@/lib/owner-notify.server");

        try {
          return Response.json(await drainOwnerAlerts(supabaseAdmin));
        } catch (err) {
          return Response.json(
            { ok: false, error: err instanceof Error ? err.message : "Delivery failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
