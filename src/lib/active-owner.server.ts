/** Canonical staff-side membership lookup. Portal authorization uses checked owner RPCs. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readCountedRows } from "./read-all-rows";
type Client = SupabaseClient<Database>;
const INACTIVE_PROGRAM = new Set(["closed", "completed", "complete"]);
export type ActiveOwnerLink = {
  propertyId: string;
  programId: string;
  ownerUserId: string | null;
  ownerName: string | null;
  programStatus: string;
};

/** Only an explicit current canonical enrollment establishes participation. */
export async function activeOwnerLinks(
  supabase: Client,
  propertyIds?: string[],
): Promise<Map<string, ActiveOwnerLink>> {
  const map = new Map<string, ActiveOwnerLink>();
  const ids = propertyIds ? [...new Set(propertyIds.filter(Boolean))] : null;
  if (ids?.length === 0) return map;
  const batches = ids
    ? Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
        ids.slice(i * 100, i * 100 + 100),
      )
    : [null];
  const duplicateProperties = new Set<string>();
  for (const batch of batches) {
    let query = supabase
      .from("owner_program_properties")
      .select(
        "property_id, program_id, inclusion_status, archived_at, is_demo, owner_programs!inner(id, owner_record_id, owner_user_id, status, archived_at, is_demo)",
        { count: "exact" },
      )
      .order("program_id")
      .order("property_id");
    if (batch) query = query.in("property_id", batch);
    const joined = await readCountedRows(query);
    const current = joined.data.filter(
      (row) => row.inclusion_status === "included" && !row.archived_at,
    );
    const homes = [...new Set(current.map((row) => row.property_id))];
    for (let offset = 0; offset < homes.length; offset += 100) {
      const properties = await readCountedRows(
        supabase
          .from("properties")
          .select("id, owner_record_id, archived_at, is_demo", { count: "exact" })
          .in("id", homes.slice(offset, offset + 100))
          .order("id"),
      );
      const ownerIds = [
        ...new Set(
          properties.data
            .map((row) => row.owner_record_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (!ownerIds.length) continue;
      const owners = await readCountedRows(
        supabase
          .from("property_owners")
          .select("id, name", { count: "exact" })
          .in("id", ownerIds)
          .eq("active", true)
          .order("id"),
      );
      const byOwner = new Map(owners.data.map((owner) => [owner.id, owner]));
      for (const home of properties.data) {
        if (home.archived_at || !home.owner_record_id || !byOwner.has(home.owner_record_id))
          continue;
        for (const row of current.filter((enrollment) => enrollment.property_id === home.id)) {
          const program = row.owner_programs;
          if (
            !program ||
            program.archived_at ||
            INACTIVE_PROGRAM.has(program.status) ||
            program.owner_record_id !== home.owner_record_id ||
            program.is_demo !== home.is_demo ||
            row.is_demo !== home.is_demo
          )
            continue;
          if (map.has(home.id)) {
            duplicateProperties.add(home.id);
            continue;
          }
          map.set(home.id, {
            propertyId: home.id,
            programId: program.id,
            ownerUserId: program.owner_user_id,
            ownerName: byOwner.get(home.owner_record_id)?.name ?? null,
            programStatus: program.status,
          });
        }
      }
    }
  }
  if (duplicateProperties.size)
    throw new Error(
      "A Property has conflicting canonical participation programs. Resolve enrollment before continuing.",
    );
  return map;
}
export async function activeOwnerFor(
  supabase: Client,
  propertyId: string,
): Promise<ActiveOwnerLink | null> {
  return (await activeOwnerLinks(supabase, [propertyId])).get(propertyId) ?? null;
}
