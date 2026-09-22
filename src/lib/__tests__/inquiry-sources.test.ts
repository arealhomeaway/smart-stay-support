import { describe, expect, it } from "bun:test";
import { buildSourceQuote, searchSources, type InquirySource } from "../inquiry-sources";
import type { StayQuote } from "../pricing";

const stay: StayQuote = { currency: "USD", nights: 30, basePrice: 180, total: 6000, averageNightly: 200, source: "pricelabs" };

function source(overrides: Partial<InquirySource> = {}): InquirySource {
  return {
    id: "s1", name: "ALE", sourceType: "Relocation Company", corporateHousingExtra: null, discountPercent: null,
    referralPercent: null, referralFee: null, referralRule: null, utilitiesIncluded: null, applicationFee: null,
    cleaningFee: null, securityDeposit: null, petFeePerPet: 250, petFeeNotes: null, petDepositNotes: null,
    paymentDetails: null, bookingDocuments: null, pricingFlags: null, active: true, ...overrides,
  };
}

describe("source quotes", () => {
  it("a blank fee is left out entirely, while zero stays zero", () => {
    const quote = buildSourceQuote(stay, source({ cleaningFee: null, applicationFee: 0 }), 0)!;
    expect(quote.lines).toHaveLength(1);
    expect(quote.total).toBe(6000);
  });

  it("the pet fee is $250 per pet per stay", () => {
    const quote = buildSourceQuote(stay, source(), 2)!;
    expect(quote.total).toBe(6500);
  });

  it("corporate housing extra is charged per month, prorated over 30 days", () => {
    const half: StayQuote = { ...stay, nights: 15, total: 3000 };
    const quote = buildSourceQuote(half, source({ corporateHousingExtra: 500 }), 0)!;
    expect(quote.total).toBe(3250);
  });

  it("a negative discount is flagged rather than applied", () => {
    const quote = buildSourceQuote(stay, source({ discountPercent: -15 }), 0)!;
    expect(quote.total).toBe(6000);
    expect(quote.flags.join(" ")).toContain("not applied");
  });

  it("both a referral percentage and a flat fee with no rule takes the lesser and flags it", () => {
    const quote = buildSourceQuote(stay, source({ referralPercent: 10, referralFee: 400 }), 0)!;
    expect(quote.referralCost).toBe(400);
    expect(quote.flags.join(" ")).toContain("Confirm the rule");
  });

  it("search matches on name or type, and skips sources no longer in use", () => {
    const list = [source(), source({ id: "s2", name: "Sirva", active: false })];
    expect(searchSources(list, "sirva")).toHaveLength(0);
    expect(searchSources(list, "relocation")).toHaveLength(1);
  });
});
