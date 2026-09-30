import { describe, expect, it } from "bun:test";
import { vendorMarketFor } from "./vendor-market";
describe("vendorMarketFor", () => {
  it("maps Fort Worth homes to DFW vendors", () => expect(vendorMarketFor("Fort Worth")).toBe("DFW"));
  it("maps Carlton Landing to Eufaula", () => expect(vendorMarketFor("Carlton Landing")).toBe("Eufaula"));
  it("passes unknown markets through", () => expect(vendorMarketFor("Somewhere")).toBe("Somewhere"));
  it("handles blanks", () => expect(vendorMarketFor(null)).toBeNull());
});
