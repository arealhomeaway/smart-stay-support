import { expect, it } from "bun:test";
import { automaticOpportunityView } from "../owner-automatic-opportunity";
import type { ReviewRow } from "../owner-participation.server";

const source = {
  id: "review",
  ticket_id: "ticket",
  propertyIds: ["property"],
  title: "Authored owner title",
  recommendation: "Authored owner instructions",
  business_question: "Authored owner question",
  owner_response: "My retained response",
  status: "answered",
  staff_context: "PRIVATE STAFF CONTEXT",
  future_staff_column: "PRIVATE FUTURE FIELD",
  evidence: "PRIVATE TICKET EVIDENCE",
  impact: "PRIVATE TICKET IMPACT",
  outcome: "PRIVATE TICKET OUTCOME",
  attachment_path: "PRIVATE ATTACHMENT",
  photos: [{ url: "PRIVATE PHOTO" }],
} as unknown as ReviewRow;

it("excludes staff-only and future fields from manual opportunities without changing saved evidence", () => {
  const view = automaticOpportunityView(source);
  const payload = JSON.stringify(view);
  expect(payload.includes("PRIVATE STAFF CONTEXT")).toBe(false);
  expect(payload.includes("PRIVATE FUTURE FIELD")).toBe(false);
  expect(view.title).toBe(source.title);
  expect(view.recommendation).toBe(source.recommendation);
  expect(view.evidence).toBe(source.evidence);
  expect(view.owner_response).toBe("My retained response");
  expect(source.staff_context).toBe("PRIVATE STAFF CONTEXT");
  view.propertyIds.push("another");
  expect(source.propertyIds.length).toBe(1);
});

it("uses safe automatic Ticket context without inheriting raw operational content or assets", () => {
  const view = automaticOpportunityView({
    ...source,
    auto_ticket: true,
    title: "PRIVATE TITLE",
    recommendation: "PRIVATE DESCRIPTION",
    business_question: "PRIVATE QUESTION",
  });
  expect(JSON.stringify(view).includes("PRIVATE")).toBe(false);
  expect(view.id).toBe("review");
  expect(view.ticket_id).toBe("ticket");
  expect(view.propertyIds).toEqual(["property"]);
  expect(view.owner_response).toBe("My retained response");
  expect(view.recommendation).toContain("Authority not yet confirmed");
});
