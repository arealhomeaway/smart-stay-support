import { describe, expect, it } from "bun:test";
import { missingOwnerDetails } from "@/lib/email-composer";

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
