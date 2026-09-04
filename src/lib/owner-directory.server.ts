/**
 * General property -> designated primary owner directory (server-only).
 *
 * Source of truth for beta: OwnerRez. The connected account was verified to
 * expose both `/v2/owners` (the owner contact records) and an `owner_id` on
 * every `/v2/properties` row naming the DESIGNATED primary owner of that
 * listing — so no Notion import is needed and nothing is inferred from the
 * Active Owner Program.
 *
 * Strictly read-only against OwnerRez. The normalized result is stored in
 * `public.property_owner_contacts` so ticket screens never depend on a live
 * outside request, and every row records its source, source identifier and
 * last synchronization time.
 */

import { ownerRezGet, type OwnerRezListing } from "@/lib/ownerrez.server";

export type OwnerRezOwner = {
  id: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email_address?: string | null;
  phone?: { number?: string | null } | null;
  active?: boolean;
};

type ListingWithOwner = OwnerRezListing & { owner_id?: number | null };

async function pageAll<T>(path: string, extra?: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  let offset = 0;
  for (let page = 0; page < 40; page++) {
    const data = await ownerRezGet<{ items?: T[] }>(path, {
      limit: "50",
      offset: String(offset),
      ...(extra ?? {}),
    });
    const items = data.items ?? [];
    out.push(...items);
    if (items.length < 50) break;
    offset += 50;
  }
  return out;
}

export async function listOwnerRezOwners(): Promise<OwnerRezOwner[]> {
  return pageAll<OwnerRezOwner>("/owners");
}

export async function listOwnerRezListingsWithOwner(): Promise<ListingWithOwner[]> {
  return pageAll<ListingWithOwner>("/properties", { includeInactive: "true" });
}

export type OwnerSyncCounts = {
  properties: number;
  matched: number;
  unmatched: number;
  ambiguous: number;
  source_error: number;
  not_linked: number;
};

export type OwnerSyncRow = {
  property_id: string;
  owner_name: string | null;
  owner_email: string | null;
  owner_phone: string | null;
  source: string;
  source_id: string | null;
  match_status: "matched" | "ambiguous" | "unmatched" | "source_error";
  candidate_count: number;
  detail: string | null;
  synced_at: string;
};

/**
 * Pure resolution, so it is unit-testable without an OwnerRez account.
 * Each property is classified explicitly — a home with no mapped owner is
 * never conflated with a home whose lookup failed, and a listing that maps
 * to more than one candidate owner is left `ambiguous` rather than guessed.
 */
export function resolvePrimaryOwners(
  properties: { id: string; ownerrez_property_id: string | null }[],
  listings: ListingWithOwner[],
  owners: OwnerRezOwner[],
  now = new Date(),
): { rows: OwnerSyncRow[]; counts: OwnerSyncCounts } {
  const listingById = new Map<string, ListingWithOwner[]>();
  for (const l of listings) {
    const key = String(l.id);
    listingById.set(key, [...(listingById.get(key) ?? []), l]);
  }
  const ownerById = new Map<string, OwnerRezOwner[]>();
  for (const o of owners) {
    const key = String(o.id);
    ownerById.set(key, [...(ownerById.get(key) ?? []), o]);
  }

  const rows: OwnerSyncRow[] = [];
  const counts: OwnerSyncCounts = {
    properties: properties.length,
    matched: 0,
    unmatched: 0,
    ambiguous: 0,
    source_error: 0,
    not_linked: 0,
  };
  const stamp = now.toISOString();

  for (const p of properties) {
    if (!p.ownerrez_property_id) {
      counts.not_linked += 1;
      counts.unmatched += 1;
      rows.push({
        property_id: p.id,
        owner_name: null,
        owner_email: null,
        owner_phone: null,
        source: "ownerrez",
        source_id: null,
        match_status: "unmatched",
        candidate_count: 0,
        detail:
          "This home is not linked to an OwnerRez listing, so no primary owner could be resolved.",
        synced_at: stamp,
      });
      continue;
    }

    const matches = listingById.get(p.ownerrez_property_id) ?? [];
    if (matches.length === 0) {
      counts.unmatched += 1;
      rows.push({
        property_id: p.id,
        owner_name: null,
        owner_email: null,
        owner_phone: null,
        source: "ownerrez",
        source_id: null,
        match_status: "unmatched",
        candidate_count: 0,
        detail: `OwnerRez has no listing with id ${p.ownerrez_property_id}.`,
        synced_at: stamp,
      });
      continue;
    }

    const ownerIds = Array.from(
      new Set(
        matches
          .map((m) => (m.owner_id == null ? null : String(m.owner_id)))
          .filter(Boolean) as string[],
      ),
    );
    if (ownerIds.length === 0) {
      counts.unmatched += 1;
      rows.push({
        property_id: p.id,
        owner_name: null,
        owner_email: null,
        owner_phone: null,
        source: "ownerrez",
        source_id: null,
        match_status: "unmatched",
        candidate_count: 0,
        detail: "The OwnerRez listing names no designated owner.",
        synced_at: stamp,
      });
      continue;
    }
    if (ownerIds.length > 1) {
      counts.ambiguous += 1;
      rows.push({
        property_id: p.id,
        owner_name: null,
        owner_email: null,
        owner_phone: null,
        source: "ownerrez",
        source_id: null,
        match_status: "ambiguous",
        candidate_count: ownerIds.length,
        detail: `More than one OwnerRez listing shares this id and they name different owners (${ownerIds.join(", ")}). Not picked automatically.`,
        synced_at: stamp,
      });
      continue;
    }

    const ownerId = ownerIds[0]!;
    const candidates = ownerById.get(ownerId) ?? [];
    if (candidates.length === 0) {
      counts.unmatched += 1;
      rows.push({
        property_id: p.id,
        owner_name: null,
        owner_email: null,
        owner_phone: null,
        source: "ownerrez",
        source_id: ownerId,
        match_status: "unmatched",
        candidate_count: 0,
        detail: `The listing names owner ${ownerId}, but no owner record with that id was returned.`,
        synced_at: stamp,
      });
      continue;
    }
    if (candidates.length > 1) {
      counts.ambiguous += 1;
      rows.push({
        property_id: p.id,
        owner_name: null,
        owner_email: null,
        owner_phone: null,
        source: "ownerrez",
        source_id: ownerId,
        match_status: "ambiguous",
        candidate_count: candidates.length,
        detail: "More than one owner record shares this id. Not picked automatically.",
        synced_at: stamp,
      });
      continue;
    }

    const o = candidates[0]!;
    counts.matched += 1;
    rows.push({
      property_id: p.id,
      // OwnerRez returns either a composed `name` or the parts; accept both.
      owner_name:
        o.name?.trim() || [o.first_name, o.last_name].filter(Boolean).join(" ").trim() || null,
      owner_email: o.email_address?.trim() || null,
      owner_phone: o.phone?.number?.trim() || null,
      source: "ownerrez",
      source_id: ownerId,
      match_status: "matched",
      candidate_count: 1,
      detail: null,
      synced_at: stamp,
    });
  }

  return { rows, counts };
}
