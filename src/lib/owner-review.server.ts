import { formatPropertyLabel } from "@/lib/property-label";
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
import type { ReviewDecision, TimeReviewRow } from "./owner-time-review";
export type { ReviewDecision, TimeReviewRow } from "./owner-time-review";

type Client = SupabaseClient<Database>;

/** Every owner-reported entry awaiting or carrying an internal decision. */
export async function loadTimeReviewQueue(supabase: Client, includeAll = false) {
  const entries = await supabase
    .from("owner_time_entries")
    .select(
      "id, program_id, entry_date, minutes, phase, activity, activity_category, output, review_status, review_note, reviewed_at, review_version, flagged, created_at",
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
      .select("entry_id, property_id, properties(name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id)")
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
        return p ? formatPropertyLabel(p).primary : "Property";
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
      reviewVersion: e.review_version,
      flagged: e.flagged,
      propertyNames: names,
      createdAt: e.created_at,
    };
  });
}

/** Record the displayed version and its review/history/audit in one database action. */
export async function reviewTimeEntry(
  supabase: Client,
  userId: string,
  input: { entryId: string; expectedVersion: string; decision: ReviewDecision; note: string },
) {
  if (!input.expectedVersion) {
    throw new Error("Review the current entry before recording a decision.");
  }
  if (input.decision !== "approved" && !input.note.trim()) {
    throw new Error("Returning or flagging an entry requires a reason the owner can read.");
  }
  const { data, error } = await supabase.rpc("review_owner_time_entry", {
    _entry_id: input.entryId,
    _expected_version: input.expectedVersion,
    _decision: input.decision,
    _note: input.note.trim(),
  });
  if (error) throw error;
  if (data !== input.entryId) throw new Error("The participation review could not be recorded.");
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
