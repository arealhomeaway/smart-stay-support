/**
 * Breezeway ↔ Resolve property mapping audit (server-only).
 *
 * Replaces the hardcoded five-home beta allowlist with a verified eligibility
 * model. A property earns `verified` only when ALL of the following hold:
 *   - the Resolve property is active, not demo and not archived
 *   - exactly one Breezeway home is linked to it
 *   - that Breezeway home is active
 *   - the identity is confirmed deterministically: the Breezeway home id we
 *     hold matches a Breezeway record whose OwnerRez reference id equals the
 *     Resolve property's OwnerRez id (or, where Resolve holds no OwnerRez id,
 *     the home id itself resolves to exactly one active Breezeway home)
 *
 * Fuzzy name/address matching is never used as write authorization.
 * `excluded` is a deliberate admin decision and is never overwritten by an
 * audit pass.
 */
import { listBreezewayProperties } from "./breezeway.server";
import {
  EMPTY_MAPPING_COUNTS,
  type BreezewayMappingState,
  type MappingAuditCounts,
  type MappingAuditResult,
  type MappingAuditRow,
} from "./breezeway-mapping";

type PropertyRow = {
  id: string;
  name: string | null;
  status: string | null;
  is_demo: boolean | null;
  archived_at: string | null;
  ownerrez_property_id: string | null;
  breezeway_property_id: string | null;
  breezeway_mapping_state: BreezewayMappingState | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function isActiveResolve(p: PropertyRow) {
  return !p.is_demo && !p.archived_at && (p.status ?? "active") !== "archived";
}

/**
 * Runs the deterministic audit. `persist: false` reports without writing, so
 * the portfolio can be inspected before anything becomes write-eligible.
 */
export async function auditPortfolioMapping(
  options: { persist?: boolean } = {},
): Promise<MappingAuditResult> {
  const persist = options.persist ?? false;
  const db = await admin();

  const { data, error } = await db
    .from("properties")
    .select(
      "id, name, status, is_demo, archived_at, ownerrez_property_id, breezeway_property_id, breezeway_mapping_state",
    );
  if (error) throw new Error(`Could not read the property portfolio: ${error.message}`);
  const properties = ((data ?? []) as unknown as PropertyRow[]).filter(isActiveResolve);

  const { items } = await listBreezewayProperties();
  const activeHomes = items.filter((h) => (h.status ?? "").toLowerCase() === "active");

  // Deterministic indexes. A reference id claimed by more than one active home
  // is ambiguous by construction and can never authorize a write.
  const byHomeId = new Map<string, (typeof activeHomes)[number]>();
  const byReference = new Map<string, (typeof activeHomes)[number][]>();
  for (const h of activeHomes) {
    byHomeId.set(String(h.id), h);
    const ref = (h.referenceExternalPropertyId ?? "").trim();
    if (!ref) continue;
    const list = byReference.get(ref) ?? [];
    list.push(h);
    byReference.set(ref, list);
  }
  const inactiveHomeIds = new Set(
    items.filter((h) => (h.status ?? "").toLowerCase() !== "active").map((h) => String(h.id)),
  );

  const counts: MappingAuditCounts = { ...EMPTY_MAPPING_COUNTS };
  counts.activeResolveProperties = properties.length;
  const rows: MappingAuditRow[] = [];
  let changed = 0;

  for (const p of properties) {
    const homeId = (p.breezeway_property_id ?? "").trim() || null;
    const ownerrez = (p.ownerrez_property_id ?? "").trim() || null;
    let state: BreezewayMappingState;
    let note: string | null = null;

    if (p.breezeway_mapping_state === "excluded") {
      state = "excluded";
      note = "Excluded by an admin.";
    } else if (!homeId) {
      // No stored home id: try a single deterministic reference match.
      const candidates = ownerrez ? (byReference.get(ownerrez) ?? []) : [];
      if (candidates.length === 1) {
        state = "verified";
        note = `Matched by OwnerRez reference ${ownerrez} to Breezeway home ${candidates[0]!.id}.`;
      } else if (candidates.length > 1) {
        state = "ambiguous";
        note = `${candidates.length} active Breezeway homes carry OwnerRez reference ${ownerrez}.`;
      } else {
        state = "unmapped";
        note = "No Breezeway home is linked to this property.";
      }
    } else if (inactiveHomeIds.has(homeId)) {
      state = "inactive";
      note = `Breezeway home ${homeId} is not active.`;
    } else if (!byHomeId.has(homeId)) {
      state = "unmapped";
      note = `Breezeway home ${homeId} was not found in the active inventory.`;
    } else {
      const home = byHomeId.get(homeId)!;
      const ref = (home.referenceExternalPropertyId ?? "").trim() || null;
      const sharing = ref ? (byReference.get(ref) ?? []) : [];
      if (sharing.length > 1) {
        state = "ambiguous";
        note = `Breezeway reference ${ref} is claimed by ${sharing.length} active homes.`;
      } else if (ownerrez && ref && ownerrez !== ref) {
        state = "ambiguous";
        note = `Breezeway home ${homeId} references ${ref}, but Resolve holds OwnerRez ${ownerrez}.`;
      } else if (ownerrez && ref && ownerrez === ref) {
        state = "verified";
        note = `Home ${homeId} confirmed by OwnerRez reference ${ref}.`;
      } else {
        // No OwnerRez identity on one side: the home id itself is a unique,
        // explicit link, which is deterministic — but never a name match.
        state = "verified";
        note = `Home ${homeId} confirmed by unique stored home id.`;
      }
    }

    counts[state] += 1;
    rows.push({
      propertyId: p.id,
      propertyName: p.name,
      ownerrezPropertyId: ownerrez,
      breezewayHomeId:
        homeId ??
        (state === "verified" && ownerrez ? String((byReference.get(ownerrez) ?? [])[0]?.id) : null),
      state,
      note,
    });

    if (persist && p.breezeway_mapping_state !== state) changed += 1;
  }

  if (persist) {
    const now = new Date().toISOString();
    for (const row of rows) {
      const patch: Record<string, unknown> = {
        breezeway_mapping_state: row.state,
        breezeway_mapping_note: row.note,
        breezeway_mapping_verified_at: row.state === "verified" ? now : null,
      };
      // Backfill the home id only when the audit resolved it deterministically.
      if (row.breezewayHomeId) patch["breezeway_property_id"] = row.breezewayHomeId;
      await db
        .from("properties")
        // Generated types lag the mapping columns added in this migration.
        .update(patch as never)
        .eq("id", row.propertyId);
    }
  }

  return {
    counts,
    changed,
    rows,
    breezewayActiveHomes: activeHomes.length,
    breezewayTotalHomes: items.length,
    persisted: persist,
  };
}

/**
 * Write gate. The ONLY place that answers "may this property reach Breezeway".
 * Reads the persisted mapping state — never a hardcoded list, never a name.
 */
export async function propertyWriteEligibility(propertyId: string): Promise<{
  eligible: boolean;
  reason: string | null;
  homeId: string | null;
  propertyName: string | null;
  state: BreezewayMappingState | null;
}> {
  const db = await admin();
  const { data, error } = await db
    .from("properties")
    .select(
      "id, name, status, is_demo, archived_at, breezeway_property_id, breezeway_mapping_state",
    )
    .eq("id", propertyId)
    .maybeSingle();
  if (error) throw new Error("Could not read the property.");
  const p = data as unknown as PropertyRow | null;
  if (!p) {
    return { eligible: false, reason: "That property does not exist.", homeId: null, propertyName: null, state: null };
  }
  const state = (p.breezeway_mapping_state ?? "unmapped") as BreezewayMappingState;
  const homeId = (p.breezeway_property_id ?? "").trim() || null;
  const name = p.name;
  if (p.is_demo) {
    return { eligible: false, reason: "Demo properties are never sent to Breezeway.", homeId, propertyName: name, state };
  }
  if (p.archived_at || (p.status ?? "active") === "archived") {
    return { eligible: false, reason: "Archived properties are never sent to Breezeway.", homeId, propertyName: name, state };
  }
  if (state !== "verified") {
    return {
      eligible: false,
      reason: `Breezeway writes need a verified property mapping. This one is "${state}".`,
      homeId,
      propertyName: name,
      state,
    };
  }
  if (!homeId) {
    return { eligible: false, reason: "This property has no Breezeway home id.", homeId: null, propertyName: name, state };
  }
  return { eligible: true, reason: null, homeId, propertyName: name, state };
}

/** Every Breezeway home id Resolve currently treats as verified. */
export async function verifiedHomeIds(): Promise<string[]> {
  const db = await admin();
  const { data } = await db
    .from("properties")
    .select("breezeway_property_id")
    .eq("breezeway_mapping_state", "verified")
    .is("archived_at", null)
    .not("breezeway_property_id", "is", null);
  return ((data ?? []) as { breezeway_property_id: string | null }[])
    .map((r) => (r.breezeway_property_id ?? "").trim())
    .filter(Boolean);
}

/** Resolve property for a verified Breezeway home id, if one exists. */
export async function propertyForHomeId(homeId: number | string): Promise<{ id: string; name: string | null } | null> {
  const db = await admin();
  const { data } = await db
    .from("properties")
    .select("id, name")
    .eq("breezeway_property_id", String(homeId))
    .eq("breezeway_mapping_state", "verified")
    .maybeSingle();
  return (data as { id: string; name: string | null } | null) ?? null;
}

/** Admin decision: keep a property out of Breezeway, or return it to the audit. */
export async function setMappingExclusion(propertyId: string, excluded: boolean, note: string | null) {
  const db = await admin();
  const { error } = await db
    .from("properties")
    .update({
      breezeway_mapping_state: excluded ? "excluded" : "unmapped",
      breezeway_mapping_note: note,
      breezeway_mapping_verified_at: null,
    })
    .eq("id", propertyId);
  if (error) throw new Error("Could not update that property's Breezeway mapping.");
}
