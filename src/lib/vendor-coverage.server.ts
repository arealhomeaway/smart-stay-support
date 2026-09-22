/**
 * Staging & trade coverage for one home — server side, read-only.
 *
 * Two sources: vendors assigned to this exact home, and vendors whose service
 * territory covers its ZIP. The home always wins, including an exclusion. No
 * write path exists here on purpose — this is a lookup, not dispatch.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { CoverageVendor } from "./vendor-coverage";

type Client = SupabaseClient<Database>;

async function assertStaff(db: Client, userId: string) {
  const { data, error } = await db.rpc("is_internal_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only Resolve staff can see vendor coverage.");
}

const ORG_FIELDS =
  "id, display_name, status, vendor_class, markets, service_categories, tier, pricing_note, approval_limit, emergency_available, response_time_note, primary_contact_name, primary_contact_email, primary_contact_phone, last_verified_at";

export async function loadPropertyCoverage(db: Client, userId: string, propertyId: string) {
  await assertStaff(db, userId);

  const { data: property, error: propertyError } = await db
    .from("properties")
    .select("id, name, city, state, postal_code")
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) throw propertyError;
  if (!property) throw new Error("That home could not be found.");

  const zip = (property.postal_code ?? "").trim().slice(0, 5);
  const today = new Date().toISOString().slice(0, 10);

  const [assigned, territory] = await Promise.all([
    db
      .from("property_vendor_coverage")
      .select("org_id, service_category, coverage_priority, excluded, exclusion_reason, rate_note, effective_to")
      .eq("property_id", propertyId),
    zip
      ? db
          .from("vendor_service_areas")
          .select("org_id, service_category, coverage_priority, territory_label, travel_note, effective_to")
          .eq("postal_code", zip)
      : Promise.resolve({ data: [], error: null } as const),
  ]);
  if (assigned.error) throw assigned.error;
  if (territory.error) throw territory.error;

  const live = <T extends { effective_to: string | null }>(rows: readonly T[]) =>
    rows.filter((r) => !r.effective_to || r.effective_to >= today);

  const assignedRows = live(assigned.data ?? []);
  const territoryRows = live(territory.data ?? []);

  const orgIds = [...new Set([...assignedRows, ...territoryRows].map((r) => r.org_id))];
  if (orgIds.length === 0) {
    return { property, zip: zip || null, vendors: [] as CoverageVendor[], categories: [] as string[] };
  }

  const { data: orgs, error: orgError } = await db
    .from("vendor_orgs")
    .select(ORG_FIELDS)
    .in("id", orgIds);
  if (orgError) throw orgError;

  const byOrg = new Map((orgs ?? []).map((o) => [o.id, o]));
  const vendors: CoverageVendor[] = [];

  const push = (
    orgId: string,
    source: "property" | "territory",
    coveragePriority: string,
    extras: { excluded?: boolean; exclusionReason?: string | null; travelNote?: string | null },
  ) => {
    const org = byOrg.get(orgId);
    if (!org) return;
    // The home's own row replaces anything the territory said.
    const existing = vendors.findIndex((v) => v.orgId === orgId);
    if (existing >= 0) {
      if (source !== "property") return;
      vendors.splice(existing, 1);
    }
    vendors.push({
      orgId: org.id,
      name: org.display_name,
      status: org.status,
      vendorClass: org.vendor_class,
      markets: org.markets ?? [],
      serviceCategories: org.service_categories ?? [],
      tier: org.tier ?? null,
      pricingNote: org.pricing_note ?? null,
      approvalLimit: org.approval_limit == null ? null : Number(org.approval_limit),
      emergencyAvailable: Boolean(org.emergency_available),
      responseTimeNote: org.response_time_note ?? null,
      contactName: org.primary_contact_name ?? null,
      contactEmail: org.primary_contact_email ?? null,
      contactPhone: org.primary_contact_phone ?? null,
      lastVerifiedAt: org.last_verified_at ?? null,
      source,
      coveragePriority,
      excluded: extras.excluded ?? false,
      exclusionReason: extras.exclusionReason ?? null,
      travelNote: extras.travelNote ?? null,
    });
  };

  for (const row of territoryRows) {
    push(row.org_id, "territory", row.coverage_priority, { travelNote: row.travel_note });
  }
  for (const row of assignedRows) {
    push(row.org_id, "property", row.coverage_priority, {
      excluded: row.excluded,
      exclusionReason: row.exclusion_reason,
      travelNote: row.rate_note,
    });
  }

  const categories = [
    ...new Set([
      ...assignedRows.map((r) => r.service_category),
      ...territoryRows.map((r) => r.service_category),
      ...vendors.flatMap((v) => v.serviceCategories),
    ]),
  ].filter(Boolean);

  return { property, zip: zip || null, vendors, categories };
}
