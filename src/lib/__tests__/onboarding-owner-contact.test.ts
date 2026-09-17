import { expect, it } from "bun:test";
import { loadOwnerContacts } from "../onboarding-project.server";

it("uses explicit canonical Owner IDs and leaves unresolved contact identities unresolved", async () => {
  const selected: string[] = [];
  const db = {
    from(table: string) {
      selected.push(table);
      if (table === "property_owner_contacts")
        throw new Error("Legacy contact must not select an Owner");
      let ids: string[] = [];
      const q = {
        select: () => q,
        in: (_key: string, value: string[]) => {
          ids = value;
          return q;
        },
        eq: (key: string, value: unknown) => {
          expect([key, value]).toEqual(["active", true]);
          return q;
        },
        order: () => q,
        range: async () => {
          if (table === "properties") {
            expect(ids).toEqual(["linked", "unlinked"]);
            return {
              data: [
                { id: "linked", owner_record_id: "canonical" },
                { id: "unlinked", owner_record_id: null },
              ],
              count: 2,
              error: null,
            };
          }
          expect(ids).toEqual(["canonical"]);
          return {
            data: [
              {
                id: "canonical",
                name: "Canonical Owner",
                email: "owner@example.test",
                phone: null,
                source: "ownerrez",
              },
            ],
            count: 1,
            error: null,
          };
        },
      };
      return q;
    },
  };
  expect(await loadOwnerContacts(db as never, ["linked", "unlinked", "linked"])).toEqual([
    {
      property_id: "linked",
      owner_record_id: "canonical",
      owner_name: "Canonical Owner",
      owner_email: "owner@example.test",
      owner_phone: null,
      source: "ownerrez",
      match_status: "canonical",
    },
  ]);
  expect(selected).toEqual(["properties", "property_owners"]);
});
