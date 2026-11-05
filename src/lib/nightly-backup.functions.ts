import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/access.server";

export type BackupRunRow = {
  id: string;
  folder_name: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  error: string | null;
  files: { file: string; rows: number }[] | null;
  pruned_count: number | null;
};

/** Admin-only: recent backup runs. `ready: false` until the run log exists. */
export const listBackupRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data, error } = await db
      .from("backup_runs")
      .select("id, folder_name, status, started_at, finished_at, error, files, pruned_count")
      .order("started_at", { ascending: false })
      .limit(10);
    if (error) return { ready: false as const, runs: [] as BackupRunRow[] };
    return { ready: true as const, runs: (data ?? []) as BackupRunRow[] };
  });

/** Admin-only: run the backup now through the same server path as the schedule. */
export const runBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runNightlyBackup } = await import("@/lib/nightly-backup.server");
    return runNightlyBackup(supabaseAdmin as never, new Date(), "manual");
  });
