import { describe, expect, it } from "bun:test";
import { captureOwnerActivation, type OwnerActivationContext } from "../owner-program-activation";
import { activateOwnerProgramAtomically } from "../owner-program-activation.server";
import { activateProgram } from "../owner-program.server";

function context(): OwnerActivationContext {
  return {
    programId: "program",
    reportVersion: "reviewed-version",
    status: "draft",
    startedOn: null,
    dfyConfirmed: true,
    properties: [
      {
        propertyId: "included",
        name: "Lake home",
        closingDate: "2026-09-01",
        closingConfirmed: true,
        inclusionStatus: "included",
      },
      {
        propertyId: "removed",
        name: "Former home",
        closingDate: null,
        closingConfirmed: false,
        inclusionStatus: "removed",
      },
    ],
  };
}

async function failure(result: Promise<unknown>) {
  return result.then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
}

describe("reviewed owner program activation", () => {
  it("freezes the reviewed enrollment facts and version when the dialog opens", () => {
    const current = context();
    const draft = captureOwnerActivation(current, "2026-09-10");
    current.reportVersion = "new-version";
    current.dfyConfirmed = false;
    current.properties[0]!.closingDate = "2026-09-12";
    current.properties[0]!.name = "Changed name";
    current.properties.push({
      propertyId: "new",
      name: "New home",
      closingDate: null,
      closingConfirmed: false,
      inclusionStatus: "included",
    });
    expect(draft.expectedVersion).toBe("reviewed-version");
    expect(draft.dfyConfirmed).toBe(true);
    expect(draft.properties).toEqual([
      {
        propertyId: "included",
        name: "Lake home",
        closingDate: "2026-09-01",
        closingConfirmed: true,
      },
    ]);
    expect(draft.startedOn).toBe("2026-09-10");
  });

  it("only replaces the version and facts on explicit rereview, preserving the chosen date", () => {
    const current = context();
    const original = captureOwnerActivation(current, "2026-09-10");
    current.reportVersion = "new-version";
    current.properties[0]!.closingConfirmed = false;
    const rereviewed = captureOwnerActivation(current, original.startedOn);
    expect(rereviewed.expectedVersion).toBe("new-version");
    expect(rereviewed.properties[0]!.closingConfirmed).toBe(false);
    expect(rereviewed.startedOn).toBe(original.startedOn);
    expect(original.properties[0]!.closingConfirmed).toBe(true);
  });

  it("forwards the browser version to one atomic write without replacing it with a fresh read", async () => {
    const calls: unknown[] = [];
    const db = {
      from: () => {
        throw new Error("unexpected separate read or write");
      },
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: "program", error: null };
      },
    };
    expect(
      await activateOwnerProgramAtomically(db as never, {
        programId: "program",
        expectedVersion: "reviewed-version",
        startedOn: "2026-09-10",
      }),
    ).toEqual({ ok: true });
    expect(calls).toEqual([
      {
        name: "activate_owner_program",
        args: {
          _program_id: "program",
          _expected_version: "reviewed-version",
          _started_on: "2026-09-10",
        },
      },
    ]);
  });

  it("retains the caller's draft after stale and atomic-history failures", async () => {
    for (const message of [
      "The program or its properties changed.",
      "forced activation history failure",
    ]) {
      const draft = captureOwnerActivation(context(), "2026-09-10");
      const original = JSON.stringify(draft);
      const db = {
        from: () => {
          throw new Error("unexpected separate history write");
        },
        rpc: async () => ({ data: null, error: new Error(message) }),
      };
      expect(await failure(activateOwnerProgramAtomically(db as never, draft))).toBe(message);
      expect(JSON.stringify(draft)).toBe(original);
    }
  });

  it("does not report activation when no saved program was returned", async () => {
    expect(
      await failure(
        activateOwnerProgramAtomically(
          { rpc: async () => ({ data: null, error: null }) } as never,
          {
            programId: "program",
            expectedVersion: "version",
            startedOn: "2026-09-10",
          },
        ),
      ),
    ).toContain("Review current details");
  });

  it("checks supervisor access before attempting the activation RPC", async () => {
    const calls: string[] = [];
    const db = {
      from: () => {
        throw new Error("unexpected table access");
      },
      rpc: async (name: string) => {
        calls.push(name);
        return { data: false, error: null };
      },
    };
    expect(
      await failure(
        activateProgram(db as never, "owner", {
          programId: "program",
          expectedVersion: "version",
          startedOn: "2026-09-10",
        }),
      ),
    ).toContain("Only a supervisor");
    expect(calls).toEqual(["has_role", "has_role", "is_onboarding_director"]);
  });
});
