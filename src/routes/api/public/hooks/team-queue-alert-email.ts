import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Instant email copy of one Team Queue alert (Emily, Nov 8, 2026): the Supervisor alert at 10
 * minutes and the Director alert at 15 are emailed the moment the database writes them, not on
 * the 5-minute pass. Called by the database trigger staff_notifications_team_queue_email_now
 * with the alert's id; the in-app alert is already saved.
 *
 * Same sender and safety checks as every other staff email (demo never emailed, staff-only
 * recipients, personal settings). Only these two alert kinds can be sent from here. It opens
 * no email job run, so it never holds up the 5-minute pass. A failed send stays waiting and the
 * 5-minute pass sends it after 10 minutes.
 * The caller must present the database-held scheduler token (x-cron-secret).
 */
export const Route = createFileRoute("/api/public/hooks/team-queue-alert-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-cron-secret") ?? "";
        if (!token) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const verified = await supabaseAdmin.rpc("cleaner_verify_cron_token", { _token: token });
        if (verified.error || verified.data !== true)
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });

        const { drainStaffNotifications } = await import("@/lib/staff-notify.server");
        try {
          const result = await drainStaffNotifications(supabaseAdmin, 1, undefined, undefined, parsed.data.id);
          return Response.json({ ok: true, emailed: result.emailed });
        } catch (err) {
          console.error("Team Queue alert email failed:", err);
          return Response.json({ ok: false, error: "Delivery failed" }, { status: 500 });
        }
      },
    },
  },
});
