import { describe, expect, it as test } from "bun:test";
import { inQueue, queueCounts, type QueueInput } from "../owner-opportunity-filters";

const base: QueueInput = { status: "open", viewed: false, needsOwnerAttention: false, lastSpeaker: null, responseTypes: ["documentation"] };

describe("owner Opportunity queues", () => {
  test("zero Opportunities → all zero", () => {
    expect(queueCounts([])).toEqual({ attention: 0, awaiting: 0, feedback: 0, new: 0 });
  });
  test("published, unviewed → New only", () => {
    expect(queueCounts([base])).toEqual({ attention: 0, awaiting: 0, feedback: 0, new: 1 });
  });
  test("viewing clears New without a reply", () => {
    expect(queueCounts([{ ...base, viewed: true }]).new).toBe(0);
  });
  test("staff asks → Awaiting; flag adds Attention without removing Awaiting", () => {
    const o = { ...base, viewed: true, lastSpeaker: "staff" as const, needsOwnerAttention: true };
    expect(queueCounts([o])).toEqual({ attention: 1, awaiting: 1, feedback: 0, new: 0 });
  });
  test("owner replies → Feedback Sent; staff follows up → Awaiting", () => {
    expect(inQueue({ ...base, viewed: true, lastSpeaker: "homeowner" }, "feedback")).toBe(true);
    expect(inQueue({ ...base, viewed: true, lastSpeaker: "homeowner" }, "awaiting")).toBe(false);
    expect(inQueue({ ...base, viewed: true, lastSpeaker: "staff" }, "feedback")).toBe(false);
  });
  test("resolved leaves every queue, even if flagged", () => {
    expect(queueCounts([{ ...base, status: "complete", needsOwnerAttention: true, lastSpeaker: "staff" }])).toEqual({ attention: 0, awaiting: 0, feedback: 0, new: 0 });
  });
  test("viewed with a requested response and no thread → Awaiting", () => {
    expect(inQueue({ ...base, viewed: true, responseTypes: ["feedback"] }, "awaiting")).toBe(true);
  });
});
