/**
 * Property entry (server-only).
 *
 * Two supported ways a home enters Resolve, both producing the SAME canonical
 * `properties` row:
 *   1. Import from OwnerRez — search, preview, duplicate-check on the OwnerRez
 *      property ID, then create one property.
 *   2. Manual add — the minimum information needed to establish the home. The
 *      OwnerRez ID is optional and can be reconciled later onto the same row.
 *
 * Creating a property NEVER starts onboarding. The Onboarding Project is a
 * separate, deliberate action.
 *
 * Nothing here writes to OwnerRez. OwnerRez is read-only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export async function assertPropertyStaff(supabase: Client, userId: string) {
  const { data, error } = await supabase.rpc("is_staff", { _user_id: userId });
  if (error) throw new Error("Could not verify your access level.");
  if (!data) throw new Error("Only the internal team can add properties.");
}

export type IntakeMatch = {
  id: string;
  name: string;
  address: string | null;
  lifecycleStatus: string;
  ownerRezId: string | null;
  isDemo: boolean;
};

export type OwnerRezCandidate = {
  listingId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  /** Already in Resolve on the OwnerRez ID — importing is blocked. */
  existing: IntakeMatch | null;
  /** Same name/address but no OwnerRez ID yet — offer to link instead. */
  likely: IntakeMatch | null;
};

