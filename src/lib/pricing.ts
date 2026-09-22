/**
 * Stay price estimates for the Availability Finder.
 *
 * Pure helpers only: no network. PriceLabs supplies the nightly prices and the
 * standing base price for each listing; when a night has no PriceLabs price we
 * fall back to that standing base price, and when nothing is known we issue no
 * quote at all rather than guessing.
 */

export type NightlyPrice = { date: string; price: number };

export type QuoteSource = "pricelabs" | "mixed" | "base";

export type StayQuote = {
  currency: string;
  nights: number;
  /** Standing base price per night from PriceLabs, when the listing has one. */
  basePrice: number | null;
  total: number;
  averageNightly: number;
  source: QuoteSource;
};

/** Wording required on every client-facing price. */
export const PRICE_ESTIMATE_NOTE =
  "Estimate covers nightly rates only. Cleaning, fees, and taxes are added at booking.";

function dayNumber(value: string) {
  return Date.parse(`${value}T00:00:00Z`);
}

/** The nights actually paid for: check-in through the night before check-out. */
export function stayNightDates(checkIn: string, checkOut: string): string[] {
  const start = dayNumber(checkIn);
  const end = dayNumber(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const dates: string[] = [];
  for (let day = start; day < end && dates.length < 400; day += 86400000) {
    dates.push(new Date(day).toISOString().slice(0, 10));
  }
  return dates;
}

function usable(price: unknown): price is number {
  return typeof price === "number" && Number.isFinite(price) && price > 0;
}

/**
 * Builds the quote for one home. Nights PriceLabs does not price are covered by
 * the standing base price; with neither, there is no quote.
 */
export function buildStayQuote(
  checkIn: string,
  checkOut: string,
  nightly: NightlyPrice[],
  basePrice: number | null,
  currency = "USD",
): StayQuote | null {
  const dates = stayNightDates(checkIn, checkOut);
  if (!dates.length) return null;
  const byDate = new Map(nightly.filter((row) => usable(row.price)).map((row) => [row.date, row.price]));
  const base = usable(basePrice) ? basePrice : null;
  let total = 0;
  let priced = 0;
  for (const date of dates) {
    const nightPrice = byDate.get(date);
    if (usable(nightPrice)) { total += nightPrice; priced += 1; continue; }
    if (base === null) return null;
    total += base;
  }
  const source: QuoteSource = priced === dates.length ? "pricelabs" : priced === 0 ? "base" : "mixed";
  return {
    currency,
    nights: dates.length,
    basePrice: base,
    total: Math.round(total),
    averageNightly: Math.round(total / dates.length),
    source,
  };
}

export function formatMoney(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/**
 * Coordinator wording: the stay total and the average night only.
 * The standing base rate stays an internal number and is never shown here.
 */
export function internalQuoteLine(quote: StayQuote) {
  return [
    `Estimated stay total ${formatMoney(quote.total, quote.currency)}`,
    `${formatMoney(quote.averageNightly, quote.currency)} average per night`,
  ].join(" · ");
}

/** How a quote was sourced, said plainly for the coordinator. */
export function quoteSourceNote(quote: StayQuote) {
  if (quote.source === "pricelabs") return "Priced from PriceLabs for these dates.";
  if (quote.source === "mixed") return "Some nights use the standing base rate; PriceLabs had no price for them.";
  return "Standing base rate used; PriceLabs had no dated prices for this home.";
}

/** Client-facing wording: one figure only. */
export function clientQuoteLine(quote: StayQuote) {
  return `Estimated total for these dates: ${formatMoney(quote.total, quote.currency)}`;
}
