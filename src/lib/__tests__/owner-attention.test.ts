import { expect, it } from "bun:test";
import { ownerAttention } from "../owner-attention";

it("clears hour-pace warnings at exactly 100 while preserving unfinished property work", () => {
  const row = {
    status: "active",
    goalMet: true,
    variance: -5,
    lastOwnerActivityAt: new Date().toISOString(),
    openTasks: 0,
    daysLeft: 0,
    properties: [],
  };
  expect(ownerAttention(row)).toBe(null);
  expect(ownerAttention({ ...row, goalMet: false })?.rank).toBe(2);
  expect(
    ownerAttention({ ...row, properties: [{ overdue: 1, coverage: "in_progress" }] })?.rank,
  ).toBe(5);
  expect(ownerAttention({ ...row, openTasks: 1, lastOwnerActivityAt: null })?.rank).toBe(3);
});