function norm(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function addressOf(p: {
  address_line1?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
}) {
  const line = [p.address_line1, p.unit].filter(Boolean).join(" ");
  const rest = [p.city, [p.state, p.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [line, rest].filter(Boolean).join(", ") || null;
}

function toMatch(p: {
  id: string;
  name: string;
  address_line1: string | null;
  unit: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  lifecycle_status: string;
  ownerrez_property_id: string | null;
  is_demo: boolean;
}): IntakeMatch {
  return {
    id: p.id,
    name: p.name,
    address: addressOf(p),
    lifecycleStatus: p.lifecycle_status,
    ownerRezId: p.ownerrez_property_id,
    isDemo: p.is_demo,
  };
}

const PROPERTY_COLUMNS =
  "id, name, address_line1, unit, city, state, postal_code, lifecycle_status, ownerrez_property_id, is_demo";

async function loadResolveProperties(supabase: Client) {
  const { data, error } = await supabase
    .from("properties")
    .select(PROPERTY_COLUMNS)
    .is("archived_at", null);
  if (error) throw error;
  return data ?? [];
}

/**
 * OwnerRez listings, annotated with what Resolve already knows. Read-only:
 * this never creates or mutates anything in OwnerRez or in Resolve.
 */
export async function searchOwnerRezCandidates(
  supabase: Client,
  query: string,
): Promise<{ ok: true; items: OwnerRezCandidate[] } | { ok: false; error: string }> {
  const { listListings, OwnerRezError } = await import("./ownerrez.server");
  let listings;
  try {
    listings = await listListings();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof OwnerRezError ? err.message : "Could not reach OwnerRez.",
    };
  }

  const rows = await loadResolveProperties(supabase);
  const byOwnerRez = new Map(
    rows.filter((r) => r.ownerrez_property_id).map((r) => [String(r.ownerrez_property_id), r] as const),
  );
  const q = norm(query);

  const items = listings
    .map((l): OwnerRezCandidate => {
      const listingId = String(l.id);
      const existing = byOwnerRez.get(listingId) ?? null;
      const street = norm(l.address?.street1);
      const likely =
        existing
          ? null
          : (rows.find(
              (r) =>
                !r.ownerrez_property_id &&
                (norm(r.name) === norm(l.name) || (street.length > 4 && norm(r.address_line1) === street)),
            ) ?? null);
      return {
        listingId,
        name: l.name,
        address: l.address?.street1 ?? null,
        city: l.address?.city ?? null,
        state: l.address?.state ?? null,
        postalCode: l.address?.postal_code ?? l.address?.zip ?? null,
        existing: existing ? toMatch(existing) : null,
        likely: likely ? toMatch(likely) : null,
      };
    })
    .filter((c) =>
      !q
        ? true
        : [c.name, c.address, c.city, c.state, c.postalCode, c.listingId]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 60);

  return { ok: true, items };
}

export type ImportResult =
  | { status: "duplicate"; property: IntakeMatch }
  | { status: "linked"; property: IntakeMatch }
  | { status: "created"; property: IntakeMatch };

/**
 * Creates ONE canonical property from an OwnerRez listing, or links the
 * listing onto an existing property. Never starts onboarding.
 */
export async function importOwnerRezProperty(
  supabase: Client,
  userId: string,
  input: { listingId: string; linkToPropertyId?: string | null; isDemo?: boolean },
): Promise<ImportResult> {
  const { listListings } = await import("./ownerrez.server");
  const listing = (await listListings()).find((l) => String(l.id) === input.listingId);
  if (!listing) throw new Error("That OwnerRez listing is no longer available.");

  const rows = await loadResolveProperties(supabase);
  const dupe = rows.find((r) => String(r.ownerrez_property_id ?? "") === input.listingId);
  if (dupe) return { status: "duplicate", property: toMatch(dupe) };

  const now = new Date().toISOString();

  if (input.linkToPropertyId) {
    const target = rows.find((r) => r.id === input.linkToPropertyId);
    if (!target) throw new Error("That Resolve property could not be found.");
    if (target.ownerrez_property_id && target.ownerrez_property_id !== input.listingId) {
      throw new Error("That property is already linked to a different OwnerRez listing.");
    }
    const { error } = await supabase
      .from("properties")
      .update({ ownerrez_property_id: input.listingId, ownerrez_synced_at: now })
      .eq("id", target.id);
    if (error) throw error;
    return { status: "linked", property: { ...toMatch(target), ownerRezId: input.listingId } };
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({
      name: listing.name,
      address_line1: listing.address?.street1 ?? null,
      unit: listing.address?.street2 ?? null,
      city: listing.address?.city ?? null,
      state: listing.address?.state ?? null,
      postal_code: listing.address?.postal_code ?? listing.address?.zip ?? null,
      ownerrez_property_id: input.listingId,
      ownerrez_synced_at: now,
      is_demo: input.isDemo ?? false,
      created_by: userId,
    })
    .select(PROPERTY_COLUMNS)
    .single();
  if (error) throw error;
  return { status: "created", property: toMatch(data) };
}

export type ManualPropertyInput = {
  name: string;
  addressLine1: string;
  unit?: string | null;
  city: string;
  state: string;
  postalCode: string;
  market?: string | null;
  ownerRecordId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  ownerRezPropertyId?: string | null;
  isDemo?: boolean;
};

/**
 * Manual creation of the canonical property. If the supplied OwnerRez ID is
 * already on a property, that property is returned instead of a duplicate.
 */
export async function createPropertyManually(
  supabase: Client,
  userId: string,
  input: ManualPropertyInput,
): Promise<ImportResult> {
  const rows = await loadResolveProperties(supabase);
  const orId = input.ownerRezPropertyId?.trim() || null;
  if (orId) {
    const dupe = rows.find((r) => String(r.ownerrez_property_id ?? "") === orId);
    if (dupe) return { status: "duplicate", property: toMatch(dupe) };
  }

  let ownerRecordId = input.ownerRecordId ?? null;
  if (!ownerRecordId && input.ownerName?.trim()) {
    const { data: owner, error: ownerError } = await supabase
      .from("property_owners")
      .insert({
        name: input.ownerName.trim(),
        email: input.ownerEmail?.trim() || null,
        source: "manual",
        source_owner_id: `manual:${crypto.randomUUID()}`,
      })
      .select("id")
      .single();
    if (ownerError) throw ownerError;
    ownerRecordId = owner.id;
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({
      name: input.name.trim(),
      address_line1: input.addressLine1.trim(),
      unit: input.unit?.trim() || null,
      city: input.city.trim(),
      state: input.state.trim(),
      postal_code: input.postalCode.trim(),
      market: input.market?.trim() || null,
      owner_record_id: ownerRecordId,
      ownerrez_property_id: orId,
      ownerrez_synced_at: orId ? new Date().toISOString() : null,
      is_demo: input.isDemo ?? false,
      created_by: userId,
    })
    .select(PROPERTY_COLUMNS)
    .single();
  if (error) throw error;
  return { status: "created", property: toMatch(data) };
}

/** Reconcile an OwnerRez ID onto an existing property rather than duplicating it. */
export async function linkOwnerRezToProperty(
  supabase: Client,
  input: { propertyId: string; listingId: string },
): Promise<ImportResult> {
  const rows = await loadResolveProperties(supabase);
  const dupe = rows.find(
    (r) => String(r.ownerrez_property_id ?? "") === input.listingId && r.id !== input.propertyId,
  );
  if (dupe) return { status: "duplicate", property: toMatch(dupe) };

  const target = rows.find((r) => r.id === input.propertyId);
  if (!target) throw new Error("That Resolve property could not be found.");
  const { error } = await supabase
    .from("properties")
    .update({ ownerrez_property_id: input.listingId, ownerrez_synced_at: new Date().toISOString() })
    .eq("id", input.propertyId);
  if (error) throw error;
  return { status: "linked", property: { ...toMatch(target), ownerRezId: input.listingId } };
}
