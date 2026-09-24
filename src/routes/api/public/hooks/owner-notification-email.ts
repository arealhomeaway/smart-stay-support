import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Instant email copy of one owner notification, called by the database the
 * moment the notification is created. Owner alerts only — staff notifications
 * are never emailed from here. The notification itself is already saved; a
 * failed email is recorded on the row and never undoes it.
 */
export const Route = createFileRoute("/api/public/hooks/owner-notification-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || token !== expected) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { drainOwnerAlerts } = await import("@/lib/owner-notify.server");
        try {
          const result = await drainOwnerAlerts(supabaseAdmin, 1, parsed.data.id);
          return Response.json({ ok: true, emailed: result.emailed });
        } catch (err) {
          console.error("Owner notification email failed:", err);
          return Response.json({ ok: false, error: "Delivery failed" }, { status: 500 });
        }
      },
    },
  },
});
