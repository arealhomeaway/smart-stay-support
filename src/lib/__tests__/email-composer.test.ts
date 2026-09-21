import { describe, expect, it } from "bun:test";
import { draftFieldProblems, missingOwnerDetails, sendGate } from "@/lib/email-composer";

describe("owner and property details", () => {
  const full = {
    property: "Sunset Cottage",
    property_address: "12 Sunset Rd",
    owner_name: "Dana Reed",
  };

  it("lets a complete homeowner message through", () => {
    expect(missingOwnerDetails(full, "owner")).toEqual([]);
  });

  it("flags a missing homeowner name and address", () => {
    const gaps = missingOwnerDetails({ property: "Sunset Cottage" }, "owner");
    expect(gaps).toHaveLength(2);
    expect(gaps.join(" ")).toContain("homeowner name");
    expect(gaps.join(" ")).toContain("address");
  });

  it("flags a record with no home on it, whoever it goes to", () => {
    expect(missingOwnerDetails({ ...full, property: "  " }, "vendor")[0]).toContain("no home");
  });

  it("does not ask a vendor message for homeowner details", () => {
    expect(missingOwnerDetails({ property: "Sunset Cottage" }, "vendor")).toEqual([]);
  });
});

describe("before Send is allowed", () => {
  const good = { to: "dana@example.com", subject: "Your home", body: "Hello Dana, all set." };

  it("clears a finished draft", () => {
    const f = draftFieldProblems(good);
    expect([f.to, f.subject, f.body]).toEqual([null, null, null]);
    expect(f.unfilled).toEqual([]);
  });

  it("names a bad address, an empty subject and an empty message", () => {
    const f = draftFieldProblems({ to: "dana", subject: "", body: "" });
    expect(f.to).toContain("valid email");
    expect(f.subject).toContain("subject");
    expect(f.body).toContain("Write");
  });

  it("stops a draft with blanks the template left behind", () => {
    const f = draftFieldProblems({
      ...good,
      body: "Hello {{owner_name}}, your home {{property}} is ready.",
    });
    expect(f.body).toContain("blanks");
    expect(f.unfilled).toEqual(["owner_name", "property"]);
  });
});

describe("the Send button", () => {
  const owner = {
    property: "Sunset Cottage",
    property_address: "12 Sunset Rd",
    owner_name: "Dana Reed",
  };
  const draft = {
    to: "dana@example.com",
    subject: "Your home is ready",
    body: "Hello Dana, the work is finished.",
  };
  const gate = (over: Partial<typeof draft> = {}, values = owner) =>
    sendGate({ ...draft, ...over }, values, "owner");

  it("is on when the message and the home details are complete", () => {
    const g = gate();
    expect(g.canSend).toBe(true);
    expect(g.blockers).toEqual([]);
  });

  it("is off for an invalid address", () => {
    for (const bad of ["", "   ", "dana", "dana@", "@example.com", "dana@example", "a b@c.com"]) {
      const g = gate({ to: bad });
      expect(g.canSend).toBe(false);
      expect(g.fields.to).toContain("valid email address");
    }
  });

  it("is on for ordinary addresses", () => {
    for (const ok of ["dana@example.com", " Dana.Reed+home@mail.co.uk "]) {
      expect(gate({ to: ok }).canSend).toBe(true);
    }
  });

  it("is off for an empty or too-thin message", () => {
    for (const bad of ["", "   ", "thanks"]) {
      const g = gate({ body: bad });
      expect(g.canSend).toBe(false);
      expect(g.fields.body).toBe("Write the message.");
    }
  });

  it("is off for a missing subject", () => {
    const g = gate({ subject: " " });
    expect(g.canSend).toBe(false);
    expect(g.fields.subject).toContain("subject");
  });

  it("is off while merge tags are still unresolved, in either box", () => {
    const g = gate({
      subject: "About {{property}}",
      body: "Hello {{owner_name}}, we visited {{ property }} today.",
    });
    expect(g.canSend).toBe(false);
    expect(g.fields.subject).toContain("blanks");
    expect(g.fields.body).toContain("blanks");
    expect(g.fields.unfilled.sort()).toEqual(["owner_name", "property"]);
  });

  it("is off when the home or homeowner details are missing", () => {
    const g = gate({}, { property: "Sunset Cottage" });
    expect(g.canSend).toBe(false);
    expect(g.blockers.join(" ")).toContain("homeowner name");
    const noHome = gate({}, {});
    expect(noHome.blockers[0]).toContain("no home");
  });

  it("does not hold a vendor message to homeowner details", () => {
    expect(sendGate(draft, { property: "Sunset Cottage" }, "vendor").canSend).toBe(true);
  });
});
