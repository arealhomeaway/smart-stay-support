import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OwnerRezResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Listings available in the connected OwnerRez account, for linking to homes. */
export const listOwnerRezListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listListings, OwnerRezError } = await import("./ownerrez.server");
    try {
      const items = await listListings();
      return {
        ok: true as const,
        data: items.map((l) => ({
          id: String(l.id),
          name: l.name,
          location: [l.address?.city, l.address?.state].filter(Boolean).join(", "),
        })),
      };
    } catch (err) {
      const message =
        err instanceof OwnerRezError ? err.message : "Could not reach OwnerRez.";
      return { ok: false as const, error: message };
    }
  });

/** Who is in the home right now, mapped onto the SOP occupancy drivers. */
export const getPropertyStay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => {
    if (!input?.propertyId) throw new Error("propertyId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { stayForListing, OwnerRezError } = await import("./ownerrez.server");

    const { data: property, error } = await context.supabase
      .from("properties")
      .select("id, ownerrez_property_id")
      .eq("id", data.propertyId)
      .maybeSingle();
    if (error) throw error;
    if (!property?.ownerrez_property_id) {
      return { ok: false as const, error: "This home is not linked to an OwnerRez listing yet." };
    }

    try {
      const snapshot = await stayForListing(property.ownerrez_property_id);
      return { ok: true as const, data: snapshot };
    } catch (err) {
      const message = err instanceof OwnerRezError ? err.message : "Could not reach OwnerRez.";
      return { ok: false as const, error: message };
    }
  });
