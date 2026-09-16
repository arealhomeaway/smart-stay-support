import { expect, it } from "bun:test";
import {
  captureOpportunityWithdrawal,
  mayWithdrawOpportunity,
  type WithdrawalOpportunity,
} from "../owner-opportunity-withdrawal";

const original: WithdrawalOpportunity = {
  id: "review",
  updated_at: "2026-09-16T01:00:00Z",
  title: "Review a proposed layout",
  recommendation: "Compare the available layouts.",
  status: "awaiting_owner",
  auto_ticket: false,
  ticket_id: null,
  responded_at: null,
};

it("retains the reviewed opportunity version and explanation across a background refresh", () => {
  const displayed = { ...original };
  const draft = captureOpportunityWithdrawal(displayed, "The layout work was cancelled.");
  displayed.updated_at = "2026-09-16T02:00:00Z";
  displayed.title = "Layout decision requested";
  displayed.recommendation = "Choose the final layout.";
  expect(draft.expectedUpdatedAt).toBe(original.updated_at);
  expect(draft.title).toBe(original.title);
  expect(draft.recommendation).toBe(original.recommendation);
  expect(draft.reason).toBe("The layout work was cancelled.");
  const explicitlyReviewed = captureOpportunityWithdrawal(displayed, draft.reason);
  expect(explicitlyReviewed.expectedUpdatedAt).toBe(displayed.updated_at);
  expect(explicitlyReviewed.reason).toBe(draft.reason);
});

it("keeps every Ticket-linked opportunity and answered history out of manual withdrawal", () => {
  expect(mayWithdrawOpportunity(original)).toBe(true);
  for (const change of [
    { auto_ticket: true },
    { ticket_id: "legacy-ticket" },
    { status: "answered" },
    { status: "closed" },
    { status: "returned", responded_at: "2026-09-16T01:30:00Z" },
  ]) {
    expect(mayWithdrawOpportunity({ ...original, ...change })).toBe(false);
  }
});
