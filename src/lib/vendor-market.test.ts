import { describe, expect, it } from "bun:test";
import { vendorMarketFor } from "./vendor-market";
describe("vendorMarketFor", () => {
  it("maps Fort Worth homes to DFW vendors", () => expect(vendorMarketFor("Fort Worth")).toBe("DFW"));
  it("passes unknown markets through", () => expect(vendorMarketFor("Carlton Landing")).toBe("Carlton Landing"));
  it("handles blanks", () => expect(vendorMarketFor(null)).toBeNull());
});
