/**
 * Property enrichment from OwnerRez (server-only, strictly read-only upstream).
 *
 * Scope: the parts of the Property Hub that a *higher-authority* source can
 * answer today — the primary listing photo, the hard property facts
 * (bedrooms / baths / sleeps / check-in / time zone) and the real owner record
 * behind each home.
 *
 * Rules applied here:
 *  - OwnerRez identity fields (name, street address, city/state/postal) are
 *    NEVER rewritten by this pass. Enrichment only fills facts, photo and the
 *    owner relationship.
 *  - Matching is by `ownerrez_property_id` only. Never by property name.
 *  - Owners are de-duplicated on the OwnerRez owner id, so one owner with many
 *    homes is a single record.
 *  - Every field written records provenance (source, source record, as-of).
 *  - No credentials, codes, passwords or secrets are read or stored.
 */

import { ownerRezGet, type OwnerRezListing } from "@/lib/ownerrez.server";
import type { OwnerRezOwner } from "@/lib/owner-directory.server";

export type OwnerRezDetailedListing = OwnerRezListing & {
  owner_id?: number | null;
  external_name?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  max_guests?: number | null;
  living_area?: number | null;
  property_type?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  time_zone?: string | null;
  public_url?: string | null;
  thumbnail_url?: string | null;
  thumbnail_url_medium?: string | null;
  thumbnail_url_large?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type PropertyRow = {
  id: string;
  name: string;
  ownerrez_property_id: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type OwnerRecordDraft = {
  source: "ownerrez";
  source_owner_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  active: boolean;
};

export type PropertyPatch = {
  property_id: string;
  /** Column values to write on `properties`. Identity fields are never here. */
  values: Record<string, string | number | boolean | null>;
  /** OwnerRez owner id this home belongs to, if the listing names one. */
  ownerSourceId: string | null;
  provenance: {
    field_key: string;
    value_source: string;
    source_record_id: string | null;
    as_of: string;
  }[];
};

export type EnrichmentConflict = {
  property_id: string;
  property_name: string;
  field: string;
  detail: string;
};

export type EnrichmentPlan = {
  patches: PropertyPatch[];
  owners: OwnerRecordDraft[];
  conflicts: EnrichmentConflict[];
  counts: {
    audited: number;
    matched: number;
    unmatched: number;
    photos: number;
    photosMissing: number;
    ownersLinked: number;
    ownersMissing: number;
  };
};

function text(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Pure planner — unit-testable with no OwnerRez account. Produces the exact
 * writes and the conflicts that must be reviewed by a human instead.
 */
export function planEnrichment(
  properties: PropertyRow[],
  listings: OwnerRezDetailedListing[],
  owners: OwnerRezOwner[],
  now = new Date(),
): EnrichmentPlan {
  const stamp = now.toISOString();
  const byListing = new Map<string, OwnerRezDetailedListing[]>();
  for (const l of listings) {
    const key = String(l.id);
    byListing.set(key, [...(byListing.get(key) ?? []), l]);
  }
  const ownerById = new Map<string, OwnerRezOwner[]>();
  for (const o of owners) {
    const key = String(o.id);
    ownerById.set(key, [...(ownerById.get(key) ?? []), o]);
  }

  const patches: PropertyPatch[] = [];
  const conflicts: EnrichmentConflict[] = [];
  const ownerDrafts = new Map<string, OwnerRecordDraft>();
  const counts = {
    audited: properties.length,
    matched: 0,
    unmatched: 0,
    photos: 0,
    photosMissing: 0,
    ownersLinked: 0,
    ownersMissing: 0,
  };

  for (const p of properties) {
    if (!p.ownerrez_property_id) {
      counts.unmatched += 1;
      conflicts.push({
        property_id: p.id,
        property_name: p.name,
        field: "ownerrez_property_id",
        detail: "Not linked to an OwnerRez listing — enrichment skipped (never matched on name).",
      });
      continue;
    }
    const candidates = byListing.get(p.ownerrez_property_id) ?? [];
    if (candidates.length === 0) {
      counts.unmatched += 1;
      conflicts.push({
        property_id: p.id,
        property_name: p.name,
        field: "ownerrez_property_id",
        detail: `OwnerRez returned no listing with id ${p.ownerrez_property_id}.`,
      });
      continue;
    }
    if (candidates.length > 1) {
      counts.unmatched += 1;
      conflicts.push({
        property_id: p.id,
        property_name: p.name,
        field: "ownerrez_property_id",
        detail: `More than one OwnerRez listing shares id ${p.ownerrez_property_id}. Left untouched for review.`,
      });
      continue;
    }

    const l = candidates[0]!;
    counts.matched += 1;

    const values: Record<string, string | number | boolean | null> = {};
    const provenance: PropertyPatch["provenance"] = [];
    const put = (column: string, value: string | number | boolean | null, fieldKey = column) => {
      if (value === null) return;
      values[column] = value;
      provenance.push({
        field_key: fieldKey,
        value_source: "ownerrez",
        source_record_id: String(l.id),
        as_of: stamp,
      });
    };

    put("bedrooms", num(l.bedrooms));
    put("bathrooms", num(l.bathrooms));
    put("max_guests", num(l.max_guests));
    put("living_area_sqft", num(l.living_area));
    put("property_type", text(l.property_type));
    put("check_in_time", text(l.check_in));
    put("check_out_time", text(l.check_out));
    put("time_zone", text(l.time_zone));
    put("listing_public_url", text(l.public_url));

    // Geo only when Resolve has none — Google Maps geocoding stays authoritative.
    if (p.latitude == null && num(l.latitude) != null) put("latitude", num(l.latitude));
    if (p.longitude == null && num(l.longitude) != null) put("longitude", num(l.longitude));

    const large = text(l.thumbnail_url_large);
    const medium = text(l.thumbnail_url_medium);
    const thumb = text(l.thumbnail_url);
    const photo = large ?? medium ?? thumb;
    if (photo) {
      counts.photos += 1;
      values["primary_photo_url"] = photo;
      values["primary_photo_medium_url"] = medium ?? photo;
      values["primary_photo_thumb_url"] = thumb ?? medium ?? photo;
      values["primary_photo_source"] = "ownerrez_listing";
      values["primary_photo_synced_at"] = stamp;
      provenance.push({
        field_key: "primary_photo_url",
        value_source: "ownerrez_listing",
        source_record_id: String(l.id),
        as_of: stamp,
      });
    } else {
      counts.photosMissing += 1;
      conflicts.push({
        property_id: p.id,
        property_name: p.name,
        field: "primary_photo_url",
        detail: "The OwnerRez listing has no photo. No placeholder was invented.",
      });
    }

    let ownerSourceId: string | null = null;
    if (l.owner_id == null) {
      counts.ownersMissing += 1;
      conflicts.push({
        property_id: p.id,
        property_name: p.name,
        field: "owner_record_id",
        detail: "The OwnerRez listing names no designated owner.",
      });
    } else {
      const oid = String(l.owner_id);
      const matches = ownerById.get(oid) ?? [];
      if (matches.length === 1) {
        const o = matches[0]!;
        counts.ownersLinked += 1;
        ownerSourceId = oid;
        values["ownerrez_owner_id"] = oid;
        provenance.push({
          field_key: "owner_record_id",
          value_source: "ownerrez_owner",
          source_record_id: oid,
          as_of: stamp,
        });
        if (!ownerDrafts.has(oid)) {
          const addr = (o as { address?: { city?: string; state?: string; postal_code?: string } })
            .address;
          ownerDrafts.set(oid, {
            source: "ownerrez",
            source_owner_id: oid,
            name:
              text(o.name) ?? text([o.first_name, o.last_name].filter(Boolean).join(" ")) ?? null,
            email: text(o.email_address),
            phone: text(o.phone?.number),
            city: text(addr?.city),
            state: text(addr?.state),
            postal_code: text(addr?.postal_code),
            active: o.active !== false,
          });
        }
      } else {
        counts.ownersMissing += 1;
        conflicts.push({
          property_id: p.id,
          property_name: p.name,
          field: "owner_record_id",
          detail:
            matches.length === 0
              ? `The listing names owner ${oid}, but OwnerRez returned no owner record with that id.`
              : `More than one OwnerRez owner record shares id ${oid}. Not linked automatically.`,
        });
      }
    }

    patches.push({ property_id: p.id, values, ownerSourceId, provenance });
  }

  return { patches, owners: [...ownerDrafts.values()], conflicts, counts };
}

/** Reads every OwnerRez listing with the detail fields the Hub consumes. */
export async function listDetailedListings(): Promise<OwnerRezDetailedListing[]> {
  const out: OwnerRezDetailedListing[] = [];
  let offset = 0;
  for (let page = 0; page < 40; page++) {
    const data = await ownerRezGet<{ items?: OwnerRezDetailedListing[] }>("/properties", {
      limit: "50",
      offset: String(offset),
      includeInactive: "true",
    });
    const items = data.items ?? [];
    out.push(...items);
    if (items.length < 50) break;
    offset += 50;
  }
  return out;
}
