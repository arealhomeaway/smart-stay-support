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
  it("resumes an activated program without changing its clock", async () => {
    let patch: unknown;
    let event: unknown;
    const query = {
      select: () => query,
      eq: () => query,
      single: async () => ({ data: { status: "paused", started_on: "2026-01-01" }, error: null }),
      update: (value: unknown) => {
        patch = value;
        return query;
      },
      maybeSingle: async () => ({ data: { id: "program" }, error: null }),
    };
    const db = {
      from: (table: string) =>
        table === "owner_program_events"
          ? {
              insert: async (value: unknown) => {
                event = value;
                return { error: null };
              },
            }
          : query,
    };
    await setProgramStatus(db as never, "supervisor", { programId: "program", status: "active" });
    expect(patch).toEqual({ status: "active" });
    expect(Boolean(event)).toBe(true);
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
  it("cannot activate a draft or reopen a completed program through status editing", async () => {
    for (const status of ["draft", "completed", "closed", "complete"]) {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({
          data: { status, started_on: status === "draft" ? null : "2026-01-01" },
          error: null,
        }),
        update: () => {
          throw new Error("unexpected write");
        },
      };
      await expectFailure(
        setProgramStatus({ from: () => query } as never, "supervisor", {
          programId: "program",
          status: "active",
        }),
        "activation or completion checklist",
      );
    }
  });

  it("does not roll an active program back to pre-activation or resume an unstarted pause", async () => {
    for (const [status, started_on, next] of [
      ["active", "2026-01-01", "draft"],
      ["paused", null, "active"],
    ] as const) {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: { status, started_on }, error: null }),
        update: () => {
          throw new Error("unexpected write");
        },
      };
      await expectFailure(
        setProgramStatus({ from: () => query } as never, "supervisor", {
          programId: "program",
          status: next,
        }),
        "activation or completion checklist",
      );
    }
  });

  it("rejects a stale pause instead of recording a lifecycle event", async () => {
    const filters: unknown[][] = [];
    const query = {
      select: () => query,
      eq: (...args: unknown[]) => {
        filters.push(args);
        return query;
      },
      single: async () => ({ data: { status: "active", started_on: "2026-01-01" }, error: null }),
      update: () => query,
      maybeSingle: async () => ({ data: null, error: null }),
    };
    await expectFailure(
      setProgramStatus({ from: () => query } as never, "supervisor", {
        programId: "program",
        status: "paused",
      }),
      "program changed",
    );
    expect(filters.some(([key, value]) => key === "status" && value === "active")).toBe(true);
  });
});
