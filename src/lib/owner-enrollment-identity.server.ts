import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export async function canonicalEnrollmentOwner(supabase: Client, propertyId: string) {
  const property = await supabase
    .from("properties")
    .select("id, owner_record_id, is_demo, actual_closing_on")
    .eq("id", propertyId)
    .single();
  if (property.error) throw property.error;
  if (!property.data.owner_record_id)
    throw new Error(
      "Link this property to its canonical Owner before enrolling it in Active Owner.",
    );
  const owner = await supabase
    .from("property_owners")
    .select("id, name, email, active")
    .eq("id", property.data.owner_record_id)
    .single();
  if (owner.error) throw owner.error;
  if (!owner.data.active)
    throw new Error(
      "This property's canonical Owner is inactive. Resolve the Owner relationship before enrollment.",
    );
  return { property: property.data, owner: owner.data };
}

export function assertEnrollmentOwner(programOwnerId: string | null, propertyOwnerId: string) {
  if (!programOwnerId)
    throw new Error(
      "This existing program needs an explicit canonical Owner link before adding or reusing enrollment.",
    );
  if (programOwnerId !== propertyOwnerId)
    throw new Error("This property and program belong to different canonical Owners.");
}
