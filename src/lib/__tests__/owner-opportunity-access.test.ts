import { expect, it } from "bun:test";
import { offerToOwner, opportunityContext, type OfferInput } from "../owner-opportunity.server";

const offer: OfferInput = {
  source: "operations",
  sourceId: "ticket",
  programId: "program",
  expectedVersion: "version",
  expectedOwnerId: "canonical-owner",
  expectedSourceUpdatedAt: "source-version",
  reviewed: true,
  title: "Owner review",
  instructions: "Review the property work.",
  actionType: "information_only",
  availableFrom: null,
  respondBy: null,
  staffContext: "Private staff context",
};

it("blocks non-staff opportunity context and creation before loading private source text", async () => {
  for (const source of ["onboarding", "operations"] as const) {
    for (const operation of ["context", "offer"] as const) {
      let reads = 0;
      const db = {
        rpc: async (name: string, args: unknown) => {
          expect(name).toBe("is_internal_staff");
          expect(args).toEqual({ _user_id: "owner" });
          return { data: false, error: null };
        },
        from: () => {
          reads++;
          throw new Error("Private source read");
        },
      };
      let error = "";
      try {
        if (operation === "context")
          await opportunityContext(db as never, "owner", source, "source");
        else await offerToOwner(db as never, "owner", { ...offer, source });
      } catch (caught) {
        error = (caught as Error).message;
      }
      expect(error).toContain("Only staff");
      expect(reads).toBe(0);
    }
  }
});

it("preserves staff source-context reads after staff authorization succeeds", async () => {
  let roleChecked = false;
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({
      data: {
        id: "ticket",
        property_id: null,
        title: "Internal issue",
        description: "Internal details",
      },
      error: null,
    }),
  };
  const db = {
    rpc: async () => {
      roleChecked = true;
      return { data: true, error: null };
    },
    from: (table: string) => {
      expect(roleChecked).toBe(true);
      expect(table).toBe("tickets");
      return query;
    },
  };
  expect(await opportunityContext(db as never, "staff", "operations", "ticket")).toEqual({
    eligible: false,
    reason: "no_property",
  });
});
