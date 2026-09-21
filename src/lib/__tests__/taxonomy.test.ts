import { describe, expect, it } from "bun:test";
import {
  CATEGORY_CODES,
  TRADES,
  categoryForTrade,
  categoryHint,
  categoryLabel,
  fieldGuidance,
  normalizeCategory,
  normalizeTrade,
  tradeLabel,
} from "@/lib/taxonomy";

describe("operational taxonomy", () => {
  it("resolves historic free-text work order categories onto trades", () => {
    expect(normalizeTrade("Handyman")?.value).toBe("handyman");
    expect(normalizeTrade("maintenance")?.value).toBe("handyman");
    expect(normalizeTrade("Roof")?.value).toBe("roofing");
    expect(normalizeTrade("Pool & spa")?.value).toBe("pool_spa");
    expect(normalizeTrade("nonsense")).toBeNull();
  });

  it("rolls every trade up to a known category", () => {
    for (const trade of TRADES) {
      expect(CATEGORY_CODES).toContain(trade.category);
      expect(categoryForTrade(trade.label)).toBe(trade.category);
    }
  });

  it("normalizes ticket, claim and vendor spellings onto one code", () => {
    expect(normalizeCategory("Maintenance")).toBe("maintenance");
    expect(normalizeCategory("general")).toBe("maintenance");
    expect(normalizeCategory("Locks & access")).toBe("access");
    expect(normalizeCategory("")).toBeNull();
  });

  it("labels and hints unknown values without inventing a category", () => {
    expect(categoryLabel("safety")).toBe("Safety devices");
    expect(categoryLabel(null)).toBe("Not categorized");
    expect(categoryHint("cleaning")).toContain("Turnovers");
    expect(tradeLabel("plumbing")).toBe("Plumbing");
  });

  it("gives one line of guidance per shared field", () => {
    expect(fieldGuidance("ticket.category")).toBeTruthy();
    expect(fieldGuidance("workOrder.trade")).toBeTruthy();
    expect(fieldGuidance("claim.category")).toBeTruthy();
    expect(fieldGuidance("nope.field")).toBeNull();
  });
});
