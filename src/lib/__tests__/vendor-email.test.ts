import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { buildVendorWorkOrderEmail, pickVendorEmail, vendorEmailOffered, vendorEmailProblems, VENDOR_EMAIL_EVENT } from "@/lib/vendor-email";

describe("when Email work order to vendor shows", () => {
  it("shows for an accepted vendor with no Breezeway mapping", () => {
    expect(vendorEmailOffered({ hasAcceptedVendor: true, vendorBreezewayPersonId: null, homeAllowedForBreezeway: true })).toBe(true);
  });
  it("shows when the home is not allowed for Breezeway sending", () => {
    expect(vendorEmailOffered({ hasAcceptedVendor: true, vendorBreezewayPersonId: 42, homeAllowedForBreezeway: false })).toBe(true);
  });
  it("hides when Breezeway can reach the vendor", () => {
    expect(vendorEmailOffered({ hasAcceptedVendor: true, vendorBreezewayPersonId: 42, homeAllowedForBreezeway: true })).toBe(false);
  });
  it("hides with no accepted vendor", () => {
    expect(vendorEmailOffered({ hasAcceptedVendor: false, vendorBreezewayPersonId: null, homeAllowedForBreezeway: true })).toBe(false);
  });
  it("picks the Work Order inbox, then primary, then contacts, else none", () => {
    expect(pickVendorEmail({ work_order_email: "wo@v.com", primary_contact_email: "p@v.com" })).toBe("wo@v.com");
    expect(pickVendorEmail({ work_order_email: "bad", contacts: [null, "c@v.com"] })).toBe("c@v.com");
    expect(pickVendorEmail({})).toBeNull();
  });
});

describe("email content", () => {
  const mail = buildVendorWorkOrderEmail({
    vendorName: "Ace Plumbing", address: "1399 Foxtail Ln, Austin, TX", title: "Fix kitchen leak", scope: "Leak under sink",
    scheduledFor: "2026-11-10T15:00:00Z", timeWindow: "9 to 11 am", photoLinks: [], senderName: "Romeo",
  });
  it("includes home, work, Central date and window", () => {
    expect(mail.body).toContain("1399 Foxtail Ln");
    expect(mail.body).toContain("Leak under sink");
    expect(mail.body).toContain("November 10");
    expect(mail.body).toContain("9:00 AM Central");
    expect(mail.body).toContain("9 to 11 am");
  });
  it("has no codes, guest or money details and passes the guard", () => {
    expect(vendorEmailProblems(mail.body, { guestNames: ["Jordan Smith"] })).toEqual([]);
  });
  it("blocks access codes, guest names and owner money details", () => {
    expect(vendorEmailProblems("Door code is 4821").length).toBe(1);
    expect(vendorEmailProblems("Guest Jordan Smith is home", { guestNames: ["Jordan Smith"] })).toEqual(["Remove the guest's name."]);
    expect(vendorEmailProblems("Owner payout was low").length).toBe(1);
  });
});

describe("send path", () => {
  const src = readFileSync("src/lib/vendor-email.functions.ts", "utf8");
  it("uses the shared staff email path and records a Work Order event", () => {
    expect(src).toContain('await import("./email.server")');
    expect(src).toContain('from("work_order_events").insert');
    expect(VENDOR_EMAIL_EVENT).toBe("sent_to_vendor_email");
  });
  it("never calls Breezeway task creation", () => {
    expect(src.includes("createOutboundTask")).toBe(false);
    expect(src.includes("breezeway-outbound")).toBe(false);
  });
  it("records the event only after a real send", () => {
    expect(src.indexOf('status !== "sent"') < src.indexOf('from("work_order_events").insert')).toBe(true);
  });
});

describe("vendor email contact line", () => {
  it("names the sender and never a made-up phone number", async () => {
    const { buildVendorWorkOrderEmail } = await import("@/lib/vendor-email");
    const base = { vendorName: "Joe", address: "1 Main St", title: "Fix sink", scope: null, scheduledFor: null, timeWindow: null, photoLinks: [] } as never;
    const named = buildVendorWorkOrderEmail({ ...(base as object), senderName: "Kati Hand" } as never).body;
    expect(named.includes("please contact Kati Hand at A Real Home Away by replying to this email")).toBe(true);
    expect(/\d{3}[-. )]\d{3}[-. ]\d{4}/.test(named)).toBe(false);
    const anon = buildVendorWorkOrderEmail({ ...(base as object), senderName: null } as never).body;
    expect(anon.includes("the A Real Home Away team member who sent this email")).toBe(true);
  });
});
