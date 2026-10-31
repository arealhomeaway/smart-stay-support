/** Report wording screen data. Missing staged objects read as "Not set up yet". */
import { supabase } from "@/integrations/supabase/client";
import { isMissingReportObject, wordingProblem } from "./report-v2";

type Res = { data: unknown; error: { code?: string; message?: string } | null };
const db = supabase as unknown as {
  from: (t: string) => { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => PromiseLike<Res> } };
  rpc: (fn: string, a: Record<string, unknown>) => PromiseLike<Res>;
};

export type WordingVersionRow = { version: number; sentences: string[]; note: string | null; created_at: string };

export async function loadWordingVersions(): Promise<{ available: false } | { available: true; data: WordingVersionRow[] }> {
  const r = await db.from("report_wording_versions").select("version,sentences,note,created_at").order("version", { ascending: false });
  if (r.error) {
    if (isMissingReportObject(r.error, "report_wording_versions")) return { available: false };
    throw new Error(r.error.message ?? "Could not load report wording.");
  }
  return { available: true, data: (r.data ?? []) as WordingVersionRow[] };
}

export async function saveWordingVersion(sentences: string[], note: string) {
  const problem = wordingProblem(sentences);
  if (problem) throw new Error(problem);
  const r = await db.rpc("report_wording_save", { _sentences: sentences, _note: note || null });
  if (r.error) throw new Error(r.error.message ?? "Could not save report wording.");
  return r.data as number;
}
