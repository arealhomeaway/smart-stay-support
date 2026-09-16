import { describe, expect, it } from "bun:test";
import { activateProgram, setProgramStatus } from "../owner-program.server";
async function expectFailure(result: Promise<unknown>, message: string) {
  const actual = await result.then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
  expect(actual.includes(message)).toBe(true);
}
describe("owner program lifecycle action", () => {
  it("sends a viewed version to one atomic status action without raw clock or history writes", async () => {
    const calls: unknown[] = [];
    const db = {
      from: () => {
        throw new Error("Separate lifecycle write attempted");
      },
      rpc: async (name: string, args: unknown) => {
        calls.push([name, args]);
        return {
          data: { programId: "program", added: 0, reportVersion: "new-version" },
          error: null,
        };
      },
    };
    await setProgramStatus(db as never, "supervisor", {
      programId: "program",
      expectedVersion: "viewed-version",
      status: "active",
    });
    expect(calls).toEqual([
      [
        "change_owner_program",
        {
          _program_id: "program",
          _expected_version: "viewed-version",
          _action: "status",
          _status: "active",
        },
      ],
    ]);
  });
  it("preserves a supervisor's reviewed version and surfaces competing activation rejection without a separate event", async () => {
    for (const role of ["admin", "manager"]) {
      const activationCalls: Record<string, string>[] = [];
      const checkedRoles: string[] = [];
      const db = {
        from: () => {
          throw new Error("Activation must not reread a fresh version or append a separate event.");
        },
        rpc: async (name: string, args: Record<string, string>) => {
          if (name === "has_role") {
            expect(args["_user_id"]).toBe("supervisor");
            checkedRoles.push(args["_role"]!);
            return { data: args["_role"] === role, error: null };
          }
          expect(name).toBe("activate_owner_program");
          expect(checkedRoles.sort()).toEqual(["admin", "manager"]);
          activationCalls.push(args);
          return {
            data: null,
            error: new Error(
              "The program or its properties changed. Review current details before activating.",
            ),
          };
        },
      };
      await expectFailure(
        activateProgram(db as never, "supervisor", {
          programId: "program",
          expectedVersion: "version-reviewed-before-competing-activation",
          startedOn: "2020-01-01",
        }),
        "The program or its properties changed",
      );
      expect(activationCalls).toEqual([
        {
          _program_id: "program",
          _expected_version: "version-reviewed-before-competing-activation",
          _started_on: "2020-01-01",
        },
      ]);
    }
  });
  it("propagates lifecycle, disabled-account and stale version rejections without a second write", async () => {
    for (const reason of [
      "Use the activation or completion checklist",
      "This program is no longer open for changes",
      "The program changed",
      "An enabled staff account is required",
    ]) {
      let writes = 0;
      const db = {
        from: () => {
          throw new Error("Raw fallback");
        },
        rpc: async () => {
          writes++;
          return { data: null, error: new Error(reason) };
        },
      };
      await expectFailure(
        setProgramStatus(db as never, "supervisor", {
          programId: "program",
          expectedVersion: "viewed",
          status: "paused",
        }),
        reason,
      );
      expect(writes).toBe(1);
    }
  });
});
