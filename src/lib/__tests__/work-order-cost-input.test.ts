import { expect, it } from "bun:test";
import { parseWorkOrderCost, editWorkOrderCostDraft } from "../work-order-cost-input";
it("preserves explicit zero and exact costs while keeping blanks unknown", () => {
  expect(parseWorkOrderCost("")).toBe(null);
  expect(parseWorkOrderCost(" 0 ")).toBe(0);
  expect(parseWorkOrderCost("150.25")).toBe(150.25);
  expect(parseWorkOrderCost(".50")).toBe(0.5);
});
it("rejects invalid costs instead of clearing or silently rounding them", () => {
  for (const value of ["bad", "NaN", "Infinity", "-1", "1.001", "10000000000"]) {
    let denied = false;
    try {
      parseWorkOrderCost(value);
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);
  }
});

it("keeps the original cost version and all viewed values after a background refresh", () => {
  const order = {
    updated_at: "version-one",
    quote_amount: 150,
    second_quote_amount: null,
    final_cost: null,
    scope: "Original work",
  };
  const first = editWorkOrderCostDraft({}, order, "final_cost", "140");
  const next = editWorkOrderCostDraft(
    first,
    { ...order, updated_at: "version-two", quote_amount: 999 },
    "cost_reason",
    "Reviewed invoice",
  );
  expect(next["cost_version"]).toBe("version-one");
  expect(next["quote_amount"]).toBe("150");
  expect(next["final_cost"]).toBe("140");
});
