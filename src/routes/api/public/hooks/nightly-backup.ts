import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import { isBackupHour } from "@/lib/nightly-backup";

/**
 * Nightly backup trigger. Called at 07:00 and 08:00 UTC; only the call that
 * lands on 2 a.m. Central runs. The caller must present the server-only
 * BACKUP_CRON_SECRET (never the publishable key), because this job writes to
 * and deletes from SharePoint.
 */
export const Route = createFileRoute("/api/public/hooks/nightly-backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["BACKUP_CRON_SECRET"] ?? "";
        const given = request.headers.get("x-backup-secret") ?? "";
        const ok =
          expected.length >= 32 &&
          given.length === expected.length &&
          timingSafeEqual(Buffer.from(given), Buffer.from(expected));
        if (!ok) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

        if (!isBackupHour(new Date())) {
          return Response.json({ ok: true, skipped: "Not 2 a.m. Central" });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runNightlyBackup } = await import("@/lib/nightly-backup.server");
        const result = await runNightlyBackup(supabaseAdmin as never);
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});
