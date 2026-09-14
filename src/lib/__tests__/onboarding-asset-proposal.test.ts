import { expect, it } from "bun:test";
import { proposeFact } from "../onboarding-finance.server";

it("rejects an asset outside the requested property before creating a proposal", async () => {
  const filters: string[] = [];
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      if (table === "property_fact_proposals") throw new Error("Unexpected proposal insert");
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          filters.push(`${table}:${key}:${value}`);
          return query;
        },
        is: () => query,
        maybeSingle: async () => ({
          data: table === "properties" ? { id: "property" } : null,
          error: null,
        }),
      };
      return query;
    },
  };
  let message = "";
  try {
    await proposeFact(db as never, "staff", {
      propertyId: "property",
      assetId: "other-asset",
      fieldKey: "model",
      proposedValue: "QA model",
    });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("current asset belonging to this property");
  expect(filters.includes("property_assets:property_id:property")).toBe(true);
});

it("rejects restricted asset fields before reading or writing data", async () => {
  let touched = false;
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from: () => {
      touched = true;
      throw new Error("Unexpected data access");
    },
  };
  let message = "";
  try {
    await proposeFact(db as never, "staff", {
      propertyId: "property",
      assetId: "asset",
      fieldKey: "password",
      proposedValue: "not-a-real-secret",
    });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("cannot be changed");
  expect(touched).toBe(false);
});
