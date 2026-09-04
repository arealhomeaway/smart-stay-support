import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Supervisor-triggered enrichment of the Property Hub from OwnerRez:
 * primary photo, hard property facts and the de-duplicated owner record.
 *
 * Read-only against OwnerRez. Property identity (name/address) is never
 * rewritten here, and every written field lands in `property_field_provenance`.
 */

export type EnrichmentResult = {
  ok: boolean;
  message: string;
  counts?: {
    audited: number;
    matched: number;
    updated: number;
    unmatched: number;
    photos: number;
    photosMissing: number;
    ownersLinked: number;
    ownerRecords: number;
    ownersMissing: number;
    conflicts: number;
  };
  conflicts?: { property: string; field: string; detail: string }[];
};

async function isSupervisor(
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

export const syncPropertyEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnrichmentResult> => {
    const { supabase, userId } = context;
    if (!(await isSupervisor(supabase as never, userId))) {
      return {
        ok: false,
        message: "Only supervisors and administrators can refresh property information.",
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { planEnrichment, listDetailedListings } =
      await import("@/lib/property-enrichment.server");
    const { listOwnerRezOwners } = await import("@/lib/owner-directory.server");

    const { data: properties, error } = await supabaseAdmin
      .from("properties")
      .select("id, name, ownerrez_property_id, latitude, longitude")
      .eq("is_demo", false)
      .is("archived_at", null);
    if (error) return { ok: false, message: error.message };

    let listings;
    let owners;
    try {
      [listings, owners] = await Promise.all([listDetailedListings(), listOwnerRezOwners()]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "OwnerRez could not be reached.";
      return { ok: false, message: `Nothing was changed — ${message}` };
    }

    const plan = planEnrichment(properties ?? [], listings, owners);

    // 1. Owner records — one row per real owner, reused across their homes.
    const ownerIdBySource = new Map<string, string>();
    if (plan.owners.length) {
      const { error: ownerError } = await supabaseAdmin.from("property_owners").upsert(
        plan.owners.map((o) => ({ ...o, synced_at: new Date().toISOString() })),
        { onConflict: "source,source_owner_id" },
      );
      if (ownerError) return { ok: false, message: ownerError.message };
      const { data: saved } = await supabaseAdmin
        .from("property_owners")
        .select("id, source_owner_id")
        .eq("source", "ownerrez");
      for (const row of saved ?? []) ownerIdBySource.set(row.source_owner_id, row.id);
    }

    // 2. Property facts + photo + owner link.
    let updated = 0;
    for (const patch of plan.patches) {
      const values = { ...patch.values } as Record<string, unknown>;
      if (patch.ownerSourceId) {
        const ownerRecordId = ownerIdBySource.get(patch.ownerSourceId);
        if (ownerRecordId) values["owner_record_id"] = ownerRecordId;
      }
      if (Object.keys(values).length === 0) continue;
      values["ownerrez_synced_at"] = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("properties")
        .update(values as never)
        .eq("id", patch.property_id);
      if (updateError) return { ok: false, message: updateError.message };
      updated += 1;
    }

    // 3. Provenance.
    const provenanceRows = plan.patches.flatMap((patch) =>
      patch.provenance.map((pr) => ({ property_id: patch.property_id, ...pr })),
    );
    for (let i = 0; i < provenanceRows.length; i += 300) {
      const chunk = provenanceRows.slice(i, i + 300);
      const { error: provError } = await supabaseAdmin
        .from("property_field_provenance")
        .upsert(chunk, { onConflict: "property_id,field_key" });
      if (provError) return { ok: false, message: provError.message };
    }

    return {
      ok: true,
      message: `${plan.counts.matched} of ${plan.counts.audited} homes matched an OwnerRez listing. ${plan.counts.photos} photos, ${plan.counts.ownersLinked} owner links, ${plan.conflicts.length} items need review.`,
      counts: {
        audited: plan.counts.audited,
        matched: plan.counts.matched,
        updated,
        unmatched: plan.counts.unmatched,
        photos: plan.counts.photos,
        photosMissing: plan.counts.photosMissing,
        ownersLinked: plan.counts.ownersLinked,
        ownerRecords: plan.owners.length,
        ownersMissing: plan.counts.ownersMissing,
        conflicts: plan.conflicts.length,
      },
      conflicts: plan.conflicts.slice(0, 50).map((c) => ({
        property: c.property_name,
        field: c.field,
        detail: c.detail,
      })),
    };
  });
