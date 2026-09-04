/**
 * Geocoding + job map data (server-only).
 *
 * Addresses are geocoded once through the Google Maps gateway and cached on
 * the property row, so opening the map is a plain database read. Geocoding is
 * metered, so the batch is capped and only ever touches homes that are missing
 * coordinates or whose address changed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { OPEN_STATUSES } from "@/lib/tickets";
import type { MapPin } from "@/lib/geo";

type Client = SupabaseClient<Database>;

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

/** Hard cap per run so a stray click can't burn through the Maps quota. */
export const GEOCODE_BATCH_LIMIT = 60;

export type PropertyAddress = {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export function addressLine(p: PropertyAddress) {
  return [p.address_line1, p.city, p.state, p.postal_code]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(", ");
}

type GeocodeHit = { lat: number; lng: number; formatted: string };

async function geocodeOne(address: string): Promise<GeocodeHit | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Maps isn't connected yet. Link it under Connectors and try again.");
  }

  const res = await fetch(
    `${GATEWAY_URL}/maps/api/geocode/json?address=${encodeURIComponent(address)}`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
      },
    },
  );

  if (res.status === 403) {
    const details: Array<{ reason?: string }> =
      ((await res.json().catch(() => null)) as any)?.error?.details ?? [];
    const reason = details.find((d) => d.reason)?.reason;
    if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
      throw new Error(
        'The Google Maps server key is referrer-restricted. In Google Cloud Console set that key\'s application restrictions to "None" or "IP addresses".',
      );
    }
    if (reason === "API_KEY_SERVICE_BLOCKED") {
      throw new Error(
        "The Google Maps server key doesn't allow the Geocoding API. Add it to that key's allowed-APIs list in Google Cloud Console.",
      );
    }
    throw new Error("Google Maps denied the lookup (403). Check the server key's restrictions.");
  }

  if (!res.ok) {
    const body = await res.text();
    console.error(`Geocode request failed [${res.status}]: ${body}`);
    throw new Error(`Google Maps lookup failed [${res.status}].`);
  }

  const json = (await res.json()) as {
    status: string;
    results?: Array<{
      formatted_address: string;
      geometry: { location: { lat: number; lng: number } };
    }>;
  };

  if (json.status === "ZERO_RESULTS") return null;
  if (json.status !== "OK") {
    console.error(`Geocode returned ${json.status} for "${address}"`);
    if (json.status === "OVER_QUERY_LIMIT")
      throw new Error("Google Maps quota reached. Try again later.");
    return null;
  }

  const hit = json.results?.[0];
  if (!hit) return null;
  return {
    lat: hit.geometry.location.lat,
    lng: hit.geometry.location.lng,
    formatted: hit.formatted_address,
  };
}

/**
 * Geocodes homes that don't have a pin yet (or every home when forced).
 * Returns a plain summary for the UI.
 */
export async function geocodeProperties(supabase: Client, opts: { force?: boolean } = {}) {
  let query = supabase
    .from("properties")
    .select("id, name, address_line1, city, state, postal_code")
    .eq("active", true)
    .order("name")
    .limit(GEOCODE_BATCH_LIMIT);

  if (!opts.force) query = query.is("latitude", null);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as PropertyAddress[];
  let located = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const address = addressLine(row);
    if (!address) {
      skipped += 1;
      await supabase
        .from("properties")
        .update({ geocode_status: "missing_address", geocoded_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    const hit = await geocodeOne(address);
    if (!hit) {
      failed += 1;
      await supabase
        .from("properties")
        .update({ geocode_status: "not_found", geocoded_at: new Date().toISOString() })
        .eq("id", row.id);
      continue;
    }

    located += 1;
    const { error: updateError } = await supabase
      .from("properties")
      .update({
        latitude: hit.lat,
        longitude: hit.lng,
        formatted_address: hit.formatted,
        geocode_status: "ok",
        geocoded_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updateError) throw updateError;
  }

  return {
    attempted: rows.length,
    located,
    skipped,
    failed,
    capped: rows.length === GEOCODE_BATCH_LIMIT,
  };
}

/** Every pinned home plus its open work, for the dispatch map. */
export async function loadJobMap(supabase: Client) {
  const [{ data: props, error: propError }, { data: tickets, error: ticketError }] =
    await Promise.all([
      supabase
        .from("properties")
        .select(
          "id, name, formatted_address, address_line1, city, state, postal_code, latitude, longitude",
        )
        .eq("active", true)
        .not("latitude", "is", null),
      supabase
        .from("tickets")
        .select("id, ref, title, priority, status, due_at, property_id, vendor_name, vendor_status")
        .in("status", OPEN_STATUSES)
        .eq("is_demo", false)
        .is("archived_at", null)
        .not("property_id", "is", null),
    ]);
  if (propError) throw propError;
  if (ticketError) throw ticketError;

  const byProperty = new Map<string, MapPin["openJobs"]>();
  for (const t of tickets ?? []) {
    const list = byProperty.get(t.property_id as string) ?? [];
    list.push({
      id: t.id,
      ref: t.ref,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueAt: t.due_at,
      vendorName: t.vendor_name,
      vendorStatus: t.vendor_status,
    });
    byProperty.set(t.property_id as string, list);
  }

  const pins: MapPin[] = (props ?? []).map((p) => ({
    propertyId: p.id,
    name: p.name,
    address:
      p.formatted_address ??
      addressLine({
        id: p.id,
        name: p.name,
        address_line1: p.address_line1,
        city: p.city,
        state: p.state,
        postal_code: p.postal_code,
      }),
    lat: p.latitude as number,
    lng: p.longitude as number,
    openJobs: byProperty.get(p.id) ?? [],
  }));

  const { count: unpinned } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("active", true)
    .is("latitude", null);

  return { pins, unpinned: unpinned ?? 0 };
}
