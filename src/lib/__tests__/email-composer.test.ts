import { describe, expect, it } from "bun:test";
import { draftFieldProblems, missingOwnerDetails } from "@/lib/email-composer";

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
