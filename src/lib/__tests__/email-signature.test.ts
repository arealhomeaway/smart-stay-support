import { describe, expect, it } from "bun:test";
import { withSignature } from "../email-composer";
import { availabilityGreeting } from "../availability-finder";

describe("personal signature", () => {
  it("signs the foot of the message", () => {
    expect(withSignature("Here are your options.", "Emily Jimenez\nA Real Home Away")).toBe(
      "Here are your options.\n\n--\nEmily Jimenez\nA Real Home Away",
    );
  });

  it("never signs the same message twice", () => {
    const once = withSignature("Hello.", "Emily Jimenez");
    expect(withSignature(once, "Emily Jimenez")).toBe(once);
  });

  it("leaves the message alone when the person has no signature yet", () => {
    expect(withSignature("Hello.", "   ")).toBe("Hello.");
    expect(withSignature("Hello.", null)).toBe("Hello.");
  });
});

describe("property options greeting", () => {
  it("thanks the guest and names where and when they asked about", () => {
    const greeting = availabilityGreeting("2026-11-02", "2026-12-02", "  Edmond, OK ");
    expect(greeting).toContain("Thanks so much for reaching out about properties near Edmond, OK");
    expect(greeting).toContain("11/02/2026");
    expect(greeting).toContain("12/02/2026");
  });
});
