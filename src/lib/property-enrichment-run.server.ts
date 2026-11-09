/**
 * OwnerRez refresh of every home: primary photo, hard property facts and the
 * de-duplicated owner record. One path for the Admin tools button and the
 * nightly run. Read-only against OwnerRez; property identity (name/address)
 * is never rewritten, and every written field lands in property_field_provenance.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EnrichmentResult } from "@/lib/property-enrichment.functions";
import { nightlyPropertyRefreshDue } from "@/lib/property-refresh";

type Admin = SupabaseClient<Database>;
export const PROPERTY_REFRESH_SYSTEM = "ownerrez_property_info";
export const PROPERTY_REFRESH_OPERATION = "nightly_refresh";

export async function runPropertyEnrichment(supabaseAdmin: Admin): Promise<EnrichmentResult> {
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
}

/** Nightly refresh on the existing five-minute job; one run a night, each recorded. */
export async function runNightlyPropertyRefresh(admin: Admin, now = new Date()) {
  const { data: recent } = await admin
    .from("integration_events")
    .select("created_at")
    .eq("system", PROPERTY_REFRESH_SYSTEM)
    .eq("operation", PROPERTY_REFRESH_OPERATION)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!nightlyPropertyRefreshDue(now, recent?.[0]?.created_at ?? null)) return { skipped: true };
  const { data: run, error: runErr } = await admin
    .from("integration_events")
    .insert({ system: PROPERTY_REFRESH_SYSTEM, direction: "inbound", operation: PROPERTY_REFRESH_OPERATION, status: "processing", request_payload: {} })
    .select("id")
    .single();
  if (runErr) throw new Error(`Could not record the property refresh run: ${runErr.message}`);
  try {
    const result = await runPropertyEnrichment(admin);
    await admin
      .from("integration_events")
      .update({
        status: result.ok ? "completed" : "failed",
        error_message: result.ok ? null : result.message,
        request_payload: { message: result.message, counts: result.counts ?? null },
      })
      .eq("id", run.id);
    return { skipped: false, ok: result.ok };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("integration_events").update({ status: "failed", error_message: message }).eq("id", run.id);
    throw e;
  }
}
