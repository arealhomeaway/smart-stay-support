/**
 * Read-only Breezeway inventory validation (server-only).
 *
 * Nothing in this file creates, merges, reclassifies or overwrites anything —
 * in Breezeway or in Resolve. It reads both inventories and *proposes*
 * mappings for a human to review. Address and name matches are suggestions,
 * never automatic links.
 */
import type {
  BreezewayInventoryReport,
  BreezewayMappingRow,
  BreezewayPropertySummary,
} from "./breezeway";
import { breezewayCompanyIdentity, listBreezewayProperties } from "./breezeway.server";

type ResolveProperty = {
  id: string;
  name: string | null;
  address_line1: string | null;
  formatted_address: string | null;
  city: string | null;
  state: string | null;
  breezeway_property_id: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(
      /\b(street|st|road|rd|avenue|ave|drive|dr|lane|ln|court|ct|circle|cir|boulevard|blvd|place|pl|terrace|ter|way|unit|apt|suite|ste|north|n|south|s|east|e|west|w)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

async function loadResolveProperties(): Promise<ResolveProperty[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("properties")
    .select("id, name, address_line1, formatted_address, city, state, breezeway_property_id")
    .order("name");
  if (error) throw new Error("Could not read Resolve properties.");
  return (data ?? []) as unknown as ResolveProperty[];
}

export async function buildBreezewayInventoryReport(): Promise<BreezewayInventoryReport> {
  const company = await breezewayCompanyIdentity();
  const { items: breezeway, pagesFetched } = await listBreezewayProperties();
  const resolve = await loadResolveProperties();

  const statusOf = (p: BreezewayPropertySummary) => (p.status ?? "unknown").toLowerCase();
  const breezewayActive = breezeway.filter((p) => statusOf(p) === "active").length;
  const breezewayInactive = breezeway.filter((p) => statusOf(p) === "inactive").length;
  const breezewayOther = breezeway.length - breezewayActive - breezewayInactive;

  // Duplicates inside Breezeway itself, keyed on normalized address + name.
  const dupBuckets = new Map<string, number[]>();
  for (const p of breezeway) {
    const key = normalize(`${p.address ?? ""} ${p.city ?? ""} ${p.name ?? ""}`);
    if (!key) continue;
    dupBuckets.set(key, [...(dupBuckets.get(key) ?? []), p.id]);
  }
  const breezewayDuplicates = [...dupBuckets.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));

  const matchedByExternalId: BreezewayMappingRow[] = [];
  const suggested: BreezewayMappingRow[] = [];
  const ambiguous: BreezewayMappingRow[] = [];
  const unmatchedBreezeway: BreezewayMappingRow[] = [];

  const usedResolve = new Set<string>();
  const byStoredId = new Map<string, ResolveProperty>();
  for (const r of resolve) if (r.breezeway_property_id) byStoredId.set(r.breezeway_property_id, r);

  for (const p of breezeway) {
    const row = (extra: Partial<BreezewayMappingRow>): BreezewayMappingRow => ({
      breezewayId: p.id,
      breezewayName: p.name,
      breezewayStatus: p.status,
      resolveId: null,
      resolveName: null,
      confidence: "none",
      note: "",
      ...extra,
    });

    // 1. Existing external ID on the Resolve record wins outright.
    const stored = byStoredId.get(String(p.id));
    if (stored) {
      usedResolve.add(stored.id);
      matchedByExternalId.push(
        row({
          resolveId: stored.id,
          resolveName: stored.name,
          confidence: "external_id",
          note: "Already linked by stored Breezeway property ID.",
        }),
      );
      continue;
    }

    // 2. Breezeway's own reference back to an external system.
    const ref = p.referenceExternalPropertyId ?? p.referencePropertyId;
    const byRef = ref ? resolve.find((r) => r.id === ref) : undefined;
    if (byRef) {
      usedResolve.add(byRef.id);
      matchedByExternalId.push(
        row({
          resolveId: byRef.id,
          resolveName: byRef.name,
          confidence: "external_id",
          note: "Breezeway stores this Resolve ID as its external property reference.",
        }),
      );
      continue;
    }

    // 3. Suggestions only — a human confirms these.
    const addrKey = normalize(`${p.address ?? ""} ${p.city ?? ""}`);
    const addrHits = addrKey
      ? resolve.filter(
          (r) =>
            normalize(`${r.address_line1 ?? r.formatted_address ?? ""} ${r.city ?? ""}`) ===
            addrKey,
        )
      : [];
    if (addrHits.length === 1 && addrHits[0]) {
      const hit = addrHits[0];
      suggested.push(
        row({
          resolveId: hit.id,
          resolveName: hit.name,
          confidence: "suggested_address",
          note: "Address looks the same. Needs review before linking.",
        }),
      );
      continue;
    }
    if (addrHits.length > 1) {
      ambiguous.push(
        row({
          confidence: "suggested_address",
          note: `${addrHits.length} Resolve homes share this address. Manual review required.`,
        }),
      );
      continue;
    }

    const nameKey = normalize(p.name);
    const nameHits = nameKey ? resolve.filter((r) => normalize(r.name) === nameKey) : [];
    if (nameHits.length === 1 && nameHits[0]) {
      const hit = nameHits[0];
      suggested.push(
        row({
          resolveId: hit.id,
          resolveName: hit.name,
          confidence: "suggested_name",
          note: "Name looks the same. Needs review before linking.",
        }),
      );
      continue;
    }
    if (nameHits.length > 1) {
      ambiguous.push(
        row({
          confidence: "suggested_name",
          note: `${nameHits.length} Resolve homes share this name.`,
        }),
      );
      continue;
    }

    unmatchedBreezeway.push(row({ note: "No Resolve home found by ID, address or name." }));
  }

  const suggestedResolveIds = new Set(
    [...suggested].map((s) => s.resolveId).filter((v): v is string => Boolean(v)),
  );
  const unmatchedResolve: BreezewayMappingRow[] = resolve
    .filter((r) => !usedResolve.has(r.id) && !suggestedResolveIds.has(r.id))
    .map((r) => ({
      breezewayId: null,
      breezewayName: null,
      breezewayStatus: null,
      resolveId: r.id,
      resolveName: r.name,
      confidence: "none" as const,
      note: "In Resolve, not found in Breezeway.",
    }));

  return {
    connectedCompany: company.name ?? (company.id != null ? `Company ${company.id}` : null),
    breezewayTotal: breezeway.length,
    breezewayActive,
    breezewayInactive,
    breezewayOther,
    breezewayDuplicates,
    resolveTotal: resolve.length,
    resolveWithBreezewayId: resolve.filter((r) => r.breezeway_property_id).length,
    matchedByExternalId,
    suggested,
    ambiguous,
    unmatchedBreezeway,
    unmatchedResolve,
    pagesFetched,
    requestsUsed: pagesFetched + 1,
  };
}
