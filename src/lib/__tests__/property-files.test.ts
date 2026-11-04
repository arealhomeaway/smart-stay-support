import { describe, expect, it } from "vitest";
import { fileKind, filterFiles, type FileRow } from "@/lib/property-files";

const rows: FileRow[] = [
  { id: "1", name: "HOA covenants", kind: "document", detail: "hoa", createdAt: "2026-01-01", url: null },
  { id: "2", name: "Kitchen", kind: "photo", detail: null, createdAt: "2026-01-02", url: null },
  { id: "3", name: "OneDrive folder", kind: "link", detail: "onedrive", createdAt: "2026-01-03", url: "https://x" },
];

describe("property files tab", () => {
  it("treats images as photos and everything else as documents", () => {
    expect(fileKind({ mime: "image/jpeg" })).toBe("photo");
    expect(fileKind({ filename: "front.HEIC" })).toBe("photo");
    expect(fileKind({ mime: "application/pdf", filename: "lease.pdf" })).toBe("document");
  });
  it("searches by name and by type word", () => {
    expect(filterFiles(rows, "hoa", "all").map((r) => r.id)).toEqual(["1"]);
    expect(filterFiles(rows, "photo", "all").map((r) => r.id)).toEqual(["2"]);
  });
  it("narrows to one type", () => {
    expect(filterFiles(rows, "", "link").map((r) => r.id)).toEqual(["3"]);
  });
});
