import { expect, it } from "bun:test";
import {
  loadOwnerApprovals,
  parseOwnerApproval,
  publishOwnerApproval,
  recordOwnerApproval,
} from "../owner-approval.server";
import {
  captureApprovalPublicationVersion,
  captureOwnerDecisionVersion,
  sameApprovalPublicationVersion,
} from "../owner-approval-context";
const approval = {
  id: "request",
  updated_at: "2026-09-16T12:00:00Z",
  kind: "other",
  title: "Reviewed decision",
  detail: "Owner-safe reviewed context",
  amount: 150,
  currency: "USD",
  status: "pending",
  decision_note: null,
  decided_at: null,
  due_on: null,
  evidence_url: null,
  property_id: "home",
  property_name: "Home",
  active_owner: true,
  created_at: "2026-09-16T11:00:00Z",
  publication_id: "publication",
  revision: 2,
  can_respond: true,
  recorded_by_owner: false,
  blocked_reason: null,
};
it("loads only the checked projection, removes unexpected fields and verifies every counted page", async () => {
  const calls: unknown[] = [];
  const client = {
    from: () => {
      throw new Error("Raw approval read attempted");
    },
    rpc: (name: string, input: unknown, options: unknown) => {
      calls.push([name, input, options]);
      return {
        order: () => ({
          range: async (from: number) => ({
            data:
              from === 0
                ? [{ id: "request", approval: { ...approval, internal_notes: "secret" } }]
                : [],
            count: 1,
            error: null,
          }),
        }),
      };
    },
  };
  const result = await loadOwnerApprovals(client as never, "signed-in-account");
  expect(result).toEqual([approval]);
  expect(calls).toEqual([["read_owner_approvals", {}, { count: "exact" }]]);
});
it("requires a matching canonical ID and meaningful reviewed context for actionable requests", () => {
  for (const row of [
    { id: "other", approval },
    { id: "request", approval: { ...approval, publication_id: null } },
    { id: "request", approval: { ...approval, detail: null } },
  ]) {
    let rejected = false;
    try {
      parseOwnerApproval(row);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  }
  const blocked = parseOwnerApproval({
    id: "request",
    approval: {
      ...approval,
      publication_id: null,
      revision: null,
      can_respond: false,
      detail: null,
      blocked_reason: "Staff must review",
    },
  });
  expect(blocked.can_respond).toBe(false);
});
it("sends the displayed immutable publication and approval version to one atomic caller-authenticated decision", async () => {
  const calls: unknown[] = [];
  const client = {
    from: () => {
      throw new Error("Raw approval write attempted");
    },
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args]);
      return { data: "2026-09-16T13:00:00Z", error: null };
    },
  };
  const result = await recordOwnerApproval(client as never, "not-an-actor-argument", {
    approvalId: "request",
    publicationId: "publication",
    expectedUpdatedAt: approval.updated_at,
    decision: "approved",
    comment: "  Agreed  ",
  });
  expect(result.status).toBe("approved");
  expect(calls).toEqual([
    [
      "respond_owner_approval",
      {
        _approval_id: "request",
        _publication_id: "publication",
        _expected_updated_at: approval.updated_at,
        _approved: true,
        _note: "Agreed",
      },
    ],
  ]);
});
it("propagates stale/denied decisions without fallback writes and requires a confirmed receipt", async () => {
  for (const outcome of [
    { data: null, error: new Error("The published context changed") },
    { data: null, error: null },
  ]) {
    let calls = 0;
    let rejected = false;
    try {
      await recordOwnerApproval(
        {
          rpc: async () => {
            calls++;
            return outcome;
          },
        } as never,
        "owner",
        {
          approvalId: "request",
          publicationId: "publication",
          expectedUpdatedAt: approval.updated_at,
          decision: "approved",
          comment: "",
        },
      );
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
    expect(calls).toBe(1);
  }
});
it("does not call the decision endpoint for a missing publication or unreasoned decline", async () => {
  for (const change of [
    { publicationId: "", decision: "approved" as const },
    { publicationId: "publication", decision: "declined" as const },
  ]) {
    let rejected = false;
    try {
      await recordOwnerApproval(
        {
          rpc: () => {
            throw new Error("unexpected endpoint");
          },
        } as never,
        "owner",
        { approvalId: "request", expectedUpdatedAt: approval.updated_at, comment: "", ...change },
      );
    } catch (error) {
      rejected = (error as Error).message !== "unexpected endpoint";
    }
    expect(rejected).toBe(true);
  }
});
it("freezes both decision publication and staff canonical context across refresh and retry", () => {
  const viewed = { updated_at: approval.updated_at, publication_id: "first" };
  const frozenDecision = captureOwnerDecisionVersion(viewed);
  viewed.publication_id = "second";
  expect(frozenDecision.publicationId).toBe("first");
  const context = {
    approvalId: "request",
    expectedUpdatedAt: approval.updated_at,
    expectedRevision: 1,
    programId: "program",
    ownerId: "owner",
    recipientId: "recipient",
  };
  const frozen = captureApprovalPublicationVersion(context);
  context.ownerId = "other";
  expect(frozen.ownerId).toBe("owner");
  expect(sameApprovalPublicationVersion(frozen, context)).toBe(false);
  for (const patch of [
    { expectedRevision: 2 },
    { recipientId: "other" },
    { programId: "other" },
    { expectedUpdatedAt: "later" },
  ])
    expect(sameApprovalPublicationVersion(frozen, { ...frozen, ...patch })).toBe(false);
});
it("publishes the captured canonical recipient and reviewed version rather than inferring identity", async () => {
  let argumentsSeen: unknown;
  await publishOwnerApproval(
    {
      rpc: async (_name: string, args: unknown) => {
        argumentsSeen = args;
        return { data: "publication", error: null };
      },
    } as never,
    {
      approvalId: "request",
      expectedUpdatedAt: approval.updated_at,
      expectedRevision: 1,
      expectedOwnerId: "canonical",
      expectedProgramId: "program",
      expectedRecipientId: "recipient",
      title: " Safe title ",
      detail: " Safe decision explanation ",
      reviewed: true,
    },
  );
  expect(argumentsSeen).toEqual({
    _approval_id: "request",
    _expected_updated_at: approval.updated_at,
    _expected_revision: 1,
    _expected_owner_id: "canonical",
    _expected_program_id: "program",
    _expected_recipient_id: "recipient",
    _title: "Safe title",
    _detail: "Safe decision explanation",
    _reviewed: true,
  });
});
