import { createFileRoute } from "@tanstack/react-router";

/**
 * Every-minute email run for the Team Queue alerts only (Emily, Nov 8, 2026): the Supervisor
 * alert at 10 minutes and the Director alert at 15 are emailed within a minute instead of on
 * the 5-minute pass. The in-app alert is already written by the database minute check.
 *
 * Same sender, same safety checks (demo rows never emailed, staff-only recipients, personal
 * settings, retries) as every other staff email. The 5-minute pass skips these two kinds, so
 * each is emailed by exactly one run. It does not open an email job run, so it can never hold
 * up or be held up by the 5-minute pass.
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

        const { drainStaffNotifications } = await import("@/lib/staff-notify.server");
        try {
          const result = await drainStaffNotifications(supabaseAdmin, 20, undefined, undefined, "fast");
          return Response.json(result, { status: 200 });
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
