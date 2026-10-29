import { z } from "zod";
import type { Client } from "./owner-participation.server";
import { readCountedRows } from "./read-all-rows";
import { formatPropertyLabel } from "./property-label";

const nullableText = z.string().nullable();
const programSchema = z.object({
  id: z.string(),
  status: z.string(),
  owner_user_id: nullableText,
  owner_name: nullableText,
  owner_email: nullableText,
  owner_phone: nullableText,
  started_on: nullableText,
  ends_on: nullableText,
  activated_at: nullableText,
  operating_target_hours: z.number().nullable(),
  onboarding_milestone_hours: z.number().nullable(),
  onboarding_milestone_day: z.number().nullable(),
  onboarding_lead: nullableText,
  operations_lead: nullableText,
  dfy_confirmed: z.boolean(),
  completed_at: nullableText,
  notify_email: z.boolean(),
  notify_sms_p1: z.boolean(),
  notify_push: z.boolean(),
});
const propertyLabelSchema = z.object({
  name: nullableText,
  nickname: nullableText,
  address_line1: nullableText,
  unit: nullableText.optional(),
  postal_code: nullableText.optional(),
  city: nullableText,
  state: nullableText,
  primary_photo_url: nullableText,
});
const enrollmentSchema = z.object({
  id: z.string(),
  property_id: z.string(),
  closing_date: nullableText,
  closing_confirmed: z.boolean(),
  added_on: z.string(),
  inclusion_status: z.string(),
  onboarding_status: z.string(),
  launch_status: z.string(),
  coverage_status: z.string(),
  last_owner_activity_at: nullableText,
  current_access: z.boolean(),
  properties: propertyLabelSchema.nullable(),
});

/** SQL and transport both allowlist fields; neither returns staff program notes. */
export function parseOwnerProgram(row: { id: string; program: unknown }) {
  const program = programSchema.parse(row.program);
  if (program.id !== row.id) throw new Error("The participation program context changed.");
  return { ...program, internal_notes: null };
}

/** Two results are enough to detect an ambiguous legacy account without picking an Owner. */
export async function findOwnerProgram(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("read_owner_programs").limit(2);
  if (error) throw error;
  if (!data?.length) return null;
  if (data.length !== 1)
    throw new Error("Multiple programs are linked to this account. Ask ARHA to reconcile access.");
  const program = parseOwnerProgram(data[0]!);
  if (program.owner_user_id !== userId)
    throw new Error("The participation program is not available to this account.");
  return program;
}

export async function readOwnerProgram(supabase: Client, programId: string, preview = false) {
  const { data, error } = await supabase.rpc("read_owner_programs", {
    _program_id: programId,
    _preview: preview,
  });
  if (error) throw error;
  if (data?.length !== 1 || data[0]?.id !== programId) {
    throw new Error("That participation program is not available.");
  }
  return { data: parseOwnerProgram(data[0]), error: null };
}

export async function readOwnerProgramProperties(
  supabase: Client,
  programId: string,
  preview = false,
) {
  const rows = await readCountedRows(
    supabase
      .rpc(
        "read_owner_program_properties",
        {
          _program_id: programId,
          _preview: preview,
        },
        { count: "exact" },
      )
      .order("id"),
  );
  if (rows.error) throw rows.error;
  return {
    data: (rows.data ?? []).map((row) => {
      const link = enrollmentSchema.parse(row.enrollment);
      if (link.id !== row.id) throw new Error("The participation Property context changed.");
      return { ...link, properties: link.current_access ? link.properties : null };
    }),
    error: null,
  };
}

/** Labels and active-program markers come from current canonical scope, not raw Property rows. */
export async function readOwnerPropertyLabels(supabase: Client, propertyIds: string[]) {
  const results: { id: string; name: string | null; active: boolean }[] = [];
  const ids = [...new Set(propertyIds)];
  for (let start = 0; start < ids.length; start += 100) {
    const rows = await readCountedRows(
      supabase
        .rpc(
          "read_owner_properties",
          {
            _property_ids: ids.slice(start, start + 100),
          },
          { count: "exact" },
        )
        .order("id")
        .order("program_id"),
    );
    if (rows.error) throw rows.error;
    for (const row of rows.data ?? []) {
      const property = z.object({ id: z.string(), name: nullableText, address_line1: nullableText.optional(), unit: nullableText.optional(), city: nullableText.optional(), state: nullableText.optional(), postal_code: nullableText.optional() }).parse(row.property);
      if (property.id !== row.id) throw new Error("The Property context changed.");
      results.push({
        id: property.id,
        name: formatPropertyLabel(property).primary,
        active: !["closed", "completed", "complete"].includes(row.program_status),
      });
    }
  }
  return results;
}
