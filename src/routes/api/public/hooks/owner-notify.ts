import { createFileRoute } from "@tanstack/react-router";

/**
 * Drains queued owner alerts to email and (for urgent tickets) text.
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
        const { drainStaffNotifications } = await import("@/lib/staff-notify.server");
        const { evaluateAllPrograms } = await import("@/lib/owner-progress-alerts.server");
        const { sweepDeadlineAlerts } = await import("@/lib/deadline-alerts.server");
        const { drainScheduledEmails } = await import("@/lib/email-composer.server");
        const { drainOwnerWelcomes } = await import("@/lib/owner-welcome.server");
        const { runEmailJob } = await import("@/lib/email-job.server");

        try {
          const result = await runEmailJob(supabaseAdmin, [
            { name: "progress", run: (id) => evaluateAllPrograms(supabaseAdmin, id) },
            { name: "deadlines_and_vendor_reminders", run: () => sweepDeadlineAlerts(supabaseAdmin) },
            { name: "owner", run: (id) => drainOwnerAlerts(supabaseAdmin, 50, undefined, id) },
            { name: "staff", run: (id) => drainStaffNotifications(supabaseAdmin, 50, undefined, id) },
            { name: "scheduled", run: (id) => drainScheduledEmails(new Date(), id) },
            { name: "welcomes", run: (id) => drainOwnerWelcomes(supabaseAdmin, 20, id) },
          ]);
          return Response.json(result, { status: result.ok ? 200 : 500 });
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
