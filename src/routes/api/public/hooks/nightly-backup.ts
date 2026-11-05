import { createFileRoute } from "@tanstack/react-router";
import { isBackupHour } from "@/lib/nightly-backup";
import { backupCallerAllowed } from "@/lib/backup-cron-auth";

/**
 * Nightly backup trigger. Called at 07:00 and 08:00 UTC; only the call that
 * lands on 2 a.m. Central runs. The caller must present the database-held
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

        if (!isBackupHour(new Date())) {
          return Response.json({ ok: true, skipped: "Not 2 a.m. Central" });
        }
        const { runNightlyBackup } = await import("@/lib/nightly-backup.server");
        const result = await runNightlyBackup(supabaseAdmin as never);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
