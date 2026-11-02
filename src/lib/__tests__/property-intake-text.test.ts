import { describe, it, expect, vi, beforeEach } from "vitest";

const listing = {
  id: 624001,
  name: "624 Daniel Court",
  public_name: null,
  address: { street1: "624 Daniel Court", street2: 2, city: "Norman", state: "OK", postal_code: 73069, zip: null },
};
vi.mock("../ownerrez.server", () => ({
  listListings: async () => [listing],
  propertyDetail: async () => ({ owner_id: 98765 }),
  ownerRezGet: async () => ({ first_name: "Pat", last_name: null, email_address: null, email: "pat@example.com", phone: { number: "4055550100" }, cell_phone: 4055550199 }),
  OwnerRezError: class extends Error {},
}));

import { textOf, textOrNull, importOwnerRezProperty, ownerRezOwner } from "../property-intake.server";

function fakeClient() {
  const inserts: Record<string, unknown>[] = [];
  const chain = (table: string) => {
    const q: any = {
      select: () => q, is: () => Promise.resolve({ data: [], error: null }),
      eq: () => q, maybeSingle: async () => ({ data: null, error: null }),
      insert: (row: Record<string, unknown>) => { inserts.push({ table, ...row }); return q; },
      single: async () => ({ data: { id: table + "-id", name: "624 Daniel Court", address_line1: "624 Daniel Court", unit: "2", city: "Norman", state: "OK", postal_code: "73069", lifecycle_status: "not_onboarded", ownerrez_property_id: "624001", is_demo: false }, error: null }),
    };
    return q;
  };
  return { client: { from: chain } as any, inserts };
}

describe("string-safe OwnerRez intake", () => {
  beforeEach(() => vi.clearAllMocks());
  it("textOf handles numbers, nulls and objects", () => {
    expect(textOf(73069)).toBe("73069");
    expect(textOf(null)).toBe("");
    expect(textOf({ a: 1 })).toBe("");
    expect(textOf("  Norman ")).toBe("Norman");
    expect(textOrNull("   ")).toBeNull();
  });
  it("owner details with number/object phones do not throw", async () => {
    const o = await ownerRezOwner("624001");
    expect(o).toMatchObject({ sourceId: "98765", name: "Pat", email: "pat@example.com", phone: "4055550199" });
  });
  it("imports the Daniel Court listing shape without v.trim errors", async () => {
    const { client, inserts } = fakeClient();
    const r = await importOwnerRezProperty(client, "user-1", { listingId: "624001", owner: { name: "Pat", email: null, phone: null } });
    expect(r.status).toBe("created");
    const prop = inserts.find((i) => i.table === "properties")!;
    expect(prop).toMatchObject({ unit: "2", postal_code: "73069", city: "Norman", ownerrez_property_id: "624001" });
    const owner = inserts.find((i) => i.table === "property_owners")!;
    expect(owner).toMatchObject({ name: "Pat", email: "pat@example.com", phone: "4055550199" });
  });
});
