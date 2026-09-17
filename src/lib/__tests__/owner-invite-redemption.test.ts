import { describe, expect, it } from "bun:test";
import { redeemOwnerInviteAtomically } from "../owner-invite-redemption.server";
import { redeemOwnerInvite } from "../owner-portal.server";

async function failure(result: Promise<unknown>) {
  return result.then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
}

describe("atomic owner invitation redemption", () => {
  it("sends only the authenticated account and normalized code to one transaction", async () => {
    const calls: unknown[] = [];
    const db = {
      from: () => {
        throw new Error("unexpected independent account, role, invitation, or history write");
      },
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: "canonical-program", error: null };
      },
    };
    expect(
      await redeemOwnerInviteAtomically(db as never, "signed-in-account", " owner-code "),
    ).toEqual({ ok: true, programId: "canonical-program" });
    expect(calls).toEqual([
      { name: "redeem_owner_invite", args: { _user_id: "signed-in-account", _code: "OWNER-CODE" } },
    ]);
  });

  it("does not treat supplied email claims or contact text as owner identity", async () => {
    const calls: unknown[] = [];
    const db = {
      rpc: async (_name: string, args: unknown) => {
        calls.push(args);
        return { data: "program", error: null };
      },
    };
    for (const email of [null, "stale-claim@example.test", "another-owner@example.test"]) {
      await redeemOwnerInvite(db as never, "authenticated-account", email, "CODE");
    }
    expect(calls).toEqual(Array(3).fill({ _user_id: "authenticated-account", _code: "CODE" }));
  });

  it("surfaces eligibility, role, concurrency, and history failures without fallback writes", async () => {
    for (const message of [
      "That code was issued to a different email address.",
      "This account has another access role.",
      "This account, invitation, or program is being updated.",
      "forced owner linkage history failure",
    ]) {
      let calls = 0;
      const db = {
        from: () => {
          throw new Error("unexpected fallback write");
        },
        rpc: async () => {
          calls++;
          return { data: null, error: new Error(message) };
        },
      };
      expect(await failure(redeemOwnerInviteAtomically(db as never, "account", "CODE"))).toBe(
        message,
      );
      expect(calls).toBe(1);
    }
  });

  it("does not claim redemption without a linked program result", async () => {
    const db = { rpc: async () => ({ data: null, error: null }) };
    expect(await failure(redeemOwnerInviteAtomically(db as never, "account", "CODE"))).toContain(
      "could not be redeemed",
    );
  });

  it("accepts the same transaction result for a confirmed idempotent retry", async () => {
    const db = { rpc: async () => ({ data: "program", error: null }) };
    const first = await redeemOwnerInviteAtomically(db as never, "account", "CODE");
    const retry = await redeemOwnerInviteAtomically(db as never, "account", "CODE");
    expect(retry).toEqual(first);
  });
});
