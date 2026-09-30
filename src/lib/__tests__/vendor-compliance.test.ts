import { describe, expect, it } from "vitest";
import { daysUntil, itemState, reminderThreshold, vendorCompliance } from "../vendor-compliance";

const gates = [
  { id: "ins", label: "Insurance", expiry_required: true },
  { id: "lic", label: "Licences", expiry_required: true },
  { id: "w9", label: "W-9", expiry_required: false },
];

describe("vendor compliance", () => {
  it("maps days to reminder stages", () => {
    expect(reminderThreshold(31)).toBeNull();
    expect(reminderThreshold(30)).toBe("30_days");
    expect(reminderThreshold(15)).toBe("30_days");
    expect(reminderThreshold(14)).toBe("14_days");
    expect(reminderThreshold(8)).toBe("14_days");
    expect(reminderThreshold(7)).toBe("7_days");
    expect(reminderThreshold(1)).toBe("7_days");
    expect(reminderThreshold(0)).toBe("expiration_day");
    expect(reminderThreshold(-1)).toBeNull();
  });

  it("stays valid on expiration day and expires the day after", () => {
    expect(itemState(0)).toBe("expires_7");
    expect(itemState(-1)).toBe("expired");
    expect(itemState(20)).toBe("expiring_soon");
    expect(itemState(45)).toBe("current");
    expect(daysUntil("2026-10-30", "2026-09-30")).toBe(30);
  });

  it("takes the worst credential and ignores unverified or non-expiring gates", () => {
    const c = vendorCompliance(
      gates,
      [
        { requirement_id: "ins", result: "verified_meets", expires_on: "2026-10-05" },
        { requirement_id: "lic", result: "verified_meets", expires_on: "2027-01-01" },
        { requirement_id: "w9", result: "verified_meets", expires_on: "2026-01-01" },
      ],
      "2026-09-30",
    );
    expect(c.state).toBe("expires_7");
    expect(c.attention.map((i) => i.requirementId)).toEqual(["ins"]);
    expect(vendorCompliance(gates, [{ requirement_id: "ins", result: "not_verified", expires_on: "2020-01-01" }], "2026-09-30").state).toBe("current");
    expect(vendorCompliance(gates, [{ requirement_id: "ins", result: "verified_meets", expires_on: "2026-09-29" }], "2026-09-30").state).toBe("expired");
  });
});
