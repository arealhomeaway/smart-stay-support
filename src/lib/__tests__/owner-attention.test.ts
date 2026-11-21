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

it("no quiet-week alarm until the program is 7 days old, from the later of created and activated", async () => {
  const { programSince } = await import("../owner-attention");
  const day = 86_400_000;
  const ago = (d: number) => new Date(Date.now() - d * day).toISOString();
  const row = { status: "active", goalMet: false, variance: 0, lastOwnerActivityAt: null, openTasks: 35, daysLeft: 40, properties: [] };
  expect(ownerAttention({ ...row, programSince: ago(0) })).toBe(null);
  expect(ownerAttention({ ...row, programSince: ago(6) })).toBe(null);
  expect(ownerAttention({ ...row, programSince: ago(7) })?.reason).toBe("No activity for 7 days with open tasks");
  expect(programSince(ago(30), ago(2))).toBe(programSince(ago(2), ago(30)));
  expect(ownerAttention({ ...row, programSince: programSince(ago(30), ago(2)) })).toBe(null);
  // Other rules are unchanged on a new program.
  expect(ownerAttention({ ...row, variance: -10, programSince: ago(0) })?.rank).toBe(1);
});
