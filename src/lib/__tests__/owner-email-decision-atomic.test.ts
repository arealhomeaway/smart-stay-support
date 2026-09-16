import { expect, it } from "bun:test";
import { recordOwnerEmailDecision } from "../owner-response.server";
const input = {
  approvalId: "approval",
  expectedUpdatedAt: "2026-09-16T12:00:00Z",
  decision: "approved" as const,
  note: " Canonical owner approved in retained reply ",
  responseId: "reply",
};
it("records the displayed approval version and optional reply with one checked transaction", async () => {
  const calls: unknown[] = [];
  const db = {
    from: () => {
      throw new Error("No independent table mutations are permitted");
    },
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: { ok: true, approvalId: "approval" }, error: null };
    },
  };
  expect(await recordOwnerEmailDecision(db as never, "authenticated-staff", input)).toEqual({
    ok: true,
  });
  expect(calls).toEqual([
    {
      name: "record_owner_email_decision",
      args: {
        _approval_id: "approval",
        _expected_updated_at: input.expectedUpdatedAt,
        _decision: "approved",
        _note: input.note.trim(),
        _response_id: "reply",
      },
    },
  ]);
});
it("surfaces stale, authorization and rollback failures without a fallback write", async () => {
  for (const message of [
    "The approval changed",
    "Current project PM responsibility is required",
    "Reply receipt failed and transaction rolled back",
  ]) {
    let calls = 0;
    const db = {
      rpc: async () => {
        calls++;
        return { data: null, error: new Error(message) };
      },
      from: () => {
        throw new Error("Unsafe fallback");
      },
    };
    expect(
      await recordOwnerEmailDecision(db as never, "staff", input).then(
        () => "unsafe",
        (error: Error) => error.message,
      ),
    ).toBe(message);
    expect(calls).toBe(1);
  }
});
it("fails closed without the reviewed version or an exact transaction receipt", async () => {
  let calls = 0;
  const db = {
    rpc: async () => {
      calls++;
      return { data: { ok: true, approvalId: "another-approval" }, error: null };
    },
  };
  expect(
    await recordOwnerEmailDecision(db as never, "staff", { ...input, expectedUpdatedAt: "" }).then(
      () => "unsafe",
      (error: Error) => error.message,
    ),
  ).toContain("Refresh");
  expect(calls).toBe(0);
  expect(
    await recordOwnerEmailDecision(db as never, "staff", input).then(
      () => "unsafe",
      (error: Error) => error.message,
    ),
  ).toContain("not confirmed");
  expect(calls).toBe(1);
});
