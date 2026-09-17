import { describe, expect, it } from "bun:test";
import { isStaleFact, type FactProposal } from "../onboarding-finance";
import { proposeFact } from "../onboarding-finance.server";

describe("fact capture boundaries", () => {
  it("compares the exact captured value with live data, including null and whitespace", () => {
    const proposal = { current_value: "Front door" } as FactProposal;
    expect(isStaleFact(proposal, "Front door")).toBe(false);
    expect(isStaleFact(proposal, "Front door ")).toBe(true);
    expect(isStaleFact(proposal, null)).toBe(true);
    expect(isStaleFact({ current_value: null } as FactProposal, "")).toBe(true);
  });

  it("rejects another property's task before writing a proposal", async () => {
    let writes = 0;
    const db = {
      rpc: async () => ({ data: true, error: null }),
      from: (table: string) => {
        const query = {
          select: () => query,
          eq: () => query,
          is: () => query,
          maybeSingle: async () => ({
            data: table === "properties" ? { id: "property", wifi_notes: "Existing" } : null,
            error: null,
          }),
          insert: () => {
            writes++;
            return query;
          },
        };
        return query;
      },
    };
    let message = "";
    try {
      await proposeFact(db as never, "staff", {
        propertyId: "property",
        fieldKey: "wifi_notes",
        proposedValue: "Observed",
        taskId: "other-property-task",
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("current task belonging to this property");
    expect(writes).toBe(0);
  });
});
