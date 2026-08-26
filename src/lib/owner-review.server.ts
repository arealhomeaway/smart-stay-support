/**
 * Stage 3 — internal review of owner-reported participation, plus the
 * editable program rule set.
 *
 * Nothing in here creates, estimates or adjusts an owner's minutes. A
 * reviewer can only record a decision (approve, return, flag) with a visible
 * reason; the homeowner's original entry is never rewritten.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { recordEvent } from "./owner-participation.server";
import { writeAudit } from "./audit.server";

type Client = SupabaseClient<Database>;

export type ReviewDecision = "approved" | "returned" | "flagged";

export type TimeReviewRow = {
  id: string;
  programId: string;
  ownerName: string | null;
  entryDate: string;
  minutes: number;
  phase: string;
  activity: string;
  activityCategory: string | null;
  output: string | null;
  reviewStatus: string;
  reviewNote: string | null;
  reviewedAt: string | null;
  flagged: boolean;
  propertyNames: string[];
  createdAt: string;
};

/** Every owner-reported entry awaiting or carrying an internal decision. */
export async function loadTimeReviewQueue(supabase: Client, includeAll = false) {
  const entries = await supabase
    .from("owner_time_entries")
    .select(
      "id, program_id, entry_date, minutes, phase, activity, activity_category, output, review_status, review_note, reviewed_at, flagged, created_at",
    )
    .eq("is_demo", false)
    .order("entry_date", { ascending: false })
    .limit(400);
  if (entries.error) throw entries.error;

  const rows = (entries.data ?? []).filter(
    (e) => includeAll || e.review_status === "submitted" || e.review_status === "flagged",
  );
  if (rows.length === 0) return [] as TimeReviewRow[];

  const [programs, links] = await Promise.all([
    supabase.from("owner_programs").select("id, owner_name"),
    supabase
      .from("owner_time_entry_properties")
      .select("entry_id, property_id, properties(name, nickname)")
      .in(
        "entry_id",
        rows.map((r) => r.id),
      ),
  ]);
  if (programs.error) throw programs.error;
  if (links.error) throw links.error;

  const ownerOf = new Map((programs.data ?? []).map((p) => [p.id, p.owner_name]));

  return rows.map((e): TimeReviewRow => {
    const names = (links.data ?? [])
      .filter((l) => l.entry_id === e.id)
      .map((l) => {
        const p = l.properties as unknown as { name: string; nickname: string | null } | null;
        return p ? p.nickname || p.name : "Property";
      });
    return {
      id: e.id,
      programId: e.program_id,
      ownerName: ownerOf.get(e.program_id) ?? null,
      entryDate: e.entry_date,
      minutes: e.minutes,
      phase: e.phase,
      activity: e.activity,
      activityCategory: e.activity_category,
      output: e.output,
      reviewStatus: e.review_status,
      reviewNote: e.review_note,
      reviewedAt: e.reviewed_at,
      flagged: e.flagged,
      propertyNames: names,
      createdAt: e.created_at,
    };
  });
}

/** Records a reviewer decision. The reported minutes are left untouched. */
export async function reviewTimeEntry(
  supabase: Client,
  userId: string,
  input: { entryId: string; decision: ReviewDecision; note: string },
) {
  if (input.decision !== "approved" && !input.note.trim()) {
    throw new Error("Returning or flagging an entry requires a reason the owner can read.");
  }

  const entry = await supabase
    .from("owner_time_entries")
    .select("id, program_id, minutes, activity, review_status")
    .eq("id", input.entryId)
    .single();
  if (entry.error) throw entry.error;

  const { error } = await supabase
    .from("owner_time_entries")
    .update({
      review_status: input.decision,
      review_note: input.note.trim() || null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      flagged: input.decision === "flagged",
    })
    .eq("id", input.entryId);
  if (error) throw error;

  await recordEvent(supabase, {
    programId: entry.data.program_id,
    kind: "time_entry_reviewed",
    summary: `Entry ${input.decision}: ${entry.data.activity}`,
    actorId: userId,
    entryId: input.entryId,
    previousValue: entry.data.review_status,
    newValue: input.decision,
    reason: input.note.trim() || null,
  });

  await writeAudit({
    actorId: userId,
    action: `owner_time_entry_${input.decision}`,
    entityType: "owner_time_entry",
    entityId: input.entryId,
    reason: input.note.trim() || null,
    before: { review_status: entry.data.review_status },
    after: { review_status: input.decision },
  });

  return { ok: true as const };
}

/* ---------------------------------------------------------------- *
 * Program rules — configurable, never hard-coded.
 * ---------------------------------------------------------------- */

export type RuleValue = Record<string, string | number | boolean | null>;

export type ProgramRule = {
  id: string;
  key: string;
  label: string;
  description: string | null;
  value: RuleValue;
  updatedAt: string;
};

export async function loadProgramRules(supabase: Client): Promise<ProgramRule[]> {
  const { data, error } = await supabase
    .from("owner_program_rules")
    .select("id, key, label, description, value, updated_at")
    .order("key");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    label: r.label,
    description: r.description,
    value: (r.value ?? {}) as RuleValue,
    updatedAt: r.updated_at,
  }));
}

/** Supervisor-only rule change. The database audits every write. */
export async function updateProgramRule(
  supabase: Client,
  userId: string,
  input: { key: string; value: RuleValue },
) {
  const { error } = await supabase
    .from("owner_program_rules")
    .update({ value: input.value as never, updated_by: userId })
    .eq("key", input.key);
  if (error) throw error;
  return { ok: true as const };
}
