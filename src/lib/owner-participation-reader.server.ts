import { z } from "zod";
import type { Client } from "./owner-participation.server";
import { readCountedRows } from "./read-all-rows";

const text = z.string().nullable();
const reviewSchema = z
  .object({
    id: z.string(),
    program_id: z.string(),
    updated_at: z.string(),
    auto_ticket: z.boolean(),
    phase: z.string(),
    stage: z.string(),
    title: z.string(),
    task_type: z.string(),
    recommendation: text,
    business_question: text,
    evidence: text,
    impact: text,
    decision_path: z.string(),
    respond_by: text,
    status: z.string(),
    owner_decision: text,
    owner_response: text,
    outcome: text,
    responded_at: text,
    ticket_id: text,
    property_id: text,
    attachment_path: text,
    photos: z.unknown(),
    sort_order: z.number(),
    source_type: z.string(),
    onboarding_task_id: text,
    owner_action_type: z.string(),
    available_from: text,
    closed_at: text,
    property_ids: z.array(z.string()),
  })
  .transform((row) => ({ ...row, staff_context: null }));
const entrySchema = z
  .object({
    id: z.string(),
    program_id: z.string(),
    owner_user_id: text,
    phase: z.string(),
    entry_date: z.string(),
    minutes: z.number(),
    activity: z.string(),
    activity_category: text,
    decision_outcome: text,
    output: text,
    comments: text,
    attachment_path: text,
    review_id: text,
    ticket_id: text,
    owner_update_revision: z.number().nullable(),
    owner_update_snapshot: z.unknown(),
    amends_entry_id: text,
    correction_reason: text,
    review_status: z.string(),
    reviewed_at: text,
    review_note: text,
    attested: z.boolean(),
    flagged: z.boolean(),
    created_at: z.string(),
    property_ids: z.array(z.string()),
  })
  .transform((row) => ({ ...row, reviewed_by: null }));
const badgeSchema = z.object({
  code: z.string(),
  awarded_at: z.string(),
  trigger_rule: z.string(),
  needs_review: z.boolean(),
});
const eventSchema = z.object({
  id: z.string(),
  kind: z.string(),
  created_at: z.string(),
  review_id: text,
  detail: z.object({
    response: z.unknown().optional(),
    propertyId: z.unknown().optional(),
    ticketId: z.unknown().optional(),
    ownerUpdate: z.unknown().optional(),
  }),
});
const alertSchema = z.object({
  id: z.string(),
  kind: z.string(),
  priority: z.string(),
  ticket_id: text,
  review_id: text,
  read_at: text,
  created_at: z.string(),
  title: z.string(),
  body: z.string(),
  action_path: text.optional(),
});
const schemas = {
  reviews: reviewSchema,
  entries: entrySchema,
  badges: badgeSchema,
  events: eventSchema,
  alerts: alertSchema,
};
type Section = keyof typeof schemas;

/** Both SQL and transport allowlist the owner's current view and retained history. */
export function parseOwnerParticipation<S extends Section>(
  section: S,
  item: unknown,
): z.output<(typeof schemas)[S]> {
  return schemas[section].parse(item) as z.output<(typeof schemas)[S]>;
}

export async function readOwnerParticipation<S extends Section>(
  supabase: Client,
  section: S,
  programId: string,
  preview = false,
) {
  const sectionName: string = section;
  const rows = await readCountedRows(
    supabase
      .rpc(
        "read_owner_participation",
        {
          _section: sectionName,
          _program_id: programId,
          _preview: preview,
        },
        { count: "exact" },
      )
      .order("id"),
  );
  return { data: rows.data.map((row) => parseOwnerParticipation(section, row.item)), error: null };
}
