/**
 * What a Lead may safely inherit from an email.
 *
 * The rule under test throughout: derive only what the message actually says.
 * A guess that looks plausible is worse than an empty field a coordinator
 * fills in, and nothing here may ever prevent the Lead being created.
 */
import { describe, expect, it } from "bun:test";
import {
  companyFromAddress,
  deriveLeadFromEmail,
  extractPhone,
  guessLeadSource,
  plainTextBody,
} from "@/lib/outlook-email";

describe("reading the message body", () => {
  it("keeps the new message and drops the quoted history and markup", () => {
    const html =
      "<p>We need housing for a family of four.</p><br>From: someone\nSent: Tuesday\nold thread";
    expect(plainTextBody(html, "html")).toBe("We need housing for a family of four.");
  });

  it("survives an empty body rather than failing", () => {
    expect(plainTextBody("", "text")).toBe("");
  });
});

describe("contact details", () => {
  it("reads a phone number written the way people write it", () => {
    expect(extractPhone("Call me on 512-555-0134 any time")).toBe("(512) 555-0134");
    expect(extractPhone("+1 (512) 555.0134")).toBe("(512) 555-0134");
  });

  it("does not invent a number out of an order or claim reference", () => {
    expect(extractPhone("Claim 10024 processed on 2026")).toBeNull();
  });

  it("names the organisation only when the domain is one", () => {
    expect(companyFromAddress("adjuster@sedgwick.com")).toBe("Sedgwick");
    expect(companyFromAddress("someone@gmail.com")).toBeNull();
    expect(companyFromAddress(null)).toBeNull();
  });
});

describe("lead source", () => {
  it("classifies only what the email states plainly", () => {
    expect(guessLeadSource({ subject: "Insurance claim housing request" })).toBe("insurance");
    expect(guessLeadSource({ subject: "Relocation for a new hire" })).toBe("relocation");
    expect(
      guessLeadSource({
        fromAddress: "team@keller-williams-austin.com",
        subject: "Client needs a place",
      }),
    ).toBe("realtor");
  });

  it("stays silent when the email does not say", () => {
    expect(
      guessLeadSource({ subject: "Question about your place", body: "Is it available in May?" }),
    ).toBeNull();
  });
});

describe("the derived lead", () => {
  it("carries across what the email gives it", () => {
    const lead = deriveLeadFromEmail({
      subject: "Housing for displaced policyholder",
      body: "Our adjuster needs a 3-bedroom from May 1. Reach me at 512-555-0134.",
      fromName: "Dana Reyes",
      fromAddress: "Dana.Reyes@Sedgwick.com",
    });
    expect(lead.contact_name).toBe("Dana Reyes");
    expect(lead.email).toBe("dana.reyes@sedgwick.com");
    expect(lead.phone).toBe("(512) 555-0134");
    expect(lead.company).toBe("Sedgwick");
    expect(lead.source).toBe("insurance");
    expect(lead.requirements).toContain("3-bedroom");
  });

  it("still produces a usable lead when the email is nearly empty", () => {
    const lead = deriveLeadFromEmail({
      subject: "(no subject)",
      body: "",
      fromAddress: "j.smith@gmail.com",
    });
    expect(lead.contact_name).toBe("j smith");
    expect(lead.source).toBeNull();
    expect(lead.phone).toBeNull();
  });
});
