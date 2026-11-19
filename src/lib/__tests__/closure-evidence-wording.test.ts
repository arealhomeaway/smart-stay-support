import { describe, expect, it as test } from "bun:test";
import { scopedClosureEvidence } from "@/lib/closure-evidence";
import { requiresPhotoOrFile } from "@/lib/evidence-requirements";

// Immediate maintenance closing text, Nov 19.
const TEXT = "What was repaired or replaced; vendor name; smoke detector, CO alarm, security device all checked working";

describe("Immediate maintenance closing text", () => {
  test("non-safety ticket shows only the repair and the vendor", () => {
    expect(scopedClosureEvidence(TEXT, { category: "maintenance", workTypeName: "Immediate maintenance", text: "Porch railing loose" }))
      .toBe("What was repaired or replaced and vendor name");
  });
  test("safety ticket shows the full text", () => {
    expect(scopedClosureEvidence(TEXT, { category: "maintenance", workTypeName: "Immediate maintenance", text: "Smoke alarm chirping" }))
      .toBe(TEXT);
  });
  test("never asks for a photo or file", () => {
    expect(requiresPhotoOrFile(TEXT)).toBe(false);
  });
});
