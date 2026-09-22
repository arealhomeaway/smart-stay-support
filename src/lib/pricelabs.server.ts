/**
 * PriceLabs Customer API access (server-only).
 *
 * Auth is the X-API-Key header. Listings are keyed by the PMS listing id, which
 * for ARHA is the OwnerRez property id (default pms: ownerrez).
 * A PriceLabs outage never blocks an availability search — it only costs the price.
 */
import { buildStayQuote, type NightlyPrice, type StayQuote } from "./pricing";

const BASE = "https://api.pricelabs.co/v1";
const PMS = "ownerrez";

function apiKey() {
  const key = process.env["PRICELABS_API_KEY"];
  if (!key) throw new Error("PriceLabs API key is not configured.");
  return key;
}

async function priceLabsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "X-API-Key": apiKey(), "Content-Type": "application/json", Accept: "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`PriceLabs ${path} failed [${response.status}]: ${body.slice(0, 300)}`);
    throw new Error(`PriceLabs request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

export type PriceLabsListing = { id: string; pms: string; base: number | null; currency: string | null };

/** The standing base price per listing — this is ARHA's fallback price. */
export async function priceLabsListings(): Promise<Map<string, PriceLabsListing>> {
  const payload = await priceLabsFetch<{ listings?: PriceLabsListing[] }>("/listings", { method: "GET" });
  const out = new Map<string, PriceLabsListing>();
  for (const listing of payload.listings ?? []) {
    if (!listing?.id || listing.pms !== PMS) continue;
    out.set(String(listing.id), {
      id: String(listing.id), pms: listing.pms,
      base: typeof listing.base === "number" ? listing.base : null,
      currency: listing.currency ?? "USD",
    });
  }
  return out;
}

type PriceRow = { date?: string; price?: number };
type PriceListing = { id?: string | number; currency?: string | null; data?: PriceRow[] | null };

/** Dated nightly prices for up to a handful of listings per request. */
export async function priceLabsNightly(
  listingIds: string[], dateFrom: string, dateTo: string,
): Promise<Map<string, { currency: string; nightly: NightlyPrice[] }>> {
  const out = new Map<string, { currency: string; nightly: NightlyPrice[] }>();
  for (let offset = 0; offset < listingIds.length; offset += 10) {
    const batch = listingIds.slice(offset, offset + 10);
    const payload = await priceLabsFetch<PriceListing[]>("/listing_prices", {
      method: "POST",
      body: JSON.stringify({ listings: batch.map((id) => ({ id, pms: PMS, dateFrom, dateTo })) }),
    });
    for (const listing of Array.isArray(payload) ? payload : []) {
      if (listing?.id === undefined) continue;
      out.set(String(listing.id), {
        currency: listing.currency ?? "USD",
        nightly: (listing.data ?? [])
          .filter((row): row is { date: string; price: number } => typeof row?.date === "string" && typeof row?.price === "number")
          .map((row) => ({ date: row.date, price: row.price })),
      });
    }
  }
  return out;
}

export type QuoteRead = { quote: StayQuote | null; unavailableReason: string | null };

/**
 * Quotes a stay for many homes at once, keyed by the Resolve property id.
 * Failures degrade: dated prices → standing base price → no quote.
 */
export async function stayQuotesFor(
  entries: { id: string; ownerRezPropertyId: string }[],
  checkIn: string, checkOut: string,
): Promise<Map<string, QuoteRead>> {
  const out = new Map<string, QuoteRead>();
  if (!entries.length) return out;
  const lastNight = new Date(Date.parse(`${checkOut}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

  const listings = await priceLabsListings().catch((error) => {
    console.error("PriceLabs listings unavailable:", error);
    return null;
  });
  const nightly = await priceLabsNightly(entries.map((entry) => entry.ownerRezPropertyId), checkIn, lastNight)
    .catch((error) => {
      console.error("PriceLabs prices unavailable:", error);
      return new Map<string, { currency: string; nightly: NightlyPrice[] }>();
    });

  for (const entry of entries) {
    const listing = listings?.get(entry.ownerRezPropertyId) ?? null;
    const dated = nightly.get(entry.ownerRezPropertyId) ?? null;
    if (!listing && !dated) {
      out.set(entry.id, {
        quote: null,
        unavailableReason: listings === null
          ? "PriceLabs could not be reached, so no price estimate is shown."
          : "This home is not mapped in PriceLabs, so no price estimate is available.",
      });
      continue;
    }
    const quote = buildStayQuote(
      checkIn, checkOut, dated?.nightly ?? [], listing?.base ?? null,
      dated?.currency ?? listing?.currency ?? "USD",
    );
    out.set(entry.id, {
      quote,
      unavailableReason: quote ? null : "PriceLabs has no price on file for these dates.",
    });
  }
  return out;
}
