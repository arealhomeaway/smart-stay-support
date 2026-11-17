import type { SupabaseClient } from "@supabase/supabase-js";

type Part = { name: string; run: (runId: string) => Promise<unknown> };

/**
 * Synchronous, audited execution. No untracked background work or automatic retry.
 * Property page Part 2 (2.7): a part that throws or reports failed sends is recorded and the run
 * CONTINUES to the next part, so the nightly PID copy, OwnerRez reviews and the property refresh
 * never depend on an email part. Only a failure of the audit steps themselves stops a run.
 */
/**
 * A pass starts no new part after this long, so it always ends before the database's 10-minute
 * automatic close (begin_email_job_run) hands the run to the next pass. Together with that close and
 * record_email_job_part refusing a closed run, only one pass can be sending at a time. Parts not
 * started are recorded under "deferred" and simply run on the next pass.
 */
export const RUN_BUDGET_MS = 7 * 60_000;

export async function runEmailJob(
  db: SupabaseClient,
  parts: Part[],
  opts: { now?: () => number; budgetMs?: number } = {},
) {
  const now = opts.now ?? Date.now;
  const budgetMs = opts.budgetMs ?? RUN_BUDGET_MS;
  const started = await db.rpc("begin_email_job_run" as never);
  if (started.error || typeof started.data !== "string")
    throw new Error("Email job audit unavailable; no work started.");
  const runId = started.data;
  const startedAt = now();
  const results: Record<string, unknown> = {};
  const errors: string[] = [];
  const deferred: string[] = [];
  for (const part of parts) {
    if (now() - startedAt > budgetMs) { deferred.push(part.name); continue; }
    try {
      const result = await part.run(runId);
      results[part.name] = result;
      if (result && typeof result === "object" && "ok" in result && result.ok === false)
        errors.push(`${part.name}: reported an unsuccessful result`);
      if (result && typeof result === "object" && "notes" in result && Array.isArray(result.notes)) {
        errors.push(...result.notes.map((note) => `${part.name}: ${String(note)}`));
      }
    } catch (err) {
      errors.push(`${part.name}: ${err instanceof Error ? err.message : "Failed"}`);
    }
    const saved = await db.rpc("record_email_job_part" as never, {
      _run_id: runId, _part: part.name, _result: results[part.name] ?? null, _errors: errors,
    } as never);
    if (saved.error) {
      throw new Error("Run audit failed; unfinished run retained and remaining work stopped. Do not retry automatically.");
    }
  }
  if (deferred.length) {
    results["deferred"] = deferred;
    const saved = await db.rpc("record_email_job_part" as never, {
      _run_id: runId, _part: "deferred", _result: deferred, _errors: errors,
    } as never);
    if (saved.error) {
      throw new Error("Run audit failed; unfinished run retained and remaining work stopped. Do not retry automatically.");
    }
  }
  const finished = await db.rpc("finish_email_job_run" as never, { _run_id: runId, _errors: errors } as never);
  if (finished.error) throw new Error("Run finish could not be recorded; do not retry automatically.");
  return { ok: errors.length === 0, runId, results, errors, audit: finished.data };
}