import { describe, expect, it } from "bun:test";
import { decideOwnerLink, ownerRezOwnerKey, planOwnerKeys } from "@/lib/owner-sync-rules";

describe("OwnerRez owner id format", () => {
  it("treats ownerrez:150924525 and 150924525 as the same owner", () => {
    expect(ownerRezOwnerKey("ownerrez:150924525")).toBe("150924525");
    expect(ownerRezOwnerKey("150924525")).toBe("150924525");
    expect(ownerRezOwnerKey(150924525)).toBe("150924525");
  });

  it("matches an older prefixed record and renames it to the bare id", () => {
    const p = planOwnerKeys([{ id: "a", source_owner_id: "ownerrez:150924525" }, { id: "b", source_owner_id: "150923799" }]);
    expect(p.idByKey.get("150924525")).toBe("a");
    expect(p.renames).toEqual([{ id: "a", from: "ownerrez:150924525", to: "150924525" }]);
    expect(p.duplicateKeys.size).toBe(0);
  });

  it("never picks one of two records for the same owner", () => {
    const p = planOwnerKeys([{ id: "a", source_owner_id: "ownerrez:150924525" }, { id: "b", source_owner_id: "150924525" }]);
    expect(p.duplicateKeys.has("150924525")).toBe(true);
    expect(p.idByKey.has("150924525")).toBe(false);
    expect(p.renames).toEqual([]);
  });

  it("ignores retired records", () => {
    const p = planOwnerKeys([{ id: "old", source_owner_id: "merged:150924525" }, { id: "keep", source_owner_id: "150924525" }]);
    expect(p.idByKey.get("150924525")).toBe("keep");
  });
});

describe("Homes in a current Active Owner program keep their owner record", () => {
  it("keeps the link when OwnerRez names a different owner record", () => {
    expect(decideOwnerLink({ targetOwnerId: "new", programOwnerId: "program", duplicate: false })).toEqual({ action: "keep", reason: "program" });
  });
  it("links when OwnerRez names the program's own owner record", () => {
    expect(decideOwnerLink({ targetOwnerId: "program", programOwnerId: "program", duplicate: false })).toEqual({ action: "link", ownerRecordId: "program" });
  });
  it("links a home with no program as before", () => {
    expect(decideOwnerLink({ targetOwnerId: "new", programOwnerId: null, duplicate: false })).toEqual({ action: "link", ownerRecordId: "new" });
  });
  it("never links while two records share the OwnerRez owner", () => {
    expect(decideOwnerLink({ targetOwnerId: "x", programOwnerId: null, duplicate: true })).toEqual({ action: "keep", reason: "duplicate" });
  });
});
