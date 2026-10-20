import type { SupabaseClient } from "@supabase/supabase-js";

type Part = { name: string; run: (runId: string) => Promise<unknown> };

/** Synchronous, audited execution. No untracked background work or automatic retry. */
export async function runEmailJob(db: SupabaseClient, parts: Part[]) {
  const started = await db.rpc("begin_email_job_run" as never);
  if (started.error || typeof started.data !== "string")
    throw new Error("Email job audit unavailable; no work started.");
  const runId = started.data;
  const results: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const part of parts) {
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
    if (errors.length) break;
  }
  const finished = await db.rpc("finish_email_job_run" as never, { _run_id: runId, _errors: errors } as never);
  if (finished.error) throw new Error("Run finish could not be recorded; do not retry automatically.");
  return { ok: errors.length === 0, runId, results, errors, audit: finished.data };
}