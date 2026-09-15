import { expect, it } from "bun:test";
import { parseOwnerMinutes } from "../owner-participation";

it("preserves actual owner-entered minutes without estimates or clamping", () => {
  expect(parseOwnerMinutes("37")).toBe(37);
  expect(parseOwnerMinutes(" 90 ")).toBe(90);
});
it("rejects blank, fractional and out-of-range time instead of inventing a duration", () => {
  for (const value of ["", " ", "0", "-10", "1441", "2.5", "invalid", "Infinity"]) {
    let rejected = false;
    try {
      parseOwnerMinutes(value);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }
});
