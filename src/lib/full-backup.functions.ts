import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FullBackupRecord = {
  id: string;
  folder: string;
  created_at: string;
  finished_at: string | null;
  status: "running" | "succeeded" | "failed";
  table_count: number | null;
  total_rows: number | null;
  counts: Record<string, number> | null;
  error: string | null;
  verified_at: string | null;
  verify_ok: boolean | null;
  verify_result: {
    ok: boolean;
    error?: string;
    broken?: number;
    changed?: number;
    newTables?: string[];
    lines?: { table: string; saved: number; file: number | null; live: number | null; state: string }[];
  } | null;
  created_by_name: string | null;
};

async function requireAdmin(supabase: { rpc: (fn: string, args: Record<string, unknown>) => any }, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Could not check your access.");
  if (data !== true) throw new Error("Only an Admin can do this.");
}

/** Admin only: the latest backups, newest first. */
export const listFullBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const db = context.supabase as unknown as { from: (t: string) => any };
    const { data, error } = await db
      .from("full_backups")
      .select("id, folder, created_at, finished_at, status, table_count, total_rows, counts, error, verified_at, verify_ok, verify_result, creator:profiles!full_backups_created_by_fkey(full_name)")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return { ready: false as const, backups: [] as FullBackupRecord[] };
    const backups = ((data ?? []) as (FullBackupRecord & { creator: { full_name: string | null } | null })[]).map(
      ({ creator, ...b }) => ({ ...b, created_by_name: creator?.full_name ?? null }),
    );
    return { ready: true as const, backups };
  });

/** Admin only: back up every table now. Reads only. */
export const runFullBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runFullBackup } = await import("@/lib/full-backup.server");
    return runFullBackup(supabaseAdmin as never, context.userId);
  });

/** Admin only: re-read a backup's files and compare them with the saved counts and the live tables. */
export const verifyFullBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyFullBackup } = await import("@/lib/full-backup.server");
    return verifyFullBackup(supabaseAdmin as never, context.userId, data.id);
  });
