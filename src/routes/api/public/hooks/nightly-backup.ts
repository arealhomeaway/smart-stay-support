import { createFileRoute } from "@tanstack/react-router";
import { inExportWindow } from "@/lib/nightly-export";
import { backupCallerAllowed } from "@/lib/backup-cron-auth";

/**
 * Nightly export trigger (register N10). Called at 07:00 and 08:00 UTC and every 10 minutes
 * after, until 5 a.m. Central; each call between 2 and 5 a.m. Central starts or continues
 * tonight's full export and saves where it got to. The caller must present the database-held
 * scheduler token (x-cron-secret), checked by a service-role-only function.
 * Never the publishable key, because this job writes to and deletes from SharePoint.
 */
export const Route = createFileRoute("/api/public/hooks/nightly-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ok = await backupCallerAllowed(request.headers.get("x-cron-secret"), async (t) => {
          const { data } = await (supabaseAdmin as any).rpc("backup_verify_cron_token", { _token: t });
          return data === true;
        });
        if (!ok) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        const now = new Date();
        if (!inExportWindow(now)) {
          return Response.json({ ok: true, skipped: "Not between 2 and 5 a.m. Central" });
        }
        const { runNightlyExportStep } = await import("@/lib/nightly-export.server");
        const result = await runNightlyExportStep(supabaseAdmin as never, { now, trigger: "schedule" });
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
