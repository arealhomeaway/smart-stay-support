import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExportRunRow, ExportSettings } from "@/lib/nightly-export";

export type ExportCheck = {
  ready: boolean;
  runs: ExportRunRow[];
  settings: ExportSettings;
  alerts: { folder_name: string; reason: string; message: string | null; created_at: string }[];
  /** The last checked night's tables with fewer rows now, and stores listed but not copied. */
  last?: { fewer: string[]; notCopied: import("@/lib/nightly-export").NotCopiedStore[] };
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
    const { fewerLiveTables } = await import("@/lib/nightly-export");
    const lastChecked = ((runs.data ?? []) as ExportRunRow[]).find((r) => r.phase !== null && r.verify_status !== null);
    let last: ExportCheck["last"] = { fewer: [], notCopied: [] };
    if (lastChecked) {
      const d = await sb
        .from("backup_runs")
        .select("lines:verify_result->lines, not_copied:progress->stored_files->not_copied")
        .eq("id", lastChecked.id)
        .maybeSingle();
      if (!d.error && d.data) {
        last = {
          fewer: fewerLiveTables(Array.isArray(d.data.lines) ? d.data.lines : []),
          notCopied: Array.isArray(d.data.not_copied) ? d.data.not_copied : [],
        };
      }
    }
    return {
      ready: true,
      last,
      runs: (runs.data ?? []) as ExportRunRow[],
      settings: readExportSettings(setting.data?.value),
      alerts: alerts.error ? [] : (alerts.data ?? []),
    };
  });
