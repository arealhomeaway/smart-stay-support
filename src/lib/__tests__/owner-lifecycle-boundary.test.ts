import { expect, it } from "bun:test";
import { changeOwnerProgramAtomically } from "../owner-program-lifecycle.server";
import { offerToOwner } from "../owner-opportunity.server";
import { captureOwnerOfferVersion, sameOwnerOfferVersion } from "../owner-lifecycle-version";

it("writes enrollment or settings with the captured version and no follow-up event read/write", async () => {
  const calls: unknown[] = [];
  const client = {
    from: () => {
      throw new Error("Raw write attempted");
    },
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args]);
      return { data: { programId: "program", added: 0, reportVersion: "new" }, error: null };
    },
  };
  await changeOwnerProgramAtomically(client as never, {
    programId: "program",
    expectedVersion: "viewed",
    action: "remove_property",
    propertyId: "property",
    reason: "Reason retained",
  });
  expect(calls).toEqual([
    [
      "change_owner_program",
      {
        _program_id: "program",
        _expected_version: "viewed",
        _action: "remove_property",
        _property_id: "property",
        _reason: "Reason retained",
      },
    ],
  ]);
});
it("does not report success when the atomic lifecycle receipt is missing or for another program", async () => {
  for (const data of [null, { programId: "other", added: 0, reportVersion: "new" }]) {
    let message = "";
    try {
      await changeOwnerProgramAtomically({ rpc: async () => ({ data, error: null }) } as never, {
        programId: "program",
        expectedVersion: "viewed",
        action: "status",
        status: "paused",
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message.length > 0).toBe(true);
  }
});
it("manual offers carry the viewed source, canonical Owner and program with explicit privacy review", async () => {
  const calls: unknown[] = [];
  const client = {
    from: () => {
      throw new Error("Raw source/writes during submit");
    },
    rpc: async (name: string, args: unknown) => {
      calls.push([name, args]);
      return { data: name === "is_internal_staff" ? true : "opportunity", error: null };
    },
  };
  const result = await offerToOwner(client as never, "staff", {
    source: "onboarding",
    sourceId: "task",
    programId: "program",
    expectedVersion: "viewed",
    expectedOwnerId: "canonical",
    expectedSourceUpdatedAt: "source-viewed",
    title: "Safe title",
    instructions: "Safe explanation",
    actionType: "review_comment",
    availableFrom: null,
    respondBy: null,
    staffContext: "Private note",
    reviewed: true,
  });
  expect(result.opportunityId).toBe("opportunity");
  expect(calls.length).toBe(2);
  expect(calls[1]).toEqual([
    "create_owner_opportunity",
    {
      _program_id: "program",
      _expected_version: "viewed",
      _expected_owner_id: "canonical",
      _source: "onboarding",
      _source_id: "task",
      _expected_source_updated_at: "source-viewed",
      _title: "Safe title",
      _instructions: "Safe explanation",
      _action_type: "review_comment",
      _available_from: null,
      _respond_by: null,
      _staff_context: "Private note",
      _reviewed: true,
    },
  ]);
});
it("retains the authored offer context when a refresh changes Owner, source, or enrollment", () => {
  const displayed = {
    programId: "program",
    expectedVersion: "viewed",
    expectedOwnerId: "owner",
    expectedSourceUpdatedAt: "source",
  };
  const draft = captureOwnerOfferVersion(displayed);
  displayed.expectedOwnerId = "other";
  expect(draft.expectedOwnerId).toBe("owner");
  expect(sameOwnerOfferVersion(draft, displayed)).toBe(false);
  for (const change of [
    { programId: "other" },
    { expectedVersion: "new" },
    { expectedSourceUpdatedAt: "changed" },
  ])
    expect(sameOwnerOfferVersion(draft, { ...draft, ...change })).toBe(false);
});
