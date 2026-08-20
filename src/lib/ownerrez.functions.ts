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

/** Creates a home for every OwnerRez listing that isn't linked yet. */
export const importOwnerRezProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listListings, OwnerRezError } = await import("./ownerrez.server");

    let listings;
    try {
      listings = await listListings();
    } catch (err) {
      const message = err instanceof OwnerRezError ? err.message : "Could not reach OwnerRez.";
      return { ok: false as const, error: message };
    }

    const { data: existing, error } = await context.supabase
      .from("properties")
      .select("id, name, ownerrez_property_id");
    if (error) return { ok: false as const, error: error.message };

    const linked = new Set(
      (existing ?? []).map((p) => p.ownerrez_property_id).filter(Boolean) as string[],
    );
    const byName = new Map(
      (existing ?? []).map((p) => [p.name.trim().toLowerCase(), p] as const),
    );

    const now = new Date().toISOString();
    let created = 0;
    let matched = 0;

    for (const l of listings) {
      const listingId = String(l.id);
      if (linked.has(listingId)) continue;

      const existingByName = byName.get(l.name.trim().toLowerCase());
      if (existingByName && !existingByName.ownerrez_property_id) {
        const { error: linkError } = await context.supabase
          .from("properties")
          .update({ ownerrez_property_id: listingId, ownerrez_synced_at: now })
          .eq("id", existingByName.id);
        if (!linkError) matched += 1;
        continue;
      }

      const { error: insertError } = await context.supabase.from("properties").insert({
        name: l.name,
        address_line1: l.address?.street1 ?? null,
        unit: l.address?.street2 ?? null,
        city: l.address?.city ?? null,
        state: l.address?.state ?? null,
        postal_code: l.address?.postal_code ?? l.address?.zip ?? null,
        ownerrez_property_id: listingId,
        ownerrez_synced_at: now,
        created_by: context.userId,
      });
      if (!insertError) created += 1;
    }

    return { ok: true as const, created, matched, total: listings.length };
  });
