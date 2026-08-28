/**
 * Active Owner (90-Day Owner Participation Program) participation lookup.
 *
 * Source of truth: the existing enrollment records — `owner_program_properties`
 * (the per-property join, `inclusion_status = 'included'`) plus the legacy
 * single-property column `owner_programs.property_id`. Participation is never
 * inferred from the generic `owner` role, and no new tag is created: a person
 * is an Active Owner only for the properties their program is enrolled on.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** Programs in these states no longer create new owner obligations. */
const INACTIVE_PROGRAM = new Set(["closed", "completed"]);

export type ActiveOwnerLink = {
  propertyId: string;
  programId: string;
  ownerUserId: string | null;
  ownerName: string | null;
  programStatus: string;
};

/**
 * Participation per owner/property relationship, keyed by property id.
 * A property absent from the map is a regular (non-participating) owner home.
 */
export async function activeOwnerLinks(
  supabase: Client,
  propertyIds?: string[],
): Promise<Map<string, ActiveOwnerLink>> {
  const map = new Map<string, ActiveOwnerLink>();
  const ids = propertyIds?.filter(Boolean) ?? null;
  if (ids && ids.length === 0) return map;

  let joinQuery = supabase
    .from("owner_program_properties")
    .select(
      "property_id, program_id, inclusion_status, owner_programs!inner(id, owner_user_id, owner_name, status)",
    )
    .eq("inclusion_status", "included");
  if (ids) joinQuery = joinQuery.in("property_id", ids);

  let legacyQuery = supabase
    .from("owner_programs")
    .select("id, property_id, owner_user_id, owner_name, status")
    .not("property_id", "is", null);
  if (ids) legacyQuery = legacyQuery.in("property_id", ids);

  const [joined, legacy] = await Promise.all([joinQuery, legacyQuery]);
  if (joined.error) throw joined.error;
  if (legacy.error) throw legacy.error;

  for (const row of joined.data ?? []) {
    const program = row.owner_programs as unknown as {
      id: string;
      owner_user_id: string | null;
      owner_name: string | null;
      status: string;
    } | null;
    if (!program || INACTIVE_PROGRAM.has(program.status)) continue;
    map.set(row.property_id, {
      propertyId: row.property_id,
      programId: program.id,
      ownerUserId: program.owner_user_id,
      ownerName: program.owner_name,
      programStatus: program.status,
    });
  }

  for (const p of legacy.data ?? []) {
    if (!p.property_id || map.has(p.property_id)) continue;
    if (INACTIVE_PROGRAM.has(p.status)) continue;
    map.set(p.property_id, {
      propertyId: p.property_id,
      programId: p.id,
      ownerUserId: p.owner_user_id,
      ownerName: p.owner_name,
      programStatus: p.status,
    });
  }

  return map;
}

export async function activeOwnerFor(
  supabase: Client,
  propertyId: string,
): Promise<ActiveOwnerLink | null> {
  const map = await activeOwnerLinks(supabase, [propertyId]);
  return map.get(propertyId) ?? null;
}
