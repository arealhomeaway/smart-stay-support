import { expect, it } from "bun:test";
import {
  OWNER_ACTION_TYPES,
  LEGACY_OWNER_ACTION_TYPES,
  SUPPORTED_OWNER_ACTION_TYPES,
  actionLabel,
  actionSentence,
  opportunityDecisionPath,
} from "../owner-opportunity";

it("offers exactly the eight locked Welcome Packet request categories", () => {
  expect(OWNER_ACTION_TYPES.map(actionLabel)).toEqual([
    "Approve only",
    "Review & comment",
    "Review & decide",
    "Provide information",
    "Attend & respond",
    "Action or payment required",
    "Information only",
    "Research & recommend",
  ]);
  for (const category of OWNER_ACTION_TYPES) expect(actionSentence(category).length > 0).toBe(true);
});

it("preserves legacy categories while distinguishing information from approval gates", () => {
  for (const category of LEGACY_OWNER_ACTION_TYPES)
    expect(SUPPORTED_OWNER_ACTION_TYPES.includes(category)).toBe(true);
  expect(actionLabel("document")).toBe("Document");
  expect(opportunityDecisionPath("information_only")).toBe("inform");
  expect(opportunityDecisionPath("approve_only")).toBe("approve");
  expect(opportunityDecisionPath("approve")).toBe("approve");
  expect(opportunityDecisionPath("review_decide")).toBe("consult");
  expect(actionSentence("information_only")).toContain("time you actually spend");
});
