import { describe, expect, it } from "bun:test";
import {
  DEFAULT_OWNER_EMAIL_COPY,
  ownerEmailVariantFor,
  readOwnerEmailCopy,
  renderOwnerEmail,
} from "../owner-email-copy";

describe("homeowner email wording", () => {
  it("falls back to the shipped defaults when nothing is stored", () => {
    expect(readOwnerEmailCopy(null)).toEqual(DEFAULT_OWNER_EMAIL_COPY);
  });

  it("keeps a usable subject and button even when the director blanks them", () => {
    const config = readOwnerEmailCopy({ alert: { subject: "   ", actionLabel: "" } });
    expect(config.alert.subject).toBe(DEFAULT_OWNER_EMAIL_COPY.alert.subject);
    expect(config.alert.actionLabel).toBe(DEFAULT_OWNER_EMAIL_COPY.alert.actionLabel);
  });

  it("fills the homeowner's first name and the alert title", () => {
    const rendered = renderOwnerEmail(
      { ...DEFAULT_OWNER_EMAIL_COPY.dispatch, subject: "{title} for {first_name}" },
      { title: "Design plan ready", body: "Detail written by Resolve.", ownerName: "Victor Alvarez" },
    );
    expect(rendered.subject).toBe("Design plan ready for Victor");
    expect(rendered.body).toContain("Hi Victor,");
    expect(rendered.body).toContain("Detail written by Resolve.");
  });

  it("uses the dispatch wording for work sent to an Active Owner", () => {
    expect(ownerEmailVariantFor("review_ready")).toBe("dispatch");
    expect(ownerEmailVariantFor("ticket_p1")).toBe("alert");
  });
});
