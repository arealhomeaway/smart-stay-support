import { expect, it } from "bun:test";
import { loadOwnerApprovals, recordOwnerApproval } from "../owner-portal.server";

it("excludes staff-role, demo and other recipients from the homeowner approval feed", async () => {
  let rows = [
    { id: "real", approver_id: "owner", approver_role: "owner", is_demo: false },
    { id: "staff", approver_id: "owner", approver_role: "admin", is_demo: false },
    { id: "demo", approver_id: "owner", approver_role: "owner", is_demo: true },
    { id: "other", approver_id: "other", approver_role: "owner", is_demo: false },
  ] as Record<string, unknown>[];
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      rows = rows.filter((row) => row[key] === value);
      return query;
    },
    order: () => query,
    limit: async () => ({ data: rows, error: null }),
  };
  const approvals = await loadOwnerApprovals({ from: () => query } as never, "owner");
  expect(approvals.map((approval) => approval.id)).toEqual(["real"]);
});

it("rejects direct homeowner decisions on staff-role and demo requests before any write", async () => {
  for (const change of [
    { approver_role: "admin" },
    { approver_role: null },
    { is_demo: true },
    { is_demo: null },
    { approver_id: "other" },
  ]) {
    let writes = 0;
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: {
          id: "approval",
          status: "pending",
          approver_id: "owner",
          approver_role: "owner",
          is_demo: false,
          ...change,
        },
        error: null,
      }),
      update: () => {
        writes++;
        return query;
      },
    };
    let rejected = false;
    try {
      await recordOwnerApproval({ from: () => query } as never, "owner", {
        approvalId: "approval",
        decision: "approved",
        comment: "",
      });
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
    expect(writes).toBe(0);
  }
});

it("rechecks role and demo scope when a generic approval changes after the read", async () => {
  let writing = false;
  const filters: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      if (writing) filters[key] = value;
      return query;
    },
    update: () => {
      writing = true;
      return query;
    },
    maybeSingle: async () => ({
      data: writing
        ? null
        : {
            id: "approval",
            status: "pending",
            approver_id: "owner",
            approver_role: "owner",
            is_demo: false,
            entity_type: "property",
          },
      error: null,
    }),
  };
  let message = "";
  try {
    await recordOwnerApproval({ from: () => query } as never, "owner", {
      approvalId: "approval",
      decision: "approved",
      comment: "",
    });
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain("already recorded or the recipient changed");
  expect(filters).toEqual({
    id: "approval",
    status: "pending",
    approver_id: "owner",
    approver_role: "owner",
    is_demo: false,
  });
});
