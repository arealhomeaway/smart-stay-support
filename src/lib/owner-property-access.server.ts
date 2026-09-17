import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/** The service caller supplies only an identity verified by auth middleware. */
export async function ownerPropertyAccess(
  client: Client,
  userId: string,
  propertyId: string | null,
): Promise<boolean> {
  if (!propertyId) return false;
  const result = await client.rpc("owner_property_access", {
    _property_id: propertyId,
    _actor_id: userId,
  });
  return !result.error && result.data === true;
}

export function isExternalOwner(viewer: { roles: string[] }): boolean {
  return viewer.roles.length > 0 && viewer.roles.every((role) => role === "owner");
}
