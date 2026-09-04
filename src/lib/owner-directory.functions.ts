import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin-triggered import of the designated primary owner for every property,
 * plus the coverage numbers a supervisor needs before release.
 *
 * Read-only against OwnerRez — nothing is ever written back to OwnerRez or
 * Notion. Results land in `property_owner_contacts` with their source,
 * source identifier and sync time.
 */

export type OwnerDirectoryStats = {
  properties: number;
  matched: number;
  missing: number;
  ambiguous: number;
  notLinked: number;
  lastSyncedAt: string | null;
  staleCount: number;
};

/** Anything older than this reads as stale rather than current. */
export const OWNER_DIRECTORY_STALE_DAYS = 14;

async function requireSupervisor(
  supabase: {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: string) => Promise<{ data: { role: string }[] | null }>;
      };
    };
  },
  userId: string,
) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role);
  return roles.includes("admin") || roles.includes("manager");
}

export const getOwnerDirectoryStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerDirectoryStats> => {
    const { supabase, userId } = context;
    if (!(await requireSupervisor(supabase as never, userId))) {
      return {
        properties: 0,
        matched: 0,
        missing: 0,
        ambiguous: 0,
        notLinked: 0,
        lastSyncedAt: null,
        staleCount: 0,
      };
    }

    const [{ count: properties }, { data: rows }] = await Promise.all([
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null),
      supabase.from("property_owner_contacts").select("match_status, synced_at, detail"),
    ]);

    const all = rows ?? [];
    const cutoff = Date.now() - OWNER_DIRECTORY_STALE_DAYS * 86400000;
    return {
      properties: properties ?? 0,
      matched: all.filter((r) => r.match_status === "matched").length,
      missing: all.filter((r) => r.match_status === "unmatched").length,
      ambiguous: all.filter((r) => r.match_status === "ambiguous").length,
      notLinked: all.filter((r) => (r.detail ?? "").includes("not linked to an OwnerRez listing"))
        .length,
      lastSyncedAt:
        all
          .map((r) => r.synced_at)
          .sort()
          .reverse()[0] ?? null,
      staleCount: all.filter((r) => new Date(r.synced_at).getTime() < cutoff).length,
    };
  });

export const syncPrimaryOwners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ ok: boolean; message: string; stats?: OwnerDirectoryStats }> => {
      const { supabase, userId } = context;
      if (!(await requireSupervisor(supabase as never, userId))) {
        return {
          ok: false,
          message: "Only supervisors and administrators can refresh the owner directory.",
        };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { listOwnerRezOwners, listOwnerRezListingsWithOwner, resolvePrimaryOwners } =
        await import("@/lib/owner-directory.server");

      // Demo homes never reach an integration.
      const { data: properties, error } = await supabaseAdmin
        .from("properties")
        .select("id, ownerrez_property_id")
        .eq("is_demo", false)
        .is("archived_at", null);
      if (error) return { ok: false, message: error.message };

      let listings;
      let owners;
      try {
        [listings, owners] = await Promise.all([
          listOwnerRezListingsWithOwner(),
          listOwnerRezOwners(),
        ]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "OwnerRez could not be reached.";
        return { ok: false, message: `Owner directory not refreshed — ${message}` };
      }

      const { rows, counts } = resolvePrimaryOwners(properties ?? [], listings, owners);

      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error: upsertError } = await supabaseAdmin
          .from("property_owner_contacts")
          .upsert(chunk, { onConflict: "property_id" });
        if (upsertError) return { ok: false, message: upsertError.message };
      }

      return {
        ok: true,
        message: `${counts.matched} of ${counts.properties} homes matched a designated primary owner (${counts.unmatched} missing, ${counts.ambiguous} ambiguous, ${counts.not_linked} not linked to a listing).`,
        stats: {
          properties: counts.properties,
          matched: counts.matched,
          missing: counts.unmatched,
          ambiguous: counts.ambiguous,
          notLinked: counts.not_linked,
          lastSyncedAt: new Date().toISOString(),
          staleCount: 0,
        },
      };
    },
  );
