import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PREFERRED_CONTACT_CHOICES, preferredContactLabel, preferredContactValue } from "@/lib/vendors";
import { PENDING_REFUSAL } from "@/lib/onboarding-home.server";
import { UPLOAD_FOLDERS, uploadCategory } from "@/lib/home-details";

describe("vendor preferred contact", () => {
  it("offers exactly Call, Text, Email, Not set", () => {
    expect(PREFERRED_CONTACT_CHOICES.map((c) => c.label)).toEqual(["Call", "Text", "Email", "Not set"]);
  });
  it("Not set saves NULL; the three methods save as call, text, email", () => {
    expect(preferredContactValue("not_set")).toBeNull();
    expect(preferredContactValue("call")).toBe("call");
    expect(preferredContactValue("text")).toBe("text");
    expect(preferredContactValue("email")).toBe("email");
    expect(preferredContactValue("fax")).toBeNull();
  });
  it("a NULL value shows as Not set when the form opens", () => {
    expect(preferredContactLabel(null)).toBe("Not set");
    expect(preferredContactLabel("text")).toBe("Text");
  });
});

describe("Task uploads never land in Other", () => {
  it("the Task drawer folder list is the five Files folders, never Other", () => {
    expect(UPLOAD_FOLDERS.map((f) => f.label)).toEqual(["Design", "Agreements", "Estimates and invoices", "Photos", "Inspections"]);
    for (const f of UPLOAD_FOLDERS) expect(uploadCategory(f.id)).not.toBeNull();
    expect(uploadCategory("other")).toBeNull();
  });
  it("the upload carries the folder itself and has no second filing step", () => {
    const s = readFileSync("src/components/AttachmentsPanel.tsx", "utf8");
    expect(s.includes("moveHomeFileFn")).toBe(false);
    expect(s.includes("Its folder could not be set")).toBe(false);
    expect(s.includes("folderPick ? (folderRef.current ? uploadCategory(folderRef.current) : null)")).toBe(true);
  });
});

describe("screen messages", () => {
  it("the refusal reads in plain words", () => {
    expect(PENDING_REFUSAL).toBe("This can't be saved right now. Nothing was changed. Tell your Admin.");
  });
});
