import { expect, it } from "bun:test";
import { ownerTicketCosts } from "../owner-ticket-costs";

it("uses actual costs only, retaining explicit zero and never substituting a quote", () => {
  expect(
    ownerTicketCosts([{ id: "work", quote_amount: 650, final_cost: null }]).recordedAmount,
  ).toBe(null);
  const zero = ownerTicketCosts([{ id: "work", quote_amount: 650, final_cost: 0 }]);
  expect(zero.recordedAmount).toBe(0);
  expect(zero.complete).toBe(true);
  expect(ownerTicketCosts([]).complete).toBe(false);
});
it("labels incomplete actual costs as partial and counts each Work Order once", () => {
  const first = { id: "one", quote_amount: 100, final_cost: 10.1 };
  const costs = ownerTicketCosts([
    first,
    first,
    { id: "two", final_cost: 20.2 },
    { id: "three", final_cost: null },
  ]);
  expect(costs.recordedAmount).toBe(30.3);
  expect(costs.workOrderCount).toBe(3);
  expect(costs.complete).toBe(false);
  expect(costs.summary).toContain("2 of 3 Work Orders");
});
it("flags invalid or conflicting costs without presenting a misleading total", () => {
  for (const value of [-1, NaN, Infinity]) {
    const costs = ownerTicketCosts([{ id: "bad", final_cost: value }]);
    expect(costs.recordedAmount).toBe(null);
    expect(costs.needsReview).toBe(true);
  }
  expect(
    ownerTicketCosts([
      { id: "same", final_cost: 10 },
      { id: "same", final_cost: 20 },
    ]).recordedAmount,
  ).toBe(null);
});
it("calls out overruns without changing quotes or inventing a new approval decision", () => {
  const record = { id: "work", quote_amount: 150, final_cost: 900 };
  const costs = ownerTicketCosts([record]);
  expect(costs.recordedAmount).toBe(900);
  expect(costs.needsReview).toBe(true);
  expect(costs.summary).toContain("does not authorize the overrun");
  expect(record.quote_amount).toBe(150);
});
