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

import type { IntakeMatch, IntakeResult, OwnerRezCandidate } from "./property-intake";

export type { IntakeMatch, IntakeResult, OwnerRezCandidate };

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
  const rest = [p.city, [p.state, p.postal_code].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
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
): Promise<{ ok: true; items: OwnerRezCandidate[]; total: number; truncated: boolean } | { ok: false; error: string }> {
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
    rows
      .filter((r) => r.ownerrez_property_id)
      .map((r) => [String(r.ownerrez_property_id), r] as const),
  );
  const q = norm(query);

  const all = listings
    .map((l): OwnerRezCandidate => {
      const listingId = String(l.id);
      const existing = byOwnerRez.get(listingId) ?? null;
      const street = norm(l.address?.street1);
      const likely = existing
        ? null
        : (rows.find(
            (r) =>
              !r.ownerrez_property_id &&
              (norm(r.name) === norm(l.name) ||
                (street.length > 4 && norm(r.address_line1) === street)),
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
    .sort((a, b) => a.name.localeCompare(b.name));
  const { filterListings } = await import("./property-intake");
  const publicNames = new Map(listings.map((l) => [String(l.id), l.public_name ?? null] as const));
  const found = filterListings(
    all,
    (c) => [c.name, publicNames.get(c.listingId), c.address, c.city, c.postalCode, c.listingId],
    query,
  );

  return { ok: true, items: found.items, total: found.total, truncated: found.truncated };
}

/**
 * Creates ONE canonical property from an OwnerRez listing, or links the
 * listing onto an existing property. Never starts onboarding.
 */
export async function importOwnerRezProperty(
  supabase: Client,
  userId: string,
  input: {
    listingId: string;
    linkToPropertyId?: string | null;
    isDemo?: boolean;
    milestones?: PropertyMilestones | undefined;
    /** Typed in the enrollment modal when OwnerRez has no owner on file. */
    owner?: OwnerDetails | undefined;
  },
): Promise<IntakeResult> {
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

  // Enrollment needs an owner record to exist, otherwise the Active Owner
  // switch has nobody to enrol. Prefer OwnerRez's owner; fall back to what
  // the person typed in the modal.
  const ownerRecordId = await resolveOwnerRecord(supabase, {
    fromOwnerRez: await ownerRezOwner(input.listingId),
    typed: input.owner,
  });

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
      owner_record_id: ownerRecordId,
      // A property existing is not onboarding, acceptance or Live.
      lifecycle_status: "not_onboarded",
      is_demo: input.isDemo ?? false,
      created_by: userId,
      ...milestoneColumns(input.milestones),
    })
    .select(PROPERTY_COLUMNS)
    .single();
  if (error) throw error;
  return { status: "created", property: toMatch(data) };
}

/* ------------------------------------------------------------------- owners */

/** Owner details typed into the enrollment modal. */
export type OwnerDetails = {
  name?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
};

/**
 * The owner OwnerRez has on file for a listing, if any. Read-only, and never
 * fatal: a home can be created while OwnerRez is unreachable.
 */
export async function ownerRezOwner(
  listingId: string,
): Promise<(OwnerDetails & { sourceId: string }) | null> {
  try {
    const { propertyDetail, ownerRezGet } = await import("./ownerrez.server");
    const detail = (await propertyDetail(listingId)) as { owner_id?: number | string | null };
    const ownerId = detail?.owner_id;
    if (!ownerId) return null;
    const owner = await ownerRezGet<{
      first_name?: string;
      last_name?: string;
      email_address?: string;
      email?: string;
      phone?: string;
      home_phone?: string;
      cell_phone?: string;
    }>(`/owners/${encodeURIComponent(String(ownerId))}`);
    const name = [owner.first_name, owner.last_name].filter(Boolean).join(" ").trim();
    return {
      sourceId: String(ownerId),
      name: name || null,
      email: owner.email_address ?? owner.email ?? null,
      phone: owner.cell_phone ?? owner.phone ?? owner.home_phone ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * One owner record per real owner: an OwnerRez owner is matched on its source
 * ID so re-importing a second home does not create a second owner.
 */
export async function resolveOwnerRecord(
  supabase: Client,
  input: {
    fromOwnerRez?: (OwnerDetails & { sourceId: string }) | null;
    typed?: OwnerDetails | undefined;
  },
): Promise<string | null> {
  const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  const or = input.fromOwnerRez ?? null;
  const typed = input.typed ?? {};

  if (or) {
    const sourceOwnerId = `ownerrez:${or.sourceId}`;
    const existing = await supabase
      .from("property_owners")
      .select("id")
      .eq("source_owner_id", sourceOwnerId)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data.id;
    const { data, error } = await supabase
      .from("property_owners")
      .insert({
        source: "ownerrez",
        source_owner_id: sourceOwnerId,
        name: clean(typed.name) ?? clean(or.name),
        email: clean(typed.email) ?? clean(or.email),
        phone: clean(typed.phone) ?? clean(or.phone),
        active: true,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  if (!clean(typed.name) && !clean(typed.email)) return null;
  const { data, error } = await supabase
    .from("property_owners")
    .insert({
      source: "manual",
      source_owner_id: `manual:${crypto.randomUUID()}`,
      name: clean(typed.name),
      email: clean(typed.email),
      phone: clean(typed.phone),
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}


/**
 * The dates the onboarding plan schedules itself from. Collected when the home
 * is created so the plan lands with real deadlines instead of a blank column
 * somebody has to fill in task by task later.
 */
export type PropertyMilestones = {
  plannedClosingOn?: string | null | undefined;
  actualClosingOn?: string | null | undefined;
  accessOn?: string | null | undefined;
};

function milestoneColumns(m: PropertyMilestones | undefined) {
  if (!m) return {};
  const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    planned_closing_on: clean(m.plannedClosingOn),
    actual_closing_on: clean(m.actualClosingOn),
    actual_access_on: clean(m.accessOn),
  };
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
  ownerPhone?: string | null;

  ownerRezPropertyId?: string | null;
  isDemo?: boolean;
  milestones?: PropertyMilestones | undefined;
};

/**
 * Manual creation of the canonical property. If the supplied OwnerRez ID is
 * already on a property, that property is returned instead of a duplicate.
 */
export async function createPropertyManually(
  supabase: Client,
  userId: string,
  input: ManualPropertyInput,
): Promise<IntakeResult> {
  const rows = await loadResolveProperties(supabase);
  const orId = input.ownerRezPropertyId?.trim() || null;
  if (orId) {
    const dupe = rows.find((r) => String(r.ownerrez_property_id ?? "") === orId);
    if (dupe) return { status: "duplicate", property: toMatch(dupe) };
  }

  let ownerRecordId = input.ownerRecordId ?? null;
  if (!ownerRecordId) {
    ownerRecordId = await resolveOwnerRecord(supabase, {
      fromOwnerRez: orId ? await ownerRezOwner(orId) : null,
      typed: { name: input.ownerName, email: input.ownerEmail, phone: input.ownerPhone },
    });
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
      // A property existing is not onboarding, acceptance or Live.
      lifecycle_status: "not_onboarded",
      is_demo: input.isDemo ?? false,
      created_by: userId,
      ...milestoneColumns(input.milestones),
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
): Promise<IntakeResult> {
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
