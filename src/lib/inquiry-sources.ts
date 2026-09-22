/**
 * Inquiry sources: the companies and portals guests reach us through, each with
 * its own standing fee and referral settings.
 *
 * Pure helpers only. Everything here is arithmetic over values a coordinator can
 * see and edit; no formula text from the original sheet is ever executed, and
 * any adjustment whose basis is not stated is flagged rather than guessed at.
 */

import { formatMoney, type StayQuote } from "./pricing";

export const INQUIRY_SOURCE_TYPES = [
  "Relocation Company",
  "Portal",
  "Private Insurance Adjuster",
  "Individual",
  "Marketing Site",
  "Other",
] as const;

/** House standard: nonrefundable, per pet, per stay. */
export const DEFAULT_PET_FEE_PER_PET = 250;

export type InquirySource = {
  id: string;
  name: string;
  sourceType: string | null;
  /** Blank stays blank: null means "not recorded", 0 means "zero". */
  corporateHousingExtra: number | null;
  discountPercent: number | null;
  referralPercent: number | null;
  referralFee: number | null;
  referralRule: string | null;
  utilitiesIncluded: boolean | null;
  applicationFee: number | null;
  cleaningFee: number | null;
  securityDeposit: number | null;
  petFeePerPet: number;
  petFeeNotes: string | null;
  petDepositNotes: string | null;
  paymentDetails: string | null;
  bookingDocuments: string | null;
  pricingFlags: string | null;
  active: boolean;
};

export type QuoteLine = { label: string; amount: number };

export type SourceQuote = {
  currency: string;
  nights: number;
  sourceName: string;
  lines: QuoteLine[];
  /** What the guest or partner is quoted, before refundable deposits. */
  total: number;
  /** Refundable, listed apart from the total. */
  securityDeposit: number | null;
  /** What we pay the partner out of the stay; internal only. */
  referralCost: number | null;
  referralBasis: string | null;
  netAfterReferral: number | null;
  /** Adjustments we deliberately did not apply, said plainly. */
  flags: string[];
};

function money(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Referral cost per the source's own rule; unclear pairings are flagged, not guessed. */
export function referralCostFor(source: InquirySource, accommodation: number, nights: number) {
  const months = nights / 30;
  const percentCost = money(source.referralPercent) && source.referralPercent > 0
    ? (accommodation * source.referralPercent) / 100 : null;
  const flatCost = money(source.referralFee) && source.referralFee > 0
    ? source.referralFee * months : null;
  const rule = (source.referralRule ?? "").toLowerCase();
  if (percentCost !== null && flatCost !== null) {
    const lesser = /less|lower|whichever is less/.test(rule);
    const cost = lesser ? Math.min(percentCost, flatCost) : Math.min(percentCost, flatCost);
    return {
      cost,
      basis: lesser
        ? `${source.referralRule}`
        : `${source.referralPercent}% or ${formatMoney(source.referralFee!)}/month, lesser applied`,
      unclear: !lesser,
    };
  }
  if (percentCost !== null) return { cost: percentCost, basis: `${source.referralPercent}% of the stay`, unclear: false };
  if (flatCost !== null) return { cost: flatCost, basis: `${formatMoney(source.referralFee!)} per month`, unclear: false };
  return { cost: null, basis: null, unclear: false };
}

/**
 * Applies one source's settings to a property's PriceLabs stay estimate.
 * Pets are the guest's travelling animals; the pet fee is per pet, per stay.
 */
export function buildSourceQuote(
  quote: StayQuote | null,
  source: InquirySource | null,
  pets: number,
): SourceQuote | null {
  if (!quote || !source) return null;
  const flags: string[] = [];
  const lines: QuoteLine[] = [];
  let accommodation = quote.total;

  if (money(source.discountPercent) && source.discountPercent > 0) {
    const discount = Math.round((accommodation * source.discountPercent) / 100);
    accommodation -= discount;
    lines.push({ label: `Nightly rates (${quote.nights} nights)`, amount: quote.total });
    lines.push({ label: `${source.name} discount (${source.discountPercent}%)`, amount: -discount });
  } else {
    lines.push({ label: `Nightly rates (${quote.nights} nights)`, amount: quote.total });
    if (money(source.discountPercent) && source.discountPercent < 0)
      flags.push(`Discount recorded as ${source.discountPercent}% — a negative discount has no stated basis, so it is not applied.`);
  }

  if (money(source.cleaningFee) && source.cleaningFee > 0) lines.push({ label: "Cleaning fee", amount: source.cleaningFee });
  if (money(source.applicationFee) && source.applicationFee > 0) lines.push({ label: "Application fee", amount: source.applicationFee });
  const petCount = Math.max(0, Math.trunc(pets));
  if (petCount > 0 && source.petFeePerPet > 0) {
    lines.push({
      label: `Pet fee (${petCount} pet${petCount === 1 ? "" : "s"} × ${formatMoney(source.petFeePerPet, quote.currency)}, nonrefundable)`,
      amount: source.petFeePerPet * petCount,
    });
  }
  if (money(source.corporateHousingExtra) && source.corporateHousingExtra > 0)
    flags.push(`Corporate Housing Extra ${formatMoney(source.corporateHousingExtra, quote.currency)} is recorded without a stated basis (per night or per stay), so it is not in this estimate.`);

  const total = Math.round(lines.reduce((sum, line) => sum + line.amount, 0));
  const referral = referralCostFor(source, accommodation, quote.nights);
  if (referral.unclear)
    flags.push("This source has both a referral percentage and a flat referral fee with no rule recorded; the lesser is shown. Confirm the rule.");
  for (const line of (source.pricingFlags ?? "").split("\n").map((entry) => entry.trim()).filter(Boolean))
    if (!flags.includes(line)) flags.push(line);

  return {
    currency: quote.currency,
    nights: quote.nights,
    sourceName: source.name,
    lines,
    total,
    securityDeposit: money(source.securityDeposit) ? source.securityDeposit : null,
    referralCost: referral.cost === null ? null : Math.round(referral.cost),
    referralBasis: referral.basis,
    netAfterReferral: referral.cost === null ? null : Math.round(total - referral.cost),
    flags,
  };
}

/** Client-facing wording: the quoted total, plus refundable deposit when there is one. */
export function clientSourceQuoteLine(quote: SourceQuote) {
  const parts = [`Estimated total for these dates: ${formatMoney(quote.total, quote.currency)}`];
  if (quote.securityDeposit !== null && quote.securityDeposit > 0)
    parts.push(`Refundable security deposit ${formatMoney(quote.securityDeposit, quote.currency)}`);
  return parts.join(" · ");
}

/** Search a coordinator can type into: name or type. */
export function searchSources(sources: InquirySource[], term: string) {
  const needle = term.trim().toLowerCase();
  const active = sources.filter((source) => source.active);
  if (!needle) return active;
  return active.filter((source) =>
    source.name.toLowerCase().includes(needle) || (source.sourceType ?? "").toLowerCase().includes(needle));
}
