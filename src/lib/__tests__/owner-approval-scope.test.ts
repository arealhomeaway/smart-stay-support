import { expect, it } from "bun:test";
import { loadOwnerApprovals, recordOwnerApproval } from "../owner-portal.server";

it("uses the recipient-scoped approval projection without raw-table fallback", async () => {
  const db = {
    from: () => {
      throw new Error("Raw approval access is forbidden");
    },
    rpc: (name: string, args: unknown, options: unknown) => {
      expect(name).toBe("read_owner_approvals");
      expect(args).toEqual({});
      expect(options).toEqual({ count: "exact" });
      const q = { order: () => q, range: async () => ({ data: [], count: 0, error: null }) };
      return q;
    },
  };
  expect(await loadOwnerApprovals(db as never, "owner")).toEqual([]);
});
it("retains direct endpoint scope and stale-publication failures without a fallback write", async () => {
  for (const message of ["Wrong recipient", "Wrong role", "Demo request", "Publication changed"]) {
    const db = {
      from: () => {
        throw new Error("No table write fallback");
      },
      rpc: async (name: string, args: { _publication_id: string }) => {
        expect(name).toBe("respond_owner_approval");
        expect(args._publication_id).toBe("reviewed-publication");
        return { data: null, error: new Error(message) };
      },
    };
    await expect(
      recordOwnerApproval(db as never, "owner", {
        approvalId: "approval",
        publicationId: "reviewed-publication",
        expectedUpdatedAt: "2026-09-15T00:00:00Z",
        decision: "approved",
        comment: "",
      }),
    ).rejects.toThrow(message);
  }
});
