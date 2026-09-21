import { describe, expect, it } from "bun:test";
import {
  completionFor,
  documentState,
  isLegacyLink,
  isRetirable,
  retireReason,
  sortByUrgency,
  type DocInput,
} from "@/lib/document-completion";

const TODAY = new Date("2026-03-01T12:00:00Z");

const doc = (over: Partial<DocInput> = {}): DocInput => ({
  id: "d1",
  title: "Certificate of insurance",
  kindCode: "insurance",
  expiresOn: null,
  storagePath: "vendor/d1.pdf",
  externalUrl: null,
  createdAt: "2026-01-01T00:00:00Z",
  ...over,
});

describe("document state", () => {
  it("a file with nothing behind it is unusable", () => {
    expect(documentState(doc({ storagePath: null }), TODAY).state).toBe("unusable");
  });

  it("an unfinished upload is unusable", () => {
    expect(documentState(doc({ uploadStatus: "pending" }), TODAY).state).toBe("unusable");
  });

  it("a verified-only record is complete without a file", () => {
    expect(documentState(doc({ storagePath: null, verifyOnly: true }), TODAY).state).toBe(
      "current",
    );
  });

  it("past its date is expired, inside a month is expiring", () => {
    expect(documentState(doc({ expiresOn: "2026-02-20" }), TODAY).state).toBe("expired");
    expect(documentState(doc({ expiresOn: "2026-03-20" }), TODAY).state).toBe("expiring");
    expect(documentState(doc({ expiresOn: "2026-09-20" }), TODAY).state).toBe("current");
  });

  it("a retired document reports as retired", () => {
    expect(documentState(doc({ archivedAt: "2026-02-01T00:00:00Z" }), TODAY).state).toBe(
      "archived",
    );
  });
});

describe("legacy cleanup", () => {
  it("links into the tools Resolve replaces are leftovers", () => {
    expect(isLegacyLink(doc({ externalUrl: "https://www.notion.so/abc" }))).toBe(true);
    expect(isLegacyLink(doc({ externalUrl: "https://app.asana.com/0/1" }))).toBe(true);
    expect(isLegacyLink(doc({ externalUrl: "https://arealhomeaway.com/x" }))).toBe(false);
  });

  it("a stalled upload can be cleared", () => {
    const stalled = doc({ storagePath: null, uploadStatus: "pending" });
    expect(isRetirable(stalled)).toBe(true);
    expect(retireReason(stalled)).toContain("never finished");
  });

  it("a working document is never offered for retirement", () => {
    expect(isRetirable(doc())).toBe(false);
    expect(retireReason(doc())).toBeNull();
  });

  it("already retired documents are not offered again", () => {
    expect(isRetirable(doc({ externalUrl: "https://notion.so/x", archivedAt: "2026-01-01" }))).toBe(
      false,
    );
  });
});

describe("completion", () => {
  const required = [
    { code: "insurance", label: "Insurance" },
    { code: "license", label: "License" },
  ];

  it("counts what is not on file", () => {
    const result = completionFor(required, [doc()], TODAY);
    expect(result.missing).toBe(1);
    expect(result.complete).toBe(false);
  });

  it("an expired document still counts as needing attention", () => {
    const result = completionFor(
      required,
      [doc(), doc({ id: "d2", kindCode: "license", expiresOn: "2026-01-01" })],
      TODAY,
    );
    expect(result.missing).toBe(0);
    expect(result.attention).toBe(1);
  });

  it("everything current reads as complete", () => {
    const result = completionFor(
      required,
      [doc(), doc({ id: "d2", kindCode: "license" })],
      TODAY,
    );
    expect(result.complete).toBe(true);
  });

  it("retired copies never satisfy a requirement", () => {
    const result = completionFor(
      required,
      [doc({ archivedAt: "2026-02-01" }), doc({ id: "d2", kindCode: "license" })],
      TODAY,
    );
    expect(result.missing).toBe(1);
  });

  it("the newest copy of a type is the one that counts", () => {
    const result = completionFor(
      [{ code: "insurance", label: "Insurance" }],
      [
        doc({ id: "old", expiresOn: "2026-01-01", createdAt: "2025-01-01T00:00:00Z" }),
        doc({ id: "new", expiresOn: "2027-01-01", createdAt: "2026-01-01T00:00:00Z" }),
      ],
      TODAY,
    );
    expect(result.rows[0]?.documentId).toBe("new");
    expect(result.complete).toBe(true);
  });

  it("worst first", () => {
    const rows = completionFor(
      [
        { code: "insurance", label: "Insurance" },
        { code: "license", label: "License" },
      ],
      [doc({ id: "d2", kindCode: "license" })],
      TODAY,
    ).rows;
    expect(sortByUrgency(rows)[0]?.code).toBe("insurance");
  });
});
