/**
 * OwnerRez refresh of every home: primary photo, hard property facts and the
 * de-duplicated owner record (rules in owner-sync-rules.ts). One path for the Admin tools button and the
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
    return { ok: false, message: `Nothing was changed: ${message}` };
  }

  const plan = planEnrichment(properties ?? [], listings, owners);

  // 1. Owner records: one row per real owner, reused across their homes. Existing
  // records match whether or not their id carries the "ownerrez:" prefix, and only
  // the bare id is written (owner-sync-rules.ts).
  const { planOwnerKeys, decideOwnerLink, ownerRezOwnerKey, PROGRAM_OWNER_HELD_NOTE } =
    await import("@/lib/owner-sync-rules");
  const conflicts = [...plan.conflicts];
  const { data: stored, error: storedError } = await supabaseAdmin
    .from("property_owners")
    .select("id, source_owner_id")
    .eq("source", "ownerrez");
  if (storedError) return { ok: false, message: storedError.message };
  const keys = planOwnerKeys(stored ?? []);
  for (const r of keys.renames) {
    const { error: renameError } = await supabaseAdmin
      .from("property_owners")
      .update({ source_owner_id: r.to })
      .eq("id", r.id)
      .eq("source_owner_id", r.from);
    if (renameError) return { ok: false, message: renameError.message };
  }
  const drafts = plan.owners
    .map((o) => ({ ...o, source_owner_id: ownerRezOwnerKey(o.source_owner_id) }))
    .filter((o) => !keys.duplicateKeys.has(o.source_owner_id));
  const ownerIdBySource = new Map<string, string>();
  if (drafts.length) {
    const { error: ownerError } = await supabaseAdmin.from("property_owners").upsert(
      drafts.map((o) => ({ ...o, synced_at: new Date().toISOString() })),
      { onConflict: "source,source_owner_id" },
    );
    if (ownerError) return { ok: false, message: ownerError.message };
    const { data: saved } = await supabaseAdmin
      .from("property_owners")
      .select("id, source_owner_id")
      .eq("source", "ownerrez");
    for (const row of saved ?? []) ownerIdBySource.set(row.source_owner_id, row.id);
  }

  // Homes in a current Active Owner program keep their program's owner record.
  const programOwnerByHome = new Map<string, string>();
  const { data: enrolled, error: enrolledError } = await supabaseAdmin
    .from("owner_program_properties")
    .select("property_id, owner_programs!inner(owner_record_id, archived_at, is_demo)")
    .eq("inclusion_status", "included")
    .is("archived_at", null)
    .eq("is_demo", false)
    .is("owner_programs.archived_at", null)
    .eq("owner_programs.is_demo", false);
  if (enrolledError) return { ok: false, message: enrolledError.message };
  for (const row of (enrolled ?? []) as unknown as { property_id: string; owner_programs: { owner_record_id: string | null } }[]) {
    if (row.owner_programs?.owner_record_id) programOwnerByHome.set(row.property_id, row.owner_programs.owner_record_id);
  }
  const ownerNameBySource = new Map(plan.owners.map((o) => [ownerRezOwnerKey(o.source_owner_id), o.name]));
  const nameById = new Map<string, string | null>();
  const heldHomes: { property_id: string; property_name: string; programOwnerId: string; ownerRezKey: string }[] = [];

  // 2. Property facts + photo + owner link.
  let updated = 0;
  let ownersLinked = plan.counts.ownersLinked;
  for (const patch of plan.patches) {
    const values = { ...patch.values } as Record<string, unknown>;
    let provenance = patch.provenance;
    if (patch.ownerSourceId) {
      const key = ownerRezOwnerKey(patch.ownerSourceId);
      const programOwnerId = programOwnerByHome.get(patch.property_id) ?? null;
      const decision = decideOwnerLink({
        targetOwnerId: ownerIdBySource.get(key) ?? null,
        programOwnerId,
        duplicate: keys.duplicateKeys.has(key),
      });
      if (decision.action === "link") {
        values["owner_record_id"] = decision.ownerRecordId;
      } else {
        delete values["ownerrez_owner_id"];
        provenance = provenance.filter((pr) => pr.field_key !== "owner_record_id");
        ownersLinked -= 1;
        const name = (properties ?? []).find((p) => p.id === patch.property_id)?.name ?? patch.property_id;
        if (decision.reason === "program" && programOwnerId) {
          heldHomes.push({ property_id: patch.property_id, property_name: name, programOwnerId, ownerRezKey: key });
          conflicts.push({ property_id: patch.property_id, property_name: name, field: "owner_record_id", detail: PROGRAM_OWNER_HELD_NOTE });
        } else if (decision.reason === "duplicate") {
          conflicts.push({ property_id: patch.property_id, property_name: name, field: "owner_record_id", detail: `Two owner records share OwnerRez owner ${key}. Not linked until they are merged.` });
        }
      }
    }
    patch.provenance = provenance;
    if (Object.keys(values).length === 0) continue;
    values["ownerrez_synced_at"] = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("properties")
      .update(values as never)
      .eq("id", patch.property_id);
    if (updateError) return { ok: false, message: updateError.message };
    updated += 1;
  }

  // Flag each held program home once for an Admin, on the home's page.
  if (heldHomes.length) {
    const ids = [...new Set(heldHomes.map((h) => h.programOwnerId))];
    const { data: names } = await supabaseAdmin.from("property_owners").select("id, name").in("id", ids);
    for (const n of names ?? []) nameById.set(n.id, n.name);
    const { data: open } = await supabaseAdmin
      .from("field_conflicts")
      .select("entity_id")
      .eq("system", "ownerrez")
      .eq("entity_type", "property")
      .eq("field_key", "owner_record_id")
      .eq("status", "open")
      .in("entity_id", heldHomes.map((h) => h.property_id));
    const flagged = new Set((open ?? []).map((r) => r.entity_id));
    const fresh = heldHomes
      .filter((h) => !flagged.has(h.property_id))
      .map((h) => ({
        entity_type: "property",
        entity_id: h.property_id,
        system: "ownerrez",
        field_key: "owner_record_id",
        field_label: "Owner",
        resolve_value: nameById.get(h.programOwnerId) ?? null,
        external_value: `${ownerNameBySource.get(h.ownerRezKey) ?? "OwnerRez owner"} (OwnerRez ${h.ownerRezKey})`,
        note: PROGRAM_OWNER_HELD_NOTE,
      }));
    if (fresh.length) {
      const { error: flagError } = await supabaseAdmin.from("field_conflicts").insert(fresh);
      if (flagError) return { ok: false, message: flagError.message };
    }
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
    message: `${plan.counts.matched} of ${plan.counts.audited} homes matched an OwnerRez listing. ${plan.counts.photos} photos, ${ownersLinked} owner links, ${conflicts.length} items need review.`,
    counts: {
      audited: plan.counts.audited,
      matched: plan.counts.matched,
      updated,
      unmatched: plan.counts.unmatched,
      photos: plan.counts.photos,
      photosMissing: plan.counts.photosMissing,
      ownersLinked,
      ownerRecords: drafts.length,
      ownersMissing: plan.counts.ownersMissing,
      conflicts: conflicts.length,
    },
    conflicts: conflicts.slice(0, 50).map((c) => ({
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
    // Then link any still-unlinked home to Breezeway by its OwnerRez number. Its own failure is
    // recorded here but never fails the property refresh.
    let breezewayAutoLink: Record<string, unknown>;
    try {
      const { autoLinkBreezewayHomes } = await import("@/lib/breezeway-auto-link.server");
      const linked = await autoLinkBreezewayHomes(admin, { trigger: "nightly", now });
      breezewayAutoLink = { ok: true, linked: linked.linked.length, skipped: linked.skipped };
    } catch (e) {
      breezewayAutoLink = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    await admin
      .from("integration_events")
      .update({
        status: result.ok ? "completed" : "failed",
        error_message: result.ok ? null : result.message,
        request_payload: { message: result.message, counts: result.counts ?? null, breezewayAutoLink },
      })
      .eq("id", run.id);
    return { skipped: false, ok: result.ok };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from("integration_events").update({ status: "failed", error_message: message }).eq("id", run.id);
    throw e;
  }
}
