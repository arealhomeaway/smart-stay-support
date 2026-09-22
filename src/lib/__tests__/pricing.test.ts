import { describe, expect, it } from "bun:test";
import { buildStayQuote, clientQuoteLine, internalQuoteLine, stayNightDates } from "../pricing";

describe("stay pricing", () => {
  it("counts the nights actually paid for", () => {
    expect(stayNightDates("2026-10-01", "2026-10-04")).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(stayNightDates("2026-10-04", "2026-10-04")).toEqual([]);
  });

  it("totals PriceLabs nightly prices", () => {
    const quote = buildStayQuote("2026-10-01", "2026-10-04", [
      { date: "2026-10-01", price: 170 },
      { date: "2026-10-02", price: 180 },
      { date: "2026-10-03", price: 190 },
    ], 179);
    expect(quote).toEqual({ currency: "USD", nights: 3, basePrice: 179, total: 540, averageNightly: 180, source: "pricelabs" });
    expect(clientQuoteLine(quote!)).toBe("Estimated total for these dates: $540");
    expect(internalQuoteLine(quote!)).toContain("base rate $179/night");
  });

  it("covers missing nights with the standing base price", () => {
    const quote = buildStayQuote("2026-10-01", "2026-10-03", [{ date: "2026-10-01", price: 200 }], 100);
    expect(quote?.total).toBe(300);
    expect(quote?.source).toBe("mixed");
  });

  it("falls back entirely to the base price", () => {
    expect(buildStayQuote("2026-10-01", "2026-10-03", [], 150)?.source).toBe("base");
  });

  it("issues no quote when nothing is known", () => {
    expect(buildStayQuote("2026-10-01", "2026-10-03", [], null)).toBeNull();
    expect(buildStayQuote("2026-10-01", "2026-10-03", [{ date: "2026-10-01", price: 0 }], null)).toBeNull();
  });
});
