import { describe, expect, it } from "bun:test";
import { resolvePrimaryOwners } from "@/lib/owner-directory.server";

const owners = [
  { id: 1, first_name: "Dana", last_name: "Reyes", email_address: "dana@example.com", phone: { number: "555-0100" } },
  { id: 2, first_name: "Sam", last_name: "Okafor", email_address: "sam@example.com", phone: null },
];

describe("resolvePrimaryOwners", () => {
  it("matches the designated primary owner and records its source", () => {
    const { rows, counts } = resolvePrimaryOwners(
      [{ id: "p1", ownerrez_property_id: "10" }],
      [{ id: 10, name: "A", owner_id: 1 }],
      owners,
    );
    expect(counts.matched).toBe(1);
    expect(rows[0]!.match_status).toBe("matched");
    expect(rows[0]!.owner_name).toBe("Dana Reyes");
    expect(rows[0]!.source).toBe("ownerrez");
    expect(rows[0]!.source_id).toBe("1");
    expect(rows[0]!.synced_at).toBeTruthy();
  });

  it("reports a home with no OwnerRez link as unmatched, never as ownerless-by-default", () => {
    const { rows, counts } = resolvePrimaryOwners(
      [{ id: "p2", ownerrez_property_id: null }],
      [{ id: 10, name: "A", owner_id: 1 }],
      owners,
    );
    expect(counts.not_linked).toBe(1);
    expect(rows[0]!.match_status).toBe("unmatched");
    expect(rows[0]!.detail).toContain("not linked to an OwnerRez listing");
  });

  it("refuses to choose between conflicting owners", () => {
    const { rows, counts } = resolvePrimaryOwners(
      [{ id: "p3", ownerrez_property_id: "10" }],
      [
        { id: 10, name: "A", owner_id: 1 },
        { id: 10, name: "A", owner_id: 2 },
      ],
      owners,
    );
    expect(counts.ambiguous).toBe(1);
    expect(rows[0]!.match_status).toBe("ambiguous");
    expect(rows[0]!.owner_name).toBeNull();
  });

  it("does not invent an owner when the listing names none", () => {
    const { rows } = resolvePrimaryOwners(
      [{ id: "p4", ownerrez_property_id: "11" }],
      [{ id: 11, name: "B", owner_id: null }],
      owners,
    );
    expect(rows[0]!.match_status).toBe("unmatched");
    expect(rows[0]!.detail).toContain("names no designated owner");
  });
});
