import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExportRunRow, ExportSettings } from "@/lib/nightly-export";

export type ExportCheck = {
  ready: boolean;
  runs: ExportRunRow[];
  settings: ExportSettings;
  alerts: { folder_name: string; reason: string; message: string | null; created_at: string }[];
};

/**
 * The read only Export check page (register N10; Emily, Nov 9): Admin, the Operations Supervisor,
 * the Director of Operations and the Director of Onboarding. Reads with the caller's own access
 * (database rule can_view_export_check) and changes nothing.
 */
export const readExportCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExportCheck> => {
    const sb = context.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => any;
      from: (t: string) => any;
    };
    const { DEFAULT_EXPORT_SETTINGS, EXPORT_SETTINGS_KEY, readExportSettings } = await import("@/lib/nightly-export");
    const allowed = await sb.rpc("can_view_export_check", { _user_id: context.userId });
    if (allowed.error) {
      // Before the export's database step is applied the rule does not exist yet.
      return { ready: false, runs: [], settings: DEFAULT_EXPORT_SETTINGS, alerts: [] };
    }
    if (allowed.data !== true) throw new Error("The export check is for Admin, the Operations Supervisor and the Directors.");

    const [runs, setting, alerts] = await Promise.all([
      sb
        .from("backup_runs")
        .select(
          "id, folder_name, status, phase, weekly, started_at, finished_at, error, table_count, total_rows, files_inventoried, files_copied, bytes_copied, verify_status, verify_reasons, folder_item_id, pruned_at",
        )
        .eq("kind", "nightly")
        .order("started_at", { ascending: false })
        .limit(200),
      sb.from("app_settings").select("value").eq("key", EXPORT_SETTINGS_KEY).maybeSingle(),
      sb.from("backup_export_alerts").select("folder_name, reason, message, created_at").order("created_at", { ascending: false }).limit(14),
    ]);
    if (runs.error) throw new Error("The export history could not be loaded.");
    return {
      ready: true,
      runs: (runs.data ?? []) as ExportRunRow[],
      settings: readExportSettings(setting.data?.value),
      alerts: alerts.error ? [] : (alerts.data ?? []),
    };
  });
