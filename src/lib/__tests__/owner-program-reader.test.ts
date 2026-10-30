import { expect, it } from "bun:test";
import {
  findOwnerProgram,
  parseOwnerProgram,
  readOwnerProgram,
  readOwnerProgramProperties,
  readOwnerPropertyLabels,
} from "../owner-program-reader.server";
import { ownerEnrollmentFixture, ownerProgramFixture } from "./owner-program-reader-fixture";

async function failure(action: () => unknown | Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    return String(error);
  }
  throw new Error("Expected the owner read to fail closed");
}

it("strips private program fields and rejects mismatched canonical result identity", async () => {
  const program = parseOwnerProgram({
    id: "program",
    program: ownerProgramFixture({
      internal_notes: "PRIVATE",
      completion_report: { secret: "PRIVATE" },
    }),
  });
  expect(program.internal_notes).toBe(null);
  expect(JSON.stringify(program).includes("PRIVATE")).toBe(false);
  expect(
    await failure(() => parseOwnerProgram({ id: "other", program: ownerProgramFixture() })),
  ).toContain("context changed");
});

it("never chooses a legacy account's first program or another account's program", async () => {
  const database = (programs: unknown[], members: { program_id: string; user_id: string }[] = []) => ({
    from: (table: string) => {
      expect(table).toBe("program_members");
      const f: Record<string, unknown> = {};
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => ((f[k] = v), q),
        is: () => q,
        limit: async () => ({
          data: members.filter((m) => m.program_id === f["program_id"] && m.user_id === f["user_id"]),
          error: null,
        }),
      };
      return q;
    },
    rpc: (name: string) => {
      expect(name).toBe("read_owner_programs");
      return {
        limit: async (limit: number) => {
          expect(limit).toBe(2);
          return { data: programs, error: null };
        },
      };
    },
  });
  expect(await findOwnerProgram(database([]) as never, "owner")).toBe(null);
  expect(
    await failure(() =>
      findOwnerProgram(
        database([
          { id: "program", program: ownerProgramFixture() },
          { id: "second", program: ownerProgramFixture({ id: "second" }) },
        ]) as never,
        "owner",
      ),
    ),
  ).toContain("Multiple programs");
  expect(
    await failure(() =>
      findOwnerProgram(
        database([
          { id: "program", program: ownerProgramFixture({ owner_user_id: "someone-else" }) },
        ]) as never,
        "owner",
      ),
    ),
  ).toContain("not available to this account");
  // An active co-owner of that program gets the same program; the main homeowner stays the identity.
  const shared = await findOwnerProgram(
    database(
      [{ id: "program", program: ownerProgramFixture({ owner_user_id: "someone-else" }) }],
      [{ program_id: "program", user_id: "owner" }],
    ) as never,
    "owner",
  );
  expect(shared?.id).toBe("program");
  expect(shared?.owner_user_id).toBe("someone-else");
  // A co-owner of a different program is still refused.
  expect(
    await failure(() =>
      findOwnerProgram(
        database(
          [{ id: "program", program: ownerProgramFixture({ owner_user_id: "someone-else" }) }],
          [{ program_id: "other-program", user_id: "owner" }],
        ) as never,
        "owner",
      ),
    ),
  ).toContain("not available to this account");
});

it("uses explicit program preview and fails closed on absent or malformed projections", async () => {
  const database = (data: unknown[]) => ({
    rpc: async (name: string, args: unknown) => {
      expect(name).toBe("read_owner_programs");
      expect(args).toEqual({ _program_id: "program", _preview: true });
      return { data, error: null };
    },
  });
  expect(
    (
      await readOwnerProgram(
        database([{ id: "program", program: ownerProgramFixture() }]) as never,
        "program",
        true,
      )
    ).data.id,
  ).toBe("program");
  expect(await failure(() => readOwnerProgram(database([]) as never, "program", true))).toContain(
    "not available",
  );
  expect(
    await failure(() =>
      readOwnerProgram(
        database([{ id: "program", program: { id: "program" } }]) as never,
        "program",
        true,
      ),
    ),
  ).toContain("invalid_type");
});

it("loads all enrollment history and removes current Property facts when access has ended", async () => {
  const all = Array.from({ length: 205 }, (_, index) => ({
    id: `enrollment-${index}`,
    enrollment: ownerEnrollmentFixture({
      id: `enrollment-${index}`,
      current_access: index !== 204,
      properties: {
        name: index === 204 ? "NEW OWNER PRIVATE HOME" : "QA Home",
        nickname: null,
        address_line1: null,
        city: null,
        state: null,
        primary_photo_url: null,
        private_note: "PRIVATE",
      },
    }),
  }));
  const pages: number[] = [];
  const database = {
    rpc: (name: string, args: unknown) => {
      expect(name).toBe("read_owner_program_properties");
      expect(args).toEqual({ _program_id: "program", _preview: false });
      const query = {
        order: () => query,
        range: async (from: number) => {
          pages.push(from);
          return { data: all.slice(from, from + 100), count: all.length, error: null };
        },
      };
      return query;
    },
  };
  const result = await readOwnerProgramProperties(database as never, "program");
  expect(pages).toEqual([0, 100, 200]);
  expect(result.data.length).toBe(205);
  expect(result.data[204]?.property_id).toBe("33333333-3333-4333-8333-333333333333");
  expect(result.data[204]?.properties).toBe(null);
  expect(JSON.stringify(result).includes("PRIVATE")).toBe(false);
});

it("batches Property filters within the endpoint bound and preserves completed-program labels", async () => {
  const batches: string[][] = [];
  const database = {
    rpc: (name: string, args: { _property_ids: string[] }) => {
      expect(name).toBe("read_owner_properties");
      batches.push(args._property_ids);
      const query = {
        order: () => query,
        range: async () => ({
          count: args._property_ids.length,
          error: null,
          data: args._property_ids.map((id) => ({
            id,
            program_id: "program",
            program_status: id === "property-104" ? "completed" : "active",
            property: { id, name: `QA ${id}`, private_note: "PRIVATE" },
          })),
        }),
      };
      return query;
    },
  };
  const ids = Array.from({ length: 105 }, (_, index) => `property-${index}`);
  const labels = await readOwnerPropertyLabels(database as never, [...ids, ids[0]!]);
  expect(batches.map((batch) => batch.length)).toEqual([100, 5]);
  expect(labels.length).toBe(105);
  expect(labels[104]?.active).toBe(false);
  expect(labels[0]?.active).toBe(true);
  expect(JSON.stringify(labels).includes("PRIVATE")).toBe(false);
});
