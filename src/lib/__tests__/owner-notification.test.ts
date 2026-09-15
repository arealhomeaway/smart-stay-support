import { expect, it } from "bun:test";
import { ownerNotificationText } from "../owner-notification";

const legacy = {
  kind: "ticket_opened",
  ticket_id: "ticket",
  review_id: null,
  title: "PRIVATE guest name",
  body: "PRIVATE credentials and internal notes",
};
it("excludes legacy internal text from Ticket and review notifications, including deleted Ticket links", () => {
  for (const kind of [
    "ticket_opened",
    "ticket_p1",
    "ticket_resolved",
    "review_ready",
    "unexpected",
  ]) {
    const result = ownerNotificationText({ ...legacy, kind });
    expect(JSON.stringify(result).includes("PRIVATE")).toBe(false);
    expect(result.body).toContain("owner portal");
  }
  expect(
    JSON.stringify(ownerNotificationText({ ...legacy, ticket_id: null })).includes("PRIVATE"),
  ).toBe(false);
  expect(
    JSON.stringify(
      ownerNotificationText({
        ...legacy,
        kind: "unexpected",
        ticket_id: null,
        review_id: "review",
      }),
    ).includes("PRIVATE"),
  ).toBe(false);
});
it("retains urgency and resolution without claiming review requires approval", () => {
  expect(ownerNotificationText({ ...legacy, kind: "ticket_p1" }).title).toContain("Urgent");
  expect(ownerNotificationText({ ...legacy, kind: "ticket_resolved" }).title).toContain("resolved");
  expect(ownerNotificationText({ ...legacy, kind: "review_ready" }).body).toContain(
    "whether an owner response is required",
  );
});
